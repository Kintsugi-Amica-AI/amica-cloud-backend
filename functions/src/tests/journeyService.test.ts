import { JourneyModel } from "../models/journey.model";
import {
  buildCurrentLocationPayload,
  buildJourneyPayload,
  hasJourneyExpired,
  isStopAlertRide,
  normalizeJourney,
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
    payload.stopAlert === undefined &&
    currentLocation.updatedAt !== undefined &&
    safeStatus.status === "safe" &&
    safeStatus.actualEndTime !== undefined
  );
}

/**
 * Covers Smart Stop Alert rides, which share the `journeys` collection with
 * timer journeys but must never be treated as one.
 */
export function journeyStopAlertSmokeTest(): boolean {
  const startLocation = {
    latitude: 6.9344,
    longitude: 79.8428,
    address: "Colombo Fort",
  };

  const ride = buildJourneyPayload(
    {
      journeyType: "bus",
      startLocation,
      destination: {
        latitude: 6.9036,
        longitude: 79.9547,
        address: "Malabe",
        name: "Malabe",
      },
      // A rider cannot predict a bus journey's length, so these rides send 0.
      estimatedDurationMinutes: 0,
      stopAlert: { enabled: true, alertDistanceMeters: 2000 },
    },
    "sample-user-1",
  );

  const buildsRide =
    isStopAlertRide(ride) &&
    ride.journeyType === "bus" &&
    ride.stopAlert?.alertDistanceMeters === 2000 &&
    ride.stopAlert?.alertedAt === null &&
    // No invented countdown, and no safety check to answer for.
    ride.estimatedDurationMinutes === 0 &&
    ride.safetyCheck?.required === false;

  // A zero duration is valid for a stop alert ride and invalid otherwise.
  const validatesDuration =
    validateJourneyInput({
      userId: "sample-user-1",
      estimatedDurationMinutes: 0,
      stopAlert: { enabled: true },
    }).isValid &&
    !validateJourneyInput({
      userId: "sample-user-1",
      estimatedDurationMinutes: 0,
    }).isValid;

  // Normalizing must carry the alarm settings through, not drop them.
  const normalized = normalizeJourney(
    {
      userId: "sample-user-1",
      journeyType: "bus",
      status: "active",
      stopAlert: { enabled: true, alertDistanceMeters: 3000, alertedAt: null },
    },
    "journey-2",
  );
  const preservesStopAlert =
    isStopAlertRide(normalized) &&
    normalized.stopAlert?.alertDistanceMeters === 3000;

  const normalizedTimerJourney = normalizeJourney(
    { userId: "sample-user-1", status: "active" },
    "journey-1",
  );
  const leavesTimerJourneysAlone =
    !isStopAlertRide(normalizedTimerJourney) &&
    normalizedTimerJourney.stopAlert === undefined;

  // A stop alert ride must never read as expired, or onJourneyUpdated would
  // send the rider a safety check seconds after boarding.
  const pastEndTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const expiredRide: JourneyModel = {
    ...ride,
    estimatedEndTime: pastEndTime,
  };
  const timerJourney: JourneyModel = {
    ...ride,
    stopAlert: undefined,
    estimatedEndTime: pastEndTime,
  };
  const expiryIsCorrect =
    !hasJourneyExpired(expiredRide) && hasJourneyExpired(timerJourney);

  return (
    buildsRide &&
    validatesDuration &&
    preservesStopAlert &&
    leavesTimerJourneysAlone &&
    expiryIsCorrect
  );
}
