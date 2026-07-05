import { ALERT_TYPES, AlertType } from "../constants/alertTypes";
import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { SosAlertModel } from "../models/sosAlert.model";

export function isSupportedAlertType(triggerType: string): triggerType is AlertType {
  return Object.values(ALERT_TYPES).includes(triggerType as AlertType);
}

export async function createSosAlert(alert: SosAlertModel): Promise<void> {
  // TODO: Add duplicate suppression and audit logging.
  await getFirestore().collection(COLLECTIONS.sosAlerts).doc(alert.id).set(alert);
}
