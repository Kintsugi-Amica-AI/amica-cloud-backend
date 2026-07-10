import {
  isValidLatitude,
  isValidLongitude,
  normalizeLocation,
  validateLocation,
} from "../utils/locationUtils";

export function locationUtilsSmokeTest(): boolean {
  // TODO: Add emulator-backed validation tests if location writes become complex.
  const validLocation = {
    latitude: 6.9271,
    longitude: 79.8612,
    address: "Colombo",
  };
  const normalized = normalizeLocation(validLocation);

  return (
    validateLocation(validLocation).isValid &&
    normalized.address === "Colombo" &&
    !validateLocation({ latitude: 100, longitude: 79.8612 }).isValid &&
    !validateLocation({ latitude: 6.9271, longitude: 200 }).isValid &&
    isValidLatitude(6.9271) &&
    !isValidLatitude(100) &&
    isValidLongitude(79.8612) &&
    !isValidLongitude(200)
  );
}
