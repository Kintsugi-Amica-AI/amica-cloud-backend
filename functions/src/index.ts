import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

import {
  estimateRoute,
  fetchJourneyRoute,
  readJourneyRouteMode,
} from "./services/routeService";
import { planTransitTrip, readTransitMode } from "./services/transitService";
import { isValidLatitude, isValidLongitude } from "./utils/locationUtils";

export { onJourneyUpdated } from "./triggers/onJourneyUpdated";
export { onSosAlertCreated } from "./triggers/onSosAlertCreated";
export { onVehicleReviewCreated } from "./triggers/onVehicleReviewCreated";
export { onVehicleSafetyEventCreated } from "./triggers/onVehicleSafetyEventCreated";
export { onVehicleObservationCreated } from "./triggers/onVehicleObservationCreated";
export { onVehicleImageUploaded } from "./triggers/onVehicleImageUploaded";
export { onSosAudioUploaded } from "./triggers/onSosAudioUploaded";

// Watch-my-journey-live links and push alerts for contacts who have Amica.
export { startJourneyShare } from "./callables/liveShareCallables";
export {
  acceptGuardianInvite,
  createGuardianInvite,
  listGuarding,
  respondToAlert,
  unlinkGuardian,
} from "./callables/guardianCallables";
export { liveJourney } from "./http/liveJourney";

// Contact form on the Amica website: store the message, then email the team.
export { submitContactMessage } from "./http/submitContactMessage";
export { onContactMessageCreated } from "./triggers/onContactMessageCreated";

/**
 * Road distance between two points, for the mobile Smart Stop Alert.
 *
 * Called once when a rider starts a bus ride, while they still have signal.
 * The device then applies the returned `routeFactor` offline for the rest of
 * the journey, so the alarm never depends on the network.
 *
 * Returns `{ available: false }` rather than failing when Directions has no
 * answer or no key is configured. The app treats that as "stay with
 * straight-line distance", which is how the feature behaves without it.
 */
export const getRouteDistance = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to estimate a route.");
  }

  const { originLatitude, originLongitude, destinationLatitude, destinationLongitude } =
    (request.data ?? {}) as Record<string, unknown>;

  if (
    !isValidLatitude(originLatitude) ||
    !isValidLongitude(originLongitude) ||
    !isValidLatitude(destinationLatitude) ||
    !isValidLongitude(destinationLongitude)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Origin and destination coordinates are required.",
    );
  }

  const estimate = await estimateRoute(
    {
      latitude: originLatitude as number,
      longitude: originLongitude as number,
    },
    {
      latitude: destinationLatitude as number,
      longitude: destinationLongitude as number,
    },
  );

  if (!estimate) {
    return { available: false };
  }

  return {
    available: true,
    roadDistanceMeters: estimate.roadDistanceMeters,
    straightLineMeters: estimate.straightLineMeters,
    routeFactor: estimate.routeFactor,
  };
});

/**
 * Suggested route between two points for a Walk/Ride with me journey: the
 * travel time Directions predicts, the distance, and an encoded polyline the
 * app draws on the map.
 *
 * `mode` is "walking" (default) or "driving". Returns `{ available: false }`
 * rather than failing when no route is available, so the app can fall back to
 * its straight-line estimate.
 */
export const getJourneyRoute = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to get a route.");
  }

  const {
    originLatitude,
    originLongitude,
    destinationLatitude,
    destinationLongitude,
    mode,
  } = (request.data ?? {}) as Record<string, unknown>;

  if (
    !isValidLatitude(originLatitude) ||
    !isValidLongitude(originLongitude) ||
    !isValidLatitude(destinationLatitude) ||
    !isValidLongitude(destinationLongitude)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Origin and destination coordinates are required.",
    );
  }

  const route = await fetchJourneyRoute(
    {
      latitude: originLatitude as number,
      longitude: originLongitude as number,
    },
    {
      latitude: destinationLatitude as number,
      longitude: destinationLongitude as number,
    },
    readJourneyRouteMode(mode),
  );

  if (!route) {
    return { available: false };
  }

  return { available: true, ...route };
});

/**
 * Bus / train trip plan: which stop to get on at, which to get off at, and
 * the walks to and from them. Used by Walk/Ride with me (bus or train
 * journeys) and by the Smart Stop Alert, which alarms for the get-off stop.
 *
 * `mode` is "bus" (default) or "train". Optional `boardStopId` /
 * `alightStopId` pick one of the returned candidate stops instead of the
 * nearest. Returns `{ available: false, reason }` rather than failing.
 */
export const getTransitPlan = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to plan a trip.");
  }

  const {
    originLatitude,
    originLongitude,
    destinationLatitude,
    destinationLongitude,
    mode,
    boardStopId,
    alightStopId,
  } = (request.data ?? {}) as Record<string, unknown>;

  if (
    !isValidLatitude(originLatitude) ||
    !isValidLongitude(originLongitude) ||
    !isValidLatitude(destinationLatitude) ||
    !isValidLongitude(destinationLongitude)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Origin and destination coordinates are required.",
    );
  }

  const result = await planTransitTrip(
    { latitude: originLatitude as number, longitude: originLongitude as number },
    {
      latitude: destinationLatitude as number,
      longitude: destinationLongitude as number,
    },
    readTransitMode(mode),
    boardStopId,
    alightStopId,
  );

  return result.available
    ? { available: true, ...result.plan }
    : { available: false, reason: result.reason };
});

export const healthCheck = onRequest((_request, response) => {
  response.json({
    service: "amica-cloud-backend",
    status: "ok",
  });
});
