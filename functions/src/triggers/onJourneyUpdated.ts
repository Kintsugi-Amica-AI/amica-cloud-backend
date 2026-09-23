import { onDocumentUpdated } from "firebase-functions/v2/firestore";

import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { shareFieldsFromJourney } from "../services/liveShareService";
import {
  sendJourneyArrived,
  sendJourneySafetyCheck,
} from "../services/notificationService";

export const onJourneyUpdated = onDocumentUpdated(
  `${COLLECTIONS.journeys}/{journeyId}`,
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const journeyId = event.params.journeyId;
    if (!after?.userId) {
      return;
    }

    await mirrorLiveShare(journeyId, after);

    // Guardians who were sent the live link hear that she arrived.
    if (
      before?.status !== "safe" &&
      after.status === "safe" &&
      after.liveShare?.pushedAt
    ) {
      const destinationName =
        typeof after.destination?.name === "string" ? after.destination.name : "";
      await sendJourneyArrived(String(after.userId), journeyId, destinationName);
    }

    if (after.status === "expired") {
      await sendJourneySafetyCheck(String(after.userId), journeyId);
    }
  },
);

/**
 * Copies where she is (and whether the journey is still going) onto the
 * journey's live share, so the public page follows without the app writing
 * anything twice.
 */
export async function mirrorLiveShare(
  journeyId: string,
  journey: Record<string, unknown>,
): Promise<void> {
  const liveShare = journey.liveShare as { token?: unknown } | undefined;
  const token = liveShare?.token;
  if (typeof token !== "string" || !token) {
    return;
  }

  const shareRef = getFirestore().collection(COLLECTIONS.liveShares).doc(token);
  const share = (await shareRef.get()).data();
  // Only the share this journey created: a token copied from somewhere else
  // must never let one journey overwrite another's page.
  if (!share || share.journeyId !== journeyId || share.userId !== journey.userId) {
    return;
  }
  // An ended share stays ended.
  if (share.status === "ended") {
    return;
  }

  await shareRef.update({
    ...shareFieldsFromJourney(journey, new Date()),
    updatedAt: new Date().toISOString(),
  });
}
