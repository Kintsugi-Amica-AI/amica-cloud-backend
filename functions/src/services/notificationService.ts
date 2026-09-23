import { FieldValue } from "firebase-admin/firestore";

import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  buildJourneyArrivedPush,
  buildSosPush,
  linkedGuardians,
  ownerProfile,
  sendPushToUsers,
} from "./pushService";

/**
 * Pushes a new SOS to every linked guardian.
 *
 * SMS still goes from her own phone (see the mobile CircleAlertService);
 * this is the faster, free channel for contacts who also have Amica, and the
 * one that lets them answer with a tap. Retries of the trigger are harmless:
 * `push.sentAt` is checked first.
 */
export async function sendSosNotifications(userId: string, alertId: string): Promise<void> {
  const db = getFirestore();
  const alertRef = db.collection(COLLECTIONS.sosAlerts).doc(alertId);
  const alert = (await alertRef.get()).data();
  if (!alert || alert.userId !== userId || alert.push?.sentAt) {
    return;
  }

  const guardians = await linkedGuardians(userId);
  if (guardians.length === 0) {
    return;
  }

  const owner = await ownerProfile(userId);
  let liveUrl: string | null = null;
  if (typeof alert.journeyId === "string" && alert.journeyId) {
    const journey = (await db.collection(COLLECTIONS.journeys).doc(alert.journeyId).get()).data();
    if (journey?.userId === userId && typeof journey.liveShare?.url === "string") {
      liveUrl = journey.liveShare.url;
    }
  }

  const location = alert.location ?? {};
  const message = buildSosPush({
    alertId,
    ownerUid: userId,
    ownerName: owner.firstName,
    ownerPhone: owner.phone,
    triggerType: typeof alert.triggerType === "string" ? alert.triggerType : "manual",
    latitude: typeof location.latitude === "number" ? location.latitude : undefined,
    longitude: typeof location.longitude === "number" ? location.longitude : undefined,
    liveUrl,
  });

  const reached = await sendPushToUsers(guardians.map((g) => g.guardianUid), message);
  await alertRef.update({
    push: {
      sentAt: FieldValue.serverTimestamp(),
      reachedContactIds: guardians
        .filter((g) => reached.has(g.guardianUid))
        .map((g) => g.contactId),
    },
  });
}

/** Tells guardians who were watching a journey that she got there. */
export async function sendJourneyArrived(userId: string, journeyId: string, destinationName: string): Promise<void> {
  const guardians = await linkedGuardians(userId);
  if (guardians.length === 0) {
    return;
  }
  const owner = await ownerProfile(userId);
  await sendPushToUsers(
    guardians.map((g) => g.guardianUid),
    buildJourneyArrivedPush({
      journeyId,
      ownerUid: userId,
      ownerName: owner.firstName,
      destinationName,
    }),
  );
}

export async function sendJourneySafetyCheck(userId: string, journeyId: string): Promise<void> {
  // TODO: Notify the user before escalating an expired journey.
  console.info("Journey safety check placeholder", { userId, journeyId });
}
