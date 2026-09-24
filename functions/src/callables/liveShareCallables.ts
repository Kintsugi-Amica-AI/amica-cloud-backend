import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  buildShareUrl,
  firstName,
  generateShareToken,
  isSmsSafeShareToken,
  shareFieldsFromJourney,
} from "../services/liveShareService";
import {
  buildJourneyStartedPush,
  linkedGuardians,
  ownerProfile,
  sendPushToUsers,
} from "../services/pushService";

/**
 * Creates (or returns) the "watch my journey live" link for one journey.
 *
 * With `notifyCircle`, linked guardians also get a push with the link. The
 * app texts the link itself to everyone else, and skips the contacts listed
 * in `pushedContactIds` so nobody pays for an SMS they already got for free.
 */
export const startJourneyShare = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to share a journey.");
  }
  const { journeyId, notifyCircle } = (request.data ?? {}) as Record<string, unknown>;
  if (typeof journeyId !== "string" || !journeyId || journeyId.includes("/")) {
    throw new HttpsError("invalid-argument", "journeyId is required.");
  }

  const db = getFirestore();
  const journeyRef = db.collection(COLLECTIONS.journeys).doc(journeyId);
  const journey = (await journeyRef.get()).data();
  if (!journey || journey.userId !== uid) {
    throw new HttpsError("not-found", "Journey not found.");
  }
  if (journey.status !== "active" && journey.status !== "sos") {
    throw new HttpsError("failed-precondition", "This journey has already ended.");
  }

  const owner = await ownerProfile(uid);
  const now = new Date();
  let token: string | null =
    typeof journey.liveShare?.token === "string" ? journey.liveShare.token : null;
  // A journey shared before the letters-only change keeps an old token that
  // may not survive SMS, so give it a fresh one.
  if (token && !isSmsSafeShareToken(token)) {
    token = null;
  }
  if (token) {
    const existing = (await db.collection(COLLECTIONS.liveShares).doc(token).get()).data();
    if (!existing || existing.journeyId !== journeyId || existing.userId !== uid) {
      token = null;
    }
  }

  if (!token) {
    token = generateShareToken();
    await db.collection(COLLECTIONS.liveShares).doc(token).create({
      token,
      userId: uid,
      journeyId,
      ownerName: firstName(owner.name),
      ...shareFieldsFromJourney(journey, now),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  const url = buildShareUrl(token);
  let pushedContactIds: string[] = [];
  if (notifyCircle === true) {
    const guardians = await linkedGuardians(uid);
    const destinationName =
      typeof journey.destination?.name === "string" ? journey.destination.name : "";
    const reached = await sendPushToUsers(
      guardians.map((g) => g.guardianUid),
      buildJourneyStartedPush({
        journeyId,
        ownerUid: uid,
        ownerName: firstName(owner.name),
        ownerPhone: owner.phone,
        destinationName,
        liveUrl: url,
      }),
    );
    pushedContactIds = guardians
      .filter((g) => reached.has(g.guardianUid))
      .map((g) => g.contactId);
  }

  await journeyRef.update({
    liveShare: {
      token,
      url,
      createdAt: journey.liveShare?.createdAt ?? now.toISOString(),
      ...(notifyCircle === true
        ? { pushedAt: now.toISOString() }
        : journey.liveShare?.pushedAt
          ? { pushedAt: journey.liveShare.pushedAt }
          : {}),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { token, url, pushedContactIds };
});
