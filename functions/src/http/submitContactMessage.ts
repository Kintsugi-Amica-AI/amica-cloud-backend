import admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

import { getFirestore } from "../config/firebaseAdmin";
import { COLLECTIONS } from "../constants/collectionNames";
import {
  CONTACT_ALLOWED_ORIGINS,
  RateWindow,
  clientIp,
  cleanLine,
  hashIp,
  isSpamSubmission,
  nextRateWindow,
  validateContactMessage,
} from "../services/contactMessageService";

/**
 * POST endpoint for the Amica website's contact form.
 *
 * Validates the message, applies a per-sender rate limit, and stores it in
 * `contact_messages`. Delivery to the team inbox happens in the
 * `onContactMessageCreated` trigger, so a message is never lost even if
 * sending the email fails — it stays in Firestore with its error.
 *
 * Accepts JSON (the website's JavaScript) or a normal form post (visitors
 * with JavaScript off). JSON callers get `{ success, message }`.
 */
export const submitContactMessage = onRequest(
  { cors: CONTACT_ALLOWED_ORIGINS, maxInstances: 5, memory: "256MiB" },
  async (request, response) => {
    response.set("Cache-Control", "no-store");
    const wantsJson =
      request.is("application/json") === "application/json" ||
      String(request.get("accept") ?? "").includes("application/json");

    const reply = (status: number, success: boolean, message: string) => {
      if (wantsJson) {
        response.status(status).json({ success, message });
        return;
      }
      response
        .status(status)
        .type("html")
        .send(simplePage(success ? "Thank you!" : "Message not sent", message));
    };

    if (request.method !== "POST") {
      reply(405, false, "Use POST to send a message.");
      return;
    }

    const body = (request.body ?? {}) as Record<string, unknown>;

    // Bots fill the hidden field. Pretend it worked so they don't retry.
    if (isSpamSubmission(body)) {
      reply(200, true, "Thank you! Your message was sent.");
      return;
    }

    const result = validateContactMessage(body);
    if (!result.ok) {
      reply(400, false, result.errors.join(" "));
      return;
    }

    const db = getFirestore();
    const ipHash = hashIp(clientIp(request.headers["x-forwarded-for"], request.ip));
    const now = Date.now();

    try {
      const allowed = await db.runTransaction(async (tx) => {
        const ref = db.collection(COLLECTIONS.contactRateLimits).doc(ipHash);
        const snap = await tx.get(ref);
        const next = nextRateWindow(snap.data() as RateWindow | undefined, now);
        if (next.allowed) tx.set(ref, next.window);
        return next.allowed;
      });
      if (!allowed) {
        reply(429, false, "You've sent several messages in a short time. Please try again in an hour, or email us directly.");
        return;
      }

      const origin = cleanLine(request.get("origin"));
      const page = cleanLine(body.page ?? body["sent from"] ?? request.get("referer")).slice(0, 300);
      const doc = await db.collection(COLLECTIONS.contactMessages).add({
        ...result.value,
        status: "new",
        source: "website",
        page: page || null,
        origin: origin || null,
        userAgent: cleanLine(request.get("user-agent")).slice(0, 300) || null,
        ipHash,
        delivery: { state: "pending", attempts: 0 },
        schemaVersion: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info("Contact message stored", { id: doc.id, topic: result.value.topic });
      reply(200, true, "Thank you! Your message was sent. We usually reply within 2 working days.");
    } catch (error) {
      logger.error("Contact message could not be stored", error);
      reply(500, false, "We couldn't send your message right now. Please try again later.");
    }
  },
);

function simplePage(title: string, message: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Amica</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF7FF;font-family:Arial,Helvetica,sans-serif;color:#2B1B3A">
<div style="max-width:440px;margin:24px;padding:36px;border-radius:24px;background:#fff;border:1px solid #E9E2F3;text-align:center">
<h1 style="margin:0 0 10px;font-size:26px">${esc(title)}</h1><p style="margin:0 0 22px;color:#5E4C6E;line-height:1.5">${esc(message)}</p>
<a href="javascript:history.back()" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#7C4DEB;color:#fff;text-decoration:none;font-weight:600">Back to Amica</a>
</div></body></html>`;
}
