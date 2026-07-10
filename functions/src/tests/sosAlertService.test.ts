import { ALERT_TYPES } from "../constants/alertTypes";
import {
  buildManualSosPayload,
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
  const manualAlert = buildManualSosPayload(
    "sample-user-1",
    {
      latitude: 6.9271,
      longitude: 79.8612,
      address: "Colombo",
    },
    "sample-journey-1",
  );

  return (
    isSupportedAlertType(ALERT_TYPES.manual) &&
    normalizeAlertType("not-supported") === ALERT_TYPES.unknown &&
    normalizedAlert.status === "active" &&
    normalizedAlert.evidence.voicePhraseDetected === true &&
    manualAlert.triggerType === ALERT_TYPES.manual &&
    manualAlert.status === "active" &&
    manualAlert.message === "I need help. This is my live location." &&
    manualAlert.location?.latitude === 6.9271
  );
}
