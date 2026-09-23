import {
  MAX_ROUTE_FACTOR,
  MIN_ROUTE_FACTOR,
  buildRouteEstimate,
  clampRouteFactor,
  parseDirectionsRoute,
  readJourneyRouteMode,
} from "../services/routeService";
import { distanceInMeters } from "../utils/locationUtils";

export function routeServiceSmokeTest(): boolean {
  // Colombo Fort to Malabe, roughly 12 km apart in a straight line.
  const origin = { latitude: 6.9344, longitude: 79.8428 };
  const destination = { latitude: 6.9036, longitude: 79.9547 };

  const straightLine = distanceInMeters(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
  const straightLineIsSane = straightLine > 11000 && straightLine < 14000;

  // A road 1.4x longer than the straight line gives that factor back.
  const estimate = buildRouteEstimate(origin, destination, straightLine * 1.4);
  const factorIsMeasured =
    Math.abs(estimate.routeFactor - 1.4) < 0.001 &&
    Math.abs(estimate.straightLineMeters - straightLine) < 0.001;

  // A road cannot be shorter than the straight line, so anything at or below
  // 1 falls back to neutral.
  const clampsLow =
    clampRouteFactor(0.5) === MIN_ROUTE_FACTOR &&
    clampRouteFactor(1) === MIN_ROUTE_FACTOR &&
    clampRouteFactor(Number.NaN) === MIN_ROUTE_FACTOR;

  // An implausible factor is capped so a bad reading cannot delay the alarm.
  const clampsHigh =
    clampRouteFactor(9) === MAX_ROUTE_FACTOR &&
    buildRouteEstimate(origin, destination, straightLine * 50).routeFactor ===
      MAX_ROUTE_FACTOR;

  // Two points on top of each other give a neutral factor, not a blow-up.
  const samePoint = buildRouteEstimate(origin, origin, 0);
  const handlesSamePoint =
    samePoint.routeFactor === MIN_ROUTE_FACTOR &&
    Number.isFinite(samePoint.straightLineMeters);

  return (
    straightLineIsSane &&
    factorIsMeasured &&
    clampsLow &&
    clampsHigh &&
    handlesSamePoint
  );
}

export function journeyRouteSmokeTest(): boolean {
  const body = {
    status: "OK",
    routes: [
      {
        summary: "Galle Rd",
        overview_polyline: { points: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
        legs: [
          { distance: { value: 1200 }, duration: { value: 900 } },
          { distance: { value: 300 }, duration: { value: 240 } },
        ],
      },
    ],
  };
  const route = parseDirectionsRoute(body, "walking");
  const parsesRoute =
    route !== null &&
    route.distanceMeters === 1500 &&
    route.durationSeconds === 1140 &&
    route.summary === "Galle Rd" &&
    route.mode === "walking";

  const rejectsBadBodies =
    parseDirectionsRoute({ status: "ZERO_RESULTS", routes: [] }, "walking") ===
      null &&
    parseDirectionsRoute(null, "walking") === null &&
    parseDirectionsRoute(
      { status: "OK", routes: [{ legs: [], overview_polyline: { points: "x" } }] },
      "walking",
    ) === null;

  const modeDefaultsToWalking =
    readJourneyRouteMode(undefined) === "walking" &&
    readJourneyRouteMode("transit") === "walking" &&
    readJourneyRouteMode("driving") === "driving";

  return parsesRoute && rejectsBadBodies && modeDefaultsToWalking;
}
