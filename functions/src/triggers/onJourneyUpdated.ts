import { onDocumentUpdated } from "firebase-functions/v2/firestore";

import { COLLECTIONS } from "../constants/collectionNames";
import { sendJourneySafetyCheck } from "../services/notificationService";

export const onJourneyUpdated = onDocumentUpdated(
  `${COLLECTIONS.journeys}/{journeyId}`,
  async (event) => {
    const after = event.data?.after.data();
    if (!after?.userId || after.status !== "expired") {
      return;
    }

    await sendJourneySafetyCheck(String(after.userId), event.params.journeyId);
  },
);
