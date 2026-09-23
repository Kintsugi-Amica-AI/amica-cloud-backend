import { distanceInMeters } from "../utils/locationUtils";
import { fetchJourneyRoute, RoutePoint } from "./routeService";

/**
 * Bus / train trip planning for Walk/Ride with me and the Smart Stop Alert.
 *
 * Real trips on public transport are three parts, not one: walk from where
 * you are to a stop, ride, then walk from the stop you get off at to where
 * you are actually going. Many roads have no stop on them, so the walks can
 * be a real part of the journey — and the stop you get off at, not the final
 * address, is what the stop alarm must wake you for.
 *
 * Strategy:
 * 1. Ask the Routes API for a genuine TRANSIT route (real lines and stops).
 *    Coverage in Sri Lanka is patchy, so this often returns nothing.
 * 2. Otherwise compose one: find the nearest stops/stations to the start and
 *    to the destination with Places Nearby Search, then route
 *    walk → ride → walk between them.
 *
 * The same GOOGLE_DIRECTIONS_API_KEY is used; it needs the Routes API and
 * Places API (New) enabled (the legacy Places Nearby Search is tried as a
 * fallback for older projects).
 */

export type TransitMode = "bus" | "train";

export interface TransitStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Straight-line metres from the point the stop was searched around. */
  distanceMeters: number;
}

export interface TransitLeg {
  kind: "walk" | "ride";
  distanceMeters: number;
  durationSeconds: number;
  /** Encoded polylines, in order; the app joins them. */
  polylines: string[];
  fromName: string;
  toName: string;
  /** Bus route / train line when known ("138", "Coast Line"). */
  lineName: string;
  /** For rides: what she rides — "bus" or "train". Empty for walks. */
  vehicle: "bus" | "train" | "";
  /** Where the leg starts / ends (for drawing feeder-bus stops). */
  from?: RoutePoint;
  to?: RoutePoint;
}

export interface TransitPlan {
  mode: TransitMode;
  /** "transit" = a real timetabled route; "estimated" = composed by Amica. */
  source: "transit" | "estimated";
  boardStop: TransitStop;
  alightStop: TransitStop;
  boardCandidates: TransitStop[];
  alightCandidates: TransitStop[];
  legs: TransitLeg[];
  distanceMeters: number;
  durationSeconds: number;
}

export type TransitPlanResult =
  | { available: true; plan: TransitPlan }
  | { available: false; reason: "no-key" | "no-stops" | "too-close" | "error" };

/** How far to look for a stop around each end. Stations are sparser. */
const SEARCH_RADIUS_METERS: Record<TransitMode, number> = {
  bus: 1500,
  train: 6000,
};

/** Rough ride speeds for estimated legs, in km/h. */
const RIDE_SPEED_KMH: Record<TransitMode, number> = { bus: 22, train: 38 };
const WALK_SPEED_KMH = 4.8;

/** Walks shorter than this are left out — you are already at the stop. */
const MIN_WALK_METERS = 40;

/**
 * Longer than this and nobody should be told to walk to (or from) a train
 * station: the plan takes a bus for that stretch instead. Stations are far
 * apart, so this happens a lot on train trips.
 */
const MAX_ACCESS_WALK_METERS = 1200;

const PLACE_TYPES: Record<TransitMode, string[]> = {
  bus: ["bus_stop", "bus_station"],
  train: ["train_station", "subway_station", "light_rail_station"],
};

const LEGACY_PLACE_TYPE: Record<TransitMode, string> = {
  bus: "bus_station",
  train: "train_station",
};

export function readTransitMode(value: unknown): TransitMode {
  return value === "train" ? "train" : "bus";
}

function apiKey(): string | undefined {
  const key = process.env.GOOGLE_DIRECTIONS_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

// ── Polyline encoding (for straight-line fallback legs) ───────────────────

function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

/** Google encoded polyline for a list of points. Exported for tests. */
export function encodePolyline(points: RoutePoint[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  for (const p of points) {
    const lat = Math.round(p.latitude * 1e5);
    const lng = Math.round(p.longitude * 1e5);
    out += encodeSigned(lat - lastLat) + encodeSigned(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

function straightLeg(
  kind: "walk" | "ride",
  from: RoutePoint,
  to: RoutePoint,
  speedKmh: number,
  fromName: string,
  toName: string,
  vehicle: "bus" | "train" | "" = "",
): TransitLeg {
  const meters = distanceInMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  // Roads are rarely straight: pad the straight line a little.
  const distanceMeters = Math.round(meters * 1.25);
  return {
    kind,
    distanceMeters,
    durationSeconds: Math.max(60, Math.round((distanceMeters / 1000 / speedKmh) * 3600)),
    polylines: [encodePolyline([from, to])],
    fromName,
    toName,
    lineName: "",
    vehicle,
    from: point(from),
    to: point(to),
  };
}

function point(p: RoutePoint): RoutePoint {
  return { latitude: p.latitude, longitude: p.longitude };
}

const BUS_VEHICLES = new Set(["BUS", "INTERCITY_BUS", "TROLLEYBUS", "SHARE_TAXI"]);

/** Routes API vehicle type → what the app shows. */
function vehicleOf(type: string | undefined): "bus" | "train" {
  return type && BUS_VEHICLES.has(type) ? "bus" : "train";
}

// ── Stops ─────────────────────────────────────────────────────────────────

async function searchStopsNew(
  center: RoutePoint,
  mode: TransitMode,
  key: string,
): Promise<TransitStop[] | null> {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location",
      },
      body: JSON.stringify({
        includedTypes: PLACE_TYPES[mode],
        maxResultCount: 5,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: { center, radius: SEARCH_RADIUS_METERS[mode] },
        },
      }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    places?: {
      id?: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
    }[];
    error?: { status?: string; message?: string };
  } | null;
  if (!response.ok) {
    console.warn(
      `getTransitPlan: Places (New) ${response.status} ${body?.error?.status ?? ""}: ${body?.error?.message ?? ""}`,
    );
    return null;
  }
  return (body?.places ?? [])
    .filter(
      (p) =>
        typeof p.id === "string" &&
        typeof p.location?.latitude === "number" &&
        typeof p.location?.longitude === "number",
    )
    .map((p) => toStop(center, p.id!, p.displayName?.text ?? "", p.location!.latitude!, p.location!.longitude!));
}

async function searchStopsLegacy(
  center: RoutePoint,
  mode: TransitMode,
  key: string,
): Promise<TransitStop[] | null> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
  );
  url.searchParams.set("location", `${center.latitude},${center.longitude}`);
  url.searchParams.set("rankby", "distance");
  url.searchParams.set("type", LEGACY_PLACE_TYPE[mode]);
  url.searchParams.set("key", key);
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json().catch(() => null)) as {
    status?: string;
    error_message?: string;
    results?: {
      place_id?: string;
      name?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }[];
  } | null;
  if (body?.status !== "OK" && body?.status !== "ZERO_RESULTS") {
    console.warn(
      `getTransitPlan: legacy Places ${body?.status ?? response.status}: ${body?.error_message ?? ""}`,
    );
    return null;
  }
  return (body?.results ?? [])
    .filter(
      (r) =>
        typeof r.place_id === "string" &&
        typeof r.geometry?.location?.lat === "number" &&
        typeof r.geometry?.location?.lng === "number",
    )
    .map((r) => toStop(center, r.place_id!, r.name ?? "", r.geometry!.location!.lat!, r.geometry!.location!.lng!))
    .filter((s) => s.distanceMeters <= SEARCH_RADIUS_METERS[mode])
    .slice(0, 5);
}

function toStop(
  center: RoutePoint,
  id: string,
  name: string,
  latitude: number,
  longitude: number,
): TransitStop {
  return {
    id,
    name: name.trim() || "Stop",
    latitude,
    longitude,
    distanceMeters: Math.round(
      distanceInMeters(center.latitude, center.longitude, latitude, longitude),
    ),
  };
}

/** Nearest stops/stations around a point, nearest first. */
export async function findStops(
  center: RoutePoint,
  mode: TransitMode,
  key: string,
): Promise<TransitStop[]> {
  try {
    const stops = await searchStopsNew(center, mode, key);
    if (stops && stops.length > 0) {
      return stops;
    }
  } catch (error) {
    console.warn("getTransitPlan: Places (New) failed", error);
  }
  try {
    return (await searchStopsLegacy(center, mode, key)) ?? [];
  } catch (error) {
    console.warn("getTransitPlan: legacy Places failed", error);
    return [];
  }
}

// ── Real transit routes (Routes API) ─────────────────────────────────────

interface RoutesTransitStep {
  travelMode?: string;
  distanceMeters?: number;
  staticDuration?: string;
  polyline?: { encodedPolyline?: string };
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string; location?: { latLng?: RoutePoint } };
      arrivalStop?: { name?: string; location?: { latLng?: RoutePoint } };
    };
    transitLine?: {
      name?: string;
      nameShort?: string;
      vehicle?: { type?: string };
    };
  };
}

function seconds(value: string | undefined): number {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Turns a Routes API TRANSIT response into legs, merging runs of walking
 * steps into one walk leg. Pure, so it can be tested offline. Returns null
 * when the route has no transit step at all.
 */
export function parseTransitRoute(
  body: unknown,
  originName: string,
  destinationName: string,
  mode: TransitMode = "bus",
): { legs: TransitLeg[]; board: TransitStop; alight: TransitStop } | null {
  const steps = (
    body as { routes?: { legs?: { steps?: RoutesTransitStep[] }[] }[] } | null
  )?.routes?.[0]?.legs?.flatMap((leg) => leg.steps ?? []);
  if (!steps || steps.length === 0) return null;

  const legs: TransitLeg[] = [];
  let board: TransitStop | null = null;
  let alight: TransitStop | null = null;

  for (const step of steps) {
    const polyline = step.polyline?.encodedPolyline;
    if (step.travelMode === "TRANSIT" && step.transitDetails) {
      const dep = step.transitDetails.stopDetails?.departureStop;
      const arr = step.transitDetails.stopDetails?.arrivalStop;
      const depLoc = dep?.location?.latLng;
      const arrLoc = arr?.location?.latLng;
      if (!depLoc || !arrLoc) continue;
      const vehicle = vehicleOf(step.transitDetails.transitLine?.vehicle?.type);
      // On a train trip, the stations are the train's own stops; any bus
      // before or after is just how she gets to / from them.
      const isMain = mode === "bus" || vehicle === "train";
      if (isMain && !board) {
        board = { id: `transit:${dep?.name ?? "board"}`, name: dep?.name ?? "Stop", latitude: depLoc.latitude, longitude: depLoc.longitude, distanceMeters: 0 };
      }
      if (isMain) {
        alight = { id: `transit:${arr?.name ?? "alight"}`, name: arr?.name ?? "Stop", latitude: arrLoc.latitude, longitude: arrLoc.longitude, distanceMeters: 0 };
      }
      legs.push({
        kind: "ride",
        distanceMeters: step.distanceMeters ?? 0,
        durationSeconds: seconds(step.staticDuration),
        polylines: polyline ? [polyline] : [],
        fromName: dep?.name ?? "",
        toName: arr?.name ?? "",
        lineName:
          step.transitDetails.transitLine?.nameShort ??
          step.transitDetails.transitLine?.name ??
          "",
        vehicle,
        from: point(depLoc),
        to: point(arrLoc),
      });
    } else {
      const last = legs[legs.length - 1];
      if (last && last.kind === "walk") {
        last.distanceMeters += step.distanceMeters ?? 0;
        last.durationSeconds += seconds(step.staticDuration);
        if (polyline) last.polylines.push(polyline);
      } else {
        legs.push({
          kind: "walk",
          distanceMeters: step.distanceMeters ?? 0,
          durationSeconds: seconds(step.staticDuration),
          polylines: polyline ? [polyline] : [],
          fromName: "",
          toName: "",
          lineName: "",
          vehicle: "",
        });
      }
    }
  }
  if (!board || !alight) return null;

  // Name the walks by what they connect.
  legs.forEach((leg, i) => {
    if (leg.kind !== "walk") return;
    leg.fromName = legs[i - 1]?.toName || originName;
    leg.toName = legs[i + 1]?.fromName || destinationName;
  });
  return {
    legs: legs.filter((l) => l.kind === "ride" || l.distanceMeters >= MIN_WALK_METERS),
    board,
    alight,
  };
}

async function fetchTransitRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: TransitMode,
  key: string,
) {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "routes.legs.steps.travelMode",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.staticDuration",
          "routes.legs.steps.polyline.encodedPolyline",
          "routes.legs.steps.transitDetails.stopDetails",
          "routes.legs.steps.transitDetails.transitLine.name",
          "routes.legs.steps.transitDetails.transitLine.nameShort",
          "routes.legs.steps.transitDetails.transitLine.vehicle.type",
        ].join(","),
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: "TRANSIT",
        transitPreferences: {
          // A train trip may well start or end with a bus to the station.
          allowedTravelModes:
            mode === "bus"
              ? ["BUS"]
              : ["TRAIN", "RAIL", "SUBWAY", "LIGHT_RAIL", "BUS"],
        },
      }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.warn(`getTransitPlan: Routes TRANSIT ${response.status}`, body);
    return null;
  }
  return parseTransitRoute(body, "", "", mode);
}

// ── Composed (estimated) routes ──────────────────────────────────────────

async function walkLeg(
  from: RoutePoint,
  to: RoutePoint,
  fromName: string,
  toName: string,
): Promise<TransitLeg | null> {
  const straight = distanceInMeters(from.latitude, from.longitude, to.latitude, to.longitude);
  if (straight < MIN_WALK_METERS) return null;
  const route = await fetchJourneyRoute(from, to, "walking").catch(() => null);
  if (!route) {
    return straightLeg("walk", from, to, WALK_SPEED_KMH, fromName, toName);
  }
  return {
    kind: "walk",
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    polylines: [route.polyline],
    fromName,
    toName,
    lineName: "",
    vehicle: "",
    from: point(from),
    to: point(to),
  };
}

/**
 * Getting between a point and a train station. Walk when it is close;
 * otherwise take a bus: walk to the nearest bus stop, ride to the stop
 * nearest the station, walk the last bit. If no suitable bus stops are
 * found, fall back to a single road leg ("take a bus or tuk-tuk").
 */
async function accessLegs(
  from: RoutePoint,
  to: RoutePoint,
  fromName: string,
  toName: string,
  key: string,
): Promise<TransitLeg[]> {
  const straight = distanceInMeters(from.latitude, from.longitude, to.latitude, to.longitude);
  if (straight <= MAX_ACCESS_WALK_METERS) {
    const walk = await walkLeg(from, to, fromName, toName);
    return walk ? [walk] : [];
  }

  const [nearFrom, nearTo] = await Promise.all([
    findStops(from, "bus", key),
    findStops(to, "bus", key),
  ]);
  const busOn = nearFrom[0];
  const busOff = nearTo.find((s) => s.id !== busOn?.id);
  if (busOn && busOff) {
    const [walkIn, ride, walkOut] = await Promise.all([
      walkLeg(from, busOn, fromName, busOn.name),
      rideLeg(busOn, busOff, "bus"),
      walkLeg(busOff, to, busOff.name, toName),
    ]);
    return [walkIn, ride, walkOut].filter((l): l is TransitLeg => l !== null);
  }

  // No stops found: still don't send her on a long walk.
  const road = await fetchJourneyRoute(from, to, "driving").catch(() => null);
  if (road) {
    return [
      {
        kind: "ride",
        distanceMeters: road.distanceMeters,
        durationSeconds: Math.round(road.durationSeconds * 1.5),
        polylines: [road.polyline],
        fromName: "",
        toName,
        lineName: "",
        vehicle: "bus",
        from: point(from),
        to: point(to),
      },
    ];
  }
  return [straightLeg("ride", from, to, RIDE_SPEED_KMH.bus, "", toName, "bus")];
}

async function rideLeg(
  from: TransitStop,
  to: TransitStop,
  mode: TransitMode,
): Promise<TransitLeg> {
  if (mode === "bus") {
    // A bus follows the road, so the driving route is a fair stand-in.
    const route = await fetchJourneyRoute(from, to, "driving").catch(() => null);
    if (route) {
      return {
        kind: "ride",
        distanceMeters: route.distanceMeters,
        // Stops and traffic: a bus is slower than a car on the same road.
        durationSeconds: Math.round(route.durationSeconds * 1.5),
        polylines: [route.polyline],
        fromName: from.name,
        toName: to.name,
        lineName: "",
        vehicle: "bus",
        from: point(from),
        to: point(to),
      };
    }
  }
  // Trains do not follow roads; draw the station-to-station line.
  return straightLeg("ride", from, to, RIDE_SPEED_KMH[mode], from.name, to.name, mode);
}

function pick(
  candidates: TransitStop[],
  preferredId: unknown,
  exclude?: string,
): TransitStop | undefined {
  const usable = candidates.filter((c) => c.id !== exclude);
  return (
    usable.find((c) => typeof preferredId === "string" && c.id === preferredId) ??
    usable[0]
  );
}

function totals(legs: TransitLeg[]) {
  return {
    distanceMeters: legs.reduce((s, l) => s + l.distanceMeters, 0),
    durationSeconds: legs.reduce((s, l) => s + l.durationSeconds, 0),
  };
}

/**
 * The plan for a bus/train trip. `boardStopId` / `alightStopId` let the
 * rider pick a different stop from the suggested candidates.
 */
export async function planTransitTrip(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: TransitMode,
  boardStopId?: unknown,
  alightStopId?: unknown,
): Promise<TransitPlanResult> {
  const key = apiKey();
  if (!key) {
    console.warn("getTransitPlan: GOOGLE_DIRECTIONS_API_KEY is not set");
    return { available: false, reason: "no-key" };
  }

  const tripMeters = distanceInMeters(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
  if (tripMeters < (mode === "bus" ? 700 : 2000)) {
    return { available: false, reason: "too-close" };
  }

  try {
    const [boardCandidates, alightCandidates, transit] = await Promise.all([
      findStops(origin, mode, key),
      findStops(destination, mode, key),
      // Only when the rider has not picked stops by hand.
      boardStopId || alightStopId
        ? Promise.resolve(null)
        : fetchTransitRoute(origin, destination, mode, key).catch(() => null),
    ]);

    if (transit) {
      return {
        available: true,
        plan: {
          mode,
          source: "transit",
          boardStop: transit.board,
          alightStop: transit.alight,
          boardCandidates,
          alightCandidates,
          legs: transit.legs,
          ...totals(transit.legs),
        },
      };
    }

    const board = pick(boardCandidates, boardStopId);
    const alight = board ? pick(alightCandidates, alightStopId, board.id) : undefined;
    if (!board || !alight) {
      return { available: false, reason: "no-stops" };
    }

    // Bus trips: stops are within walking distance by construction.
    // Train trips: stations can be kilometres away, so the ends may be a
    // bus ride (see accessLegs).
    const [legsIn, ride, legsOut] = await Promise.all([
      mode === "train"
        ? accessLegs(origin, board, "", board.name, key)
        : walkLeg(origin, board, "", board.name).then((l) => (l ? [l] : [])),
      rideLeg(board, alight, mode),
      mode === "train"
        ? accessLegs(alight, destination, alight.name, "", key)
        : walkLeg(alight, destination, alight.name, "").then((l) => (l ? [l] : [])),
    ]);
    const legs = [...legsIn, ride, ...legsOut];

    return {
      available: true,
      plan: {
        mode,
        source: "estimated",
        boardStop: board,
        alightStop: alight,
        boardCandidates,
        alightCandidates,
        legs,
        ...totals(legs),
      },
    };
  } catch (error) {
    console.warn("getTransitPlan failed", error);
    return { available: false, reason: "error" };
  }
}
