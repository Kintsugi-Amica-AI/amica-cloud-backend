import admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import nodemailer from "nodemailer";

import { COLLECTIONS } from "../constants/collectionNames";
import {
  ContactMessageInput,
  buildContactEmail,
} from "../services/contactMessageService";

/**
 * Gmail account that sends the notification emails, and its App Password.
 * Set once with:
 *   firebase functions:secrets:set CONTACT_SMTP_PASSWORD
 * (see docs/contact_form_setup.md).
 */
const SMTP_PASSWORD = defineSecret("CONTACT_SMTP_PASSWORD");
const SMTP_USER = defineString("CONTACT_SMTP_USER", {
  default: "teamkintsugi2026@gmail.com",
  description: "Gmail address that sends contact-form notifications.",
});
/** Where website messages are delivered. Comma-separate to notify several people. */
const CONTACT_INBOX = defineString("CONTACT_INBOX", {
  default: "teamkintsugi2026@gmail.com",
  description: "Inbox that receives Amica website contact-form messages.",
});

/**
 * Emails each new website message to the team inbox. The Firestore document
 * records the outcome (`delivery.state` = sent | error), so failed deliveries
 * can be seen and retried from the Firebase console.
 */
export const onContactMessageCreated = onDocumentCreated(
  {
    document: `${COLLECTIONS.contactMessages}/{messageId}`,
    secrets: [SMTP_PASSWORD],
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

    const user = SMTP_USER.value();
    try {
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass: SMTP_PASSWORD.value() },
      });
      const info = await transport.sendMail({
        from: { name: "Amica website", address: user },
        to: CONTACT_INBOX.value(),
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
