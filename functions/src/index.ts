import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

import {
  estimateRoute,
  fetchJourneyRoute,
  readJourneyRouteMode,
} from "./services/routeService";
import { isValidLatitude, isValidLongitude } from "./utils/locationUtils";

export { onJourneyUpdated } from "./triggers/onJourneyUpdated";
export { onSosAlertCreated } from "./triggers/onSosAlertCreated";
export { onVehicleReviewCreated } from "./triggers/onVehicleReviewCreated";
export { onVehicleSafetyEventCreated } from "./triggers/onVehicleSafetyEventCreated";

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

export const healthCheck = onRequest((_request, response) => {
  response.json({
    service: "amica-cloud-backend",
    status: "ok",
  });
});
