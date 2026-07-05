import { ALERT_TYPES } from "../constants/alertTypes";
import {
  isSupportedAlertType,
  normalizeAlertType,
  normalizeSosAlert,
} from "../services/sosAlertService";

export function sosAlertServiceSmokeTest(): boolean {
  // TODO: Replace with Firebase emulator backed tests.
  const normalizedAlert = normalizeSosAlert(
    {
      userId: "sample-user-1",
      triggerType: ALERT_TYPES.manual,
      evidence: {
        voicePhraseDetected: true,
      },
    },
    "sample-alert-1",
  );

  return (
    isSupportedAlertType(ALERT_TYPES.manual) &&
    normalizeAlertType("not-supported") === ALERT_TYPES.unknown &&
    normalizedAlert.status === "active" &&
    normalizedAlert.evidence.voicePhraseDetected === true
  );
}
