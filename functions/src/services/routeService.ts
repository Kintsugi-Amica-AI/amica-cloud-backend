import { distanceInMeters } from "../utils/locationUtils";

/**
 * Road distance for the Smart Stop Alert.
 *
 * The mobile alarm runs on-device against straight-line distance, because a
 * bus goes through tunnels and dead zones and the alarm must not depend on a
 * network call. What it cannot do on its own is tell how much further the road
 * winds than the straight line, so this service resolves that once, before the
 * ride starts, and returns a factor the device can apply offline for the rest
 * of the journey.
 *
 * The Directions API key lives here rather than in the app: a web-service key
 * cannot be restricted to an Android signature, so shipping one in the APK
 * would expose a billable key to anyone who unpacked it.
 */

/** Lower bound: a road can never be shorter than the straight line. */
export const MIN_ROUTE_FACTOR = 1;

/**
 * Upper bound. A larger measured factor shrinks the on-device alarm radius far
 * enough that a bad reading could delay the alarm, so it is capped. Capping low
 * makes the alarm sound early rather than late, which is the safe direction for
 * a rider who needs the warning.
 */
export const MAX_ROUTE_FACTOR = 2;

export interface RouteEstimate {
  /** Straight-line distance between the two points, in metres. */
  straightLineMeters: number;
  /** Distance along the road, in metres, when Directions answered. */
  roadDistanceMeters: number;
  /** roadDistanceMeters / straightLineMeters, clamped to a safe range. */
  routeFactor: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

/**
 * Clamps a measured road-to-straight-line ratio into the range the alarm
 * trusts. Anything at or below 1, and any non-finite value, falls back to 1,
 * which leaves the alarm behaving exactly as it does with no route data.
 */
export function clampRouteFactor(factor: number): number {
  if (!Number.isFinite(factor) || factor <= MIN_ROUTE_FACTOR) {
    return MIN_ROUTE_FACTOR;
  }
  return Math.min(factor, MAX_ROUTE_FACTOR);
}

export function buildRouteEstimate(
  origin: RoutePoint,
  destination: RoutePoint,
  roadDistanceMeters: number,
): RouteEstimate {
  const straightLineMeters = distanceInMeters(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  // Two points close enough together give a meaningless ratio, so the factor
  // stays neutral rather than exploding.
  const routeFactor =
    straightLineMeters < 1
      ? MIN_ROUTE_FACTOR
      : clampRouteFactor(roadDistanceMeters / straightLineMeters);

  return {
    straightLineMeters,
    roadDistanceMeters,
    routeFactor,
  };
}

function directionsApiKey(): string | undefined {
  const key = process.env.GOOGLE_DIRECTIONS_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

/**
 * Asks the Directions API how far the road actually runs between two points.
 *
 * Returns null whenever an answer is not available — no key configured, a
 * network failure, or no route found. Null is an expected outcome, not an
 * error: the caller falls back to straight-line distance, which is how the
 * feature behaved before road distance existed.
 */
export async function fetchRoadDistanceMeters(
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<number | null> {
  const key = directionsApiKey();
  if (!key) {
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set(
    "destination",
    `${destination.latitude},${destination.longitude}`,
  );
  // `transit` would need a departure time and fails outside supported cities,
  // so driving is used as the stand-in for the road a bus follows.
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      status?: string;
      routes?: { legs?: { distance?: { value?: number } }[] }[];
    };

    if (body.status !== "OK") {
      return null;
    }

    const legs = body.routes?.[0]?.legs ?? [];
    const total = legs.reduce((sum, leg) => {
      const value = leg.distance?.value;
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

    return total > 0 ? total : null;
  } catch {
    // Directions is a nice-to-have. Never let it fail a ride.
    return null;
  }
}

/**
 * Full estimate for a ride, or null when road distance is unavailable and the
 * caller should stay with straight-line distance.
 */
export async function estimateRoute(
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<RouteEstimate | null> {
  const roadDistanceMeters = await fetchRoadDistanceMeters(origin, destination);
  if (roadDistanceMeters === null) {
    return null;
  }
  return buildRouteEstimate(origin, destination, roadDistanceMeters);
}
