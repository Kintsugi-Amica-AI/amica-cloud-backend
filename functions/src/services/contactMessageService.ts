import { createHash } from "node:crypto";

/**
 * Contact form on the Amica website.
 *
 * Pure helpers (validation, rate limiting, email formatting) live here so they
 * can be unit tested without Firebase. The HTTP endpoint stores each message in
 * `contact_messages`; a Firestore trigger then emails it to the team inbox.
 */

export const CONTACT_TOPICS = [
  "Early access",
  "Feedback",
  "Partnership",
  "Press",
  "Other",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_LIMITS = {
  nameMax: 100,
  emailMax: 254,
  subjectMax: 150,
  messageMin: 10,
  messageMax: 5000,
  /** Messages one sender (by hashed IP) may send per window. */
  perWindow: 5,
  windowMs: 60 * 60 * 1000,
} as const;

/**
 * Browsers allowed to call the endpoint. Add the website's real domain here
 * once it is hosted (e.g. "https://amica.lk").
 */
export const CONTACT_ALLOWED_ORIGINS: Array<string | RegExp> = [
  "https://amica-cloud-backend.web.app",
  "https://amica-cloud-backend.firebaseapp.com",
  /^https:\/\/[a-z0-9-]+--amica-cloud-backend\.web\.app$/, // Hosting preview channels
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, // local development
  // Website on Vercel: production (amica-website.vercel.app) and preview deployments.
  /^https:\/\/amica[a-z0-9-]*\.vercel\.app$/,
];

export interface ContactMessageInput {
  name: string;
  email: string;
  topic: ContactTopic;
  subject: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: ContactMessageInput }
  | { ok: false; errors: string[] };

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/** Collapse whitespace and strip control characters from a one-line field. */
export function cleanLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Keep line breaks in the message body, drop other control characters. */
export function cleanBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function normaliseTopic(value: unknown): ContactTopic {
  const topic = cleanLine(value);
  return (CONTACT_TOPICS as readonly string[]).includes(topic)
    ? (topic as ContactTopic)
    : "Other";
}

/** True when the hidden honeypot field was filled in, i.e. a bot. */
export function isSpamSubmission(body: Record<string, unknown>): boolean {
  return cleanLine(body._honey).length > 0;
}

function isConsentGiven(value: unknown): boolean {
  return value === true || value === "on" || value === "true" || value === "yes";
}

/**
 * Accepts the fields the website sends (JSON or a normal form post). Field
 * names are matched case-insensitively so `Name` and `name` both work.
 */
export function validateContactMessage(raw: unknown): ValidationResult {
  const body = lowerKeys(raw);
  const errors: string[] = [];

  const name = cleanLine(body.name);
  const email = cleanLine(body.email).toLowerCase();
  const topic = normaliseTopic(body.topic ?? body["interested in"]);
  const message = cleanBody(body.message);
  const subject = cleanLine(body.subject) || `${topic} enquiry`;

  if (!name) errors.push("Please add your name.");
  else if (name.length > CONTACT_LIMITS.nameMax) errors.push("Your name is too long.");

  if (!email || email.length > CONTACT_LIMITS.emailMax || !EMAIL_PATTERN.test(email)) {
    errors.push("Please add a valid email address.");
  }

  if (subject.length > CONTACT_LIMITS.subjectMax) errors.push("The subject is too long.");

  if (message.length < CONTACT_LIMITS.messageMin) {
    errors.push(`Please write a message of at least ${CONTACT_LIMITS.messageMin} characters.`);
  } else if (message.length > CONTACT_LIMITS.messageMax) {
    errors.push(`Please keep your message under ${CONTACT_LIMITS.messageMax} characters.`);
  }

  if ("consent" in body && !isConsentGiven(body.consent)) {
    errors.push("Please agree that we can contact you about this message.");
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: { name, email, topic, subject, message } };
}

function lowerKeys(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      out[key.toLowerCase()] = value;
    }
  }
  return out;
}

/** One-way hash of the sender's IP so we can rate-limit without storing it. */
export function hashIp(ip: string | undefined, salt = "amica-contact"): string {
  return createHash("sha256").update(`${salt}:${ip ?? "unknown"}`).digest("hex").slice(0, 32);
}

/** First address in X-Forwarded-For, falling back to the socket address. */
export function clientIp(forwardedFor: unknown, fallback: string | undefined): string | undefined {
  const header = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (typeof header === "string" && header.trim()) {
    return header.split(",")[0].trim();
  }
  return fallback;
}

export interface RateWindow {
  windowStart: number; // epoch ms
  count: number;
}

/**
 * Fixed-window rate limit. Returns the window to store and whether this
 * message is allowed.
 */
export function nextRateWindow(
  current: RateWindow | undefined,
  nowMs: number,
  limit: number = CONTACT_LIMITS.perWindow,
  windowMs: number = CONTACT_LIMITS.windowMs,
): { allowed: boolean; window: RateWindow } {
  if (!current || nowMs - current.windowStart >= windowMs) {
    return { allowed: true, window: { windowStart: nowMs, count: 1 } };
  }
  if (current.count >= limit) {
    return { allowed: false, window: current };
  }
  return { allowed: true, window: { windowStart: current.windowStart, count: current.count + 1 } };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ContactEmail {
  subject: string;
  text: string;
  html: string;
  replyTo: { name: string; address: string };
}

/** The email the team receives for one website message. */
export function buildContactEmail(
  msg: ContactMessageInput,
  meta: { id: string; receivedAt: Date; page?: string },
): ContactEmail {
  const received = meta.receivedAt.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const subject = (msg.subject === `${msg.topic} enquiry`
    ? `[Amica website] ${msg.subject}`
    : `[Amica website] ${msg.topic}: ${msg.subject}`).slice(0, 200);

  const rows: Array<[string, string]> = [
    ["Name", msg.name],
    ["Email", msg.email],
    ["Interested in", msg.topic],
    ["Subject", msg.subject],
    ["Received", `${received} (Sri Lanka time)`],
  ];
  if (meta.page) rows.push(["Sent from", meta.page]);

  const text = [
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Message:",
    msg.message,
    "",
    `— Reply to this email to answer ${msg.name} directly.`,
    `Reference: contact_messages/${meta.id}`,
  ].join("\n");

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 14px;color:#5E4C6E;font-weight:600;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td>` +
        `<td style="padding:8px 14px;color:#2B1B3A">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#FAF7FF;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7FF;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #E9E2F3">
<tr><td style="background:linear-gradient(135deg,#7C4DEB,#B84A9C);background-color:#7C4DEB;padding:22px 24px;color:#fff">
<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.85">New message · Amica website</div>
<div style="font-size:22px;font-weight:700;margin-top:6px">${escapeHtml(msg.subject)}</div></td></tr>
<tr><td style="padding:14px 10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rowHtml}</table></td></tr>
<tr><td style="padding:10px 24px 6px"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#665577;font-weight:700">Message</div>
<div style="margin-top:8px;padding:16px;border-radius:12px;background:#F2EEFA;color:#2B1B3A;font-size:15px;line-height:1.55;white-space:pre-wrap">${escapeHtml(msg.message)}</div></td></tr>
<tr><td style="padding:14px 24px 22px;color:#665577;font-size:12.5px">Press <b>Reply</b> to answer ${escapeHtml(msg.name)} directly.<br>Reference: contact_messages/${escapeHtml(meta.id)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html, replyTo: { name: msg.name, address: msg.email } };
}
