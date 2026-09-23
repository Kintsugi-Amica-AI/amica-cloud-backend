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

/**
 * Travel mode for a Walk/Ride with me journey route. Transit is left out on
 * purpose: Directions needs a departure time for it and returns nothing in
 * many Sri Lankan areas, so buses and trains use the road route instead.
 */
export type JourneyRouteMode = "walking" | "driving";

export interface JourneyRoute {
  mode: JourneyRouteMode;
  /** Distance along the suggested route, in metres. */
  distanceMeters: number;
  /** Directions' own travel-time estimate for the route, in seconds. */
  durationSeconds: number;
  /** Google encoded polyline of the whole route, for drawing on the map. */
  polyline: string;
  /** Short name of the main road, e.g. "Galle Rd/A2", when Directions has one. */
  summary: string;
}

export function readJourneyRouteMode(value: unknown): JourneyRouteMode {
  return value === "driving" ? "driving" : "walking";
}

/**
 * Pulls the first route out of a Directions API response body, or returns null
 * when the body has no usable route. Kept pure so it can be tested without the
 * network.
 */
export function parseDirectionsRoute(
  body: unknown,
  mode: JourneyRouteMode,
): JourneyRoute | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const typed = body as {
    status?: string;
    routes?: {
      summary?: string;
      overview_polyline?: { points?: string };
      legs?: { distance?: { value?: number }; duration?: { value?: number } }[];
    }[];
  };
  if (typed.status !== "OK") {
    return null;
  }

  const route = typed.routes?.[0];
  const polyline = route?.overview_polyline?.points;
  if (!route || typeof polyline !== "string" || !polyline) {
    return null;
  }

  let distanceMeters = 0;
  let durationSeconds = 0;
  for (const leg of route.legs ?? []) {
    const distance = leg.distance?.value;
    const duration = leg.duration?.value;
    distanceMeters += typeof distance === "number" ? distance : 0;
    durationSeconds += typeof duration === "number" ? duration : 0;
  }
  if (distanceMeters <= 0 || durationSeconds <= 0) {
    return null;
  }

  return {
    mode,
    distanceMeters,
    durationSeconds,
    polyline,
    summary: typeof route.summary === "string" ? route.summary : "",
  };
}

/**
 * Pulls the first route out of a Routes API (computeRoutes) response body, or
 * returns null when there is none. Kept pure so it can be tested offline.
 */
export function parseRoutesApiRoute(
  body: unknown,
  mode: JourneyRouteMode,
): JourneyRoute | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const route = (
    body as {
      routes?: {
        distanceMeters?: number;
        duration?: string;
        description?: string;
        polyline?: { encodedPolyline?: string };
      }[];
    }
  ).routes?.[0];
  const polyline = route?.polyline?.encodedPolyline;
  const distanceMeters = route?.distanceMeters;
  // Duration comes back as a string of seconds, e.g. "1140s".
  const durationSeconds = Number.parseFloat(route?.duration ?? "");
  if (
    typeof polyline !== "string" ||
    !polyline ||
    typeof distanceMeters !== "number" ||
    distanceMeters <= 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }
  return {
    mode,
    distanceMeters,
    durationSeconds: Math.round(durationSeconds),
    polyline,
    summary: typeof route?.description === "string" ? route.description : "",
  };
}

/** The Routes API, which replaced Directions for new Google Cloud projects. */
async function fetchFromRoutesApi(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: JourneyRouteMode,
  key: string,
): Promise<JourneyRoute | null> {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.description,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: mode === "walking" ? "WALK" : "DRIVE",
        polylineEncoding: "ENCODED_POLYLINE",
      }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { status?: string; message?: string } })
      ?.error;
    console.warn(
      `getJourneyRoute: Routes API ${response.status} ${error?.status ?? ""}: ${error?.message ?? ""}`,
    );
    return null;
  }
  const route = parseRoutesApiRoute(body, mode);
  if (!route) {
    console.warn("getJourneyRoute: Routes API returned no route", body);
  }
  return route;
}

/** The legacy Directions API, for projects that still have it enabled. */
async function fetchFromDirectionsApi(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: JourneyRouteMode,
  key: string,
): Promise<JourneyRoute | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set(
    "destination",
    `${destination.latitude},${destination.longitude}`,
  );
  url.searchParams.set("mode", mode);
  url.searchParams.set("key", key);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json().catch(() => null)) as {
    status?: string;
    error_message?: string;
  } | null;
  const route = parseDirectionsRoute(body, mode);
  if (!route) {
    console.warn(
      `getJourneyRoute: Directions API ${response.status} ${body?.status ?? ""}: ${body?.error_message ?? ""}`,
    );
  }
  return route;
}

/**
 * The suggested route between two points, for drawing on the journey map and
 * predicting how long the journey takes.
 *
 * Tries the Routes API first (the only one new Google Cloud projects can
 * enable), then the legacy Directions API. Returns null whenever no route is
 * available; the reason is written to the function logs, and the app falls
 * back to a straight-line estimate.
 */
export async function fetchJourneyRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: JourneyRouteMode,
): Promise<JourneyRoute | null> {
  const key = directionsApiKey();
  if (!key) {
    console.warn("getJourneyRoute: GOOGLE_DIRECTIONS_API_KEY is not set");
    return null;
  }

  try {
    const route = await fetchFromRoutesApi(origin, destination, mode, key);
    if (route) {
      return route;
    }
  } catch (error) {
    console.warn("getJourneyRoute: Routes API call failed", error);
  }

  try {
    return await fetchFromDirectionsApi(origin, destination, mode, key);
  } catch (error) {
    // A suggested route is a convenience. Never let it block a journey.
    console.warn("getJourneyRoute: Directions API call failed", error);
    return null;
  }
}
