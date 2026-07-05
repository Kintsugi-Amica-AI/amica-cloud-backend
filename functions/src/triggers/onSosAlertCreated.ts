import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { COLLECTIONS } from "../constants/collectionNames";
import { sendSosNotifications } from "../services/notificationService";

export const onSosAlertCreated = onDocumentCreated(
  `${COLLECTIONS.sosAlerts}/{alertId}`,
  async (event) => {
    const data = event.data?.data();
    if (!data?.userId) {
      return;
    }

    await sendSosNotifications(String(data.userId), event.params.alertId);
  },
);
