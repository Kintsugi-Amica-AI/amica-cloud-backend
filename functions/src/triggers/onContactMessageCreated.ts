import admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import nodemailer from "nodemailer";

import { COLLECTIONS } from "../constants/collectionNames";
import {
  ContactMessageInput,
  buildContactEmail,
} from "../services/contactMessageService";

/**
 * Email settings come from plain environment variables. Firebase loads them
 * from `functions/.env.<project>` at deploy time (git-ignored; the dev deploy
 * workflow writes it from the GitHub secret CONTACT_SMTP_APP_PASSWORD).
 * They are read with process.env rather than defineString() so a
 * non-interactive CI deploy never stops to ask for a value.
 * See docs/contact_form_setup.md.
 *
 *   CONTACT_SMTP_APP_PASSWORD  Gmail App Password. Empty = emails switched off
 *                              (messages are still stored in Firestore).
 *   CONTACT_SMTP_USER          Gmail account that sends the emails.
 *   CONTACT_INBOX              Where messages go (comma-separate for several).
 */
const DEFAULT_TEAM_INBOX = "teamkintsugi2026@gmail.com";

function emailSettings() {
  return {
    password: (process.env.CONTACT_SMTP_APP_PASSWORD ?? "").replace(/\s+/g, ""),
    user: (process.env.CONTACT_SMTP_USER ?? "").trim() || DEFAULT_TEAM_INBOX,
    inbox: (process.env.CONTACT_INBOX ?? "").trim() || DEFAULT_TEAM_INBOX,
  };
}

/**
 * Emails each new website message to the team inbox. The Firestore document
 * records the outcome (`delivery.state` = sent | error), so failed deliveries
 * can be seen and retried from the Firebase console.
 */
export const onContactMessageCreated = onDocumentCreated(
  {
    document: `${COLLECTIONS.contactMessages}/{messageId}`,
    retry: false,
    maxInstances: 5,
  },
  async (event) => {
    const snapshot = event.data;
    const data = snapshot?.data();
    if (!snapshot || !data) return;
    if (data.delivery?.state === "sent") return; // duplicate event

    const message = data as ContactMessageInput & { page?: string | null };
    const createdAt = (data.createdAt as admin.firestore.Timestamp | undefined)?.toDate() ?? new Date();
    const email = buildContactEmail(message, {
      id: event.params.messageId,
      receivedAt: createdAt,
      page: message.page ?? undefined,
    });

    const { user, password, inbox } = emailSettings();
    if (!password) {
      logger.warn("Contact message stored but not emailed: CONTACT_SMTP_APP_PASSWORD is not set", {
        id: event.params.messageId,
      });
      await snapshot.ref.update({
        "delivery.state": "not_configured",
        "delivery.error": "CONTACT_SMTP_APP_PASSWORD is not set",
      });
      return;
    }

    try {
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass: password },
      });
      const info = await transport.sendMail({
        from: { name: "Amica website", address: user },
        to: inbox,
        replyTo: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      await snapshot.ref.update({
        "delivery.state": "sent",
        "delivery.attempts": admin.firestore.FieldValue.increment(1),
        "delivery.messageId": info.messageId ?? null,
        "delivery.sentAt": admin.firestore.FieldValue.serverTimestamp(),
        "delivery.error": admin.firestore.FieldValue.delete(),
      });
      logger.info("Contact message emailed", { id: event.params.messageId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error("Contact message email failed", { id: event.params.messageId, reason });
      await snapshot.ref.update({
        "delivery.state": "error",
        "delivery.attempts": admin.firestore.FieldValue.increment(1),
        "delivery.error": reason.slice(0, 500),
        "delivery.failedAt": admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);
