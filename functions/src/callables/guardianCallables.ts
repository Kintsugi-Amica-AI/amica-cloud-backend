import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  INVITE_TTL_MS,
  InviteRecord,
  generateInviteCode,
  inviteProblem,
  isGuardianResponse,
  normalizeInviteCode,
} from "../services/guardianService";
import { firstName } from "../services/liveShareService";
import {
  buildGuardianLinkedPush,
  buildGuardianResponsePush,
  ownerProfile,
  sendPushToUsers,
} from "../services/pushService";

function requireUid(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  return uid;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value;
}

/**
 * A single-use code for one of her contacts. Her phone texts it to that
 * contact, so whoever enters it has read an SMS sent to that number.
 */
export const createGuardianInvite = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const contactId = requireId((request.data ?? {}).contactId, "contactId");

  const db = getFirestore();
  const contact = (await db.collection(COLLECTIONS.emergencyContacts).doc(contactId).get()).data();
  if (!contact || contact.userId !== uid) {
    throw new HttpsError("not-found", "Contact not found.");
  }

  const owner = await ownerProfile(uid);
  const now = Date.now();
  const expiresAt = new Date(now + INVITE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      await db.collection(COLLECTIONS.guardianInvites).doc(code).create({
        code,
        userId: uid,
        contactId,
        contactName: typeof contact.name === "string" ? contact.name : "",
        ownerName: firstName(owner.name),
        createdAt: new Date(now).toISOString(),
        expiresAt,
        usedAt: null,
      });
      return { code, expiresAt };
    } catch (error) {
      // ALREADY_EXISTS: try another code.
      if ((error as { code?: number }).code !== 6) throw error;
    }
  }
  throw new HttpsError("unavailable", "Could not create a code. Try again.");
});

/** The contact's side: links their Amica account to her contact entry. */
export const acceptGuardianInvite = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const code = normalizeInviteCode((request.data ?? {}).code);
  if (!code) {
    throw new HttpsError("invalid-argument", "That code doesn't look right.");
  }

  const db = getFirestore();
  const guardian = await ownerProfile(uid);
  const guardianName =
    guardian.name || (typeof request.auth?.token.name === "string" ? request.auth.token.name : "");
  const inviteRef = db.collection(COLLECTIONS.guardianInvites).doc(code);

  const result = await db.runTransaction(async (transaction) => {
    const invite = (await transaction.get(inviteRef)).data() as InviteRecord & {
      ownerName?: string;
    } | undefined;
    const problem = inviteProblem(invite, uid, new Date());
    if (problem || !invite) {
      return { problem: problem ?? "not_found" };
    }
    const contactRef = db.collection(COLLECTIONS.emergencyContacts).doc(invite.contactId);
    const contact = (await transaction.get(contactRef)).data();
    if (!contact || contact.userId !== invite.userId) {
      return { problem: "not_found" as const };
    }
    transaction.update(contactRef, {
      guardianUid: uid,
      guardianName: firstName(guardianName),
      guardianLinkedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(inviteRef, {
      usedAt: new Date().toISOString(),
      usedBy: uid,
    });
    return {
      problem: null,
      ownerUid: invite.userId,
      ownerName: invite.ownerName ?? "",
      contactId: invite.contactId,
    };
  });

  if (result.problem) {
    const messages: Record<string, string> = {
      not_found: "That code doesn't match any invite.",
      expired: "That code has expired. Ask for a new one.",
      used: "That code has already been used.",
      own_invite: "That's your own invite. Send it to your contact instead.",
    };
    throw new HttpsError("failed-precondition", messages[result.problem], {
      reason: result.problem,
    });
  }

  await sendPushToUsers(
    [result.ownerUid as string],
    buildGuardianLinkedPush({
      contactId: result.contactId as string,
      guardianName: firstName(guardianName),
    }),
  ).catch(() => undefined);

  return { ownerName: result.ownerName };
});

/** The people whose alerts this account receives. */
export const listGuarding = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.emergencyContacts)
    .where("guardianUid", "==", uid)
    .get();

  const owners = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const owner = await ownerProfile(String(doc.data().userId));
      return { contactId: doc.id, ownerName: owner.firstName };
    }),
  );
  return { guarding: owners };
});

/** Unlinks a guardian. Either side may do it. */
export const unlinkGuardian = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const contactId = requireId((request.data ?? {}).contactId, "contactId");
  const ref = getFirestore().collection(COLLECTIONS.emergencyContacts).doc(contactId);
  const contact = (await ref.get()).data();
  if (!contact || (contact.userId !== uid && contact.guardianUid !== uid)) {
    throw new HttpsError("not-found", "Contact not found.");
  }
  await ref.update({
    guardianUid: FieldValue.delete(),
    guardianName: FieldValue.delete(),
    guardianLinkedAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/**
 * A guardian's one-tap reply to an SOS ("Calling now" / "I've alerted
 * others"). Saved on the alert, where her SOS screen shows it, and pushed to
 * her phone.
 */
export const respondToAlert = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const { alertId, response } = (request.data ?? {}) as Record<string, unknown>;
  const id = requireId(alertId, "alertId");
  if (!isGuardianResponse(response)) {
    throw new HttpsError("invalid-argument", "Unknown response.");
  }

  const db = getFirestore();
  const alertRef = db.collection(COLLECTIONS.sosAlerts).doc(id);
  const alert = (await alertRef.get()).data();
  if (!alert?.userId) {
    throw new HttpsError("not-found", "Alert not found.");
  }

  const link = await db
    .collection(COLLECTIONS.emergencyContacts)
    .where("userId", "==", alert.userId)
    .where("guardianUid", "==", uid)
    .limit(1)
    .get();
  if (link.empty) {
    throw new HttpsError("permission-denied", "You are not linked to this person.");
  }

  const guardianName =
    (link.docs[0].data().guardianName as string | undefined) ||
    (await ownerProfile(uid)).firstName;
  await alertRef.update({
    [`guardianResponses.${uid}`]: {
      contactId: link.docs[0].id,
      name: guardianName,
      response,
      at: new Date().toISOString(),
    },
  });

  await sendPushToUsers(
    [String(alert.userId)],
    buildGuardianResponsePush({ alertId: id, guardianName, response }),
  ).catch(() => undefined);

  return { ok: true };
});
