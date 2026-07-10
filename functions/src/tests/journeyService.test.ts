import {
  buildCurrentLocationPayload,
  buildJourneyPayload,
  updateJourneyStatusPayload,
  validateJourneyInput,
} from "../services/journeyService";

export function journeyServiceSmokeTest(): boolean {
  // TODO: Replace with Firestore emulator tests when journey triggers are added.
  const startLocation = {
    latitude: 6.9271,
    longitude: 79.8612,
    address: "Colombo",
  };
  const payload = buildJourneyPayload(
    {
      startLocation,
      destinationName: "Campus",
      estimatedDurationMinutes: 20,
    },
    "sample-user-1",
  );
  const currentLocation = buildCurrentLocationPayload(startLocation);
  const safeStatus = updateJourneyStatusPayload("safe");

  return (
    validateJourneyInput({ userId: "sample-user-1", startLocation }).isValid &&
    payload.journeyType === "walk" &&
    payload.status === "active" &&
    payload.safetyCheck?.required === true &&
    payload.safetyCheck?.responseDeadlineSeconds === 30 &&
    payload.estimatedDurationMinutes === 20 &&
    payload.destination?.name === "Campus" &&
    currentLocation.updatedAt !== undefined &&
    safeStatus.status === "safe" &&
    safeStatus.actualEndTime !== undefined
  );
}
