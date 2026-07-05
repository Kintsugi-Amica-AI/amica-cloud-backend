import { isValidCoordinates } from "../utils/locationUtils";

export function vehicleServiceSmokeTest(): boolean {
  // TODO: Replace with Firestore emulator vehicle lookup tests.
  return isValidCoordinates({ latitude: 6.9271, longitude: 79.8612 });
}
