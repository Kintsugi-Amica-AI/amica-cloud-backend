import { ALERT_TYPES } from "../constants/alertTypes";
import { isSupportedAlertType } from "../services/sosAlertService";

export function sosAlertServiceSmokeTest(): boolean {
  // TODO: Replace with Firebase emulator backed tests.
  return isSupportedAlertType(ALERT_TYPES.manualSosPressed);
}
