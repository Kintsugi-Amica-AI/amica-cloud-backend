/**
 * Community vehicle profile: what type and colour Amica scans usually see
 * on a plate. The phone reads type and colour on the device and saves only
 * those words to `vehicle_observations/{plate}_{uid}`; the
 * `onVehicleObservationCreated` trigger folds each one into
 * `vehicles/{plate}.observedProfile` with `addObservation`.
 *
 * The id lists match the mobile app's `VehicleKind` / `VehicleColour`
 * (amica-mobile-app/lib/features/plate_scan/models/vehicle_profile.dart)
 * and the Firestore rules.
 */
export const VEHICLE_TYPES = [
  "car", "van", "bus", "lorry", "motorbike", "three_wheeler",
] as const;

export const VEHICLE_COLOURS = [
  "white", "silver", "grey", "black", "red", "maroon",
  "orange", "yellow", "green", "blue", "brown",
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type VehicleColour = (typeof VEHICLE_COLOURS)[number];

/** A usual type or colour needs this many agreeing scans... */
export const MIN_AGREEING_SCANS = 3;
/** ...and this share of all scans that reported that aspect. */
export const MIN_AGREEMENT_SHARE = 0.6;

export interface ObservedProfile {
  observationCount: number;
  typeCounts: Partial<Record<VehicleType, number>>;
  colourCounts: Partial<Record<VehicleColour, number>>;
  usualType: VehicleType | null;
  usualColour: VehicleColour | null;
  /** How many scans agree with `usualType` / `usualColour`. */
  typeAgreement: number;
  colourAgreement: number;
}

export interface Observation {
  vehicleType?: unknown;
  colour?: unknown;
}

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" &&
    (VEHICLE_TYPES as readonly string[]).includes(value);
}

export function isVehicleColour(value: unknown): value is VehicleColour {
  return typeof value === "string" &&
    (VEHICLE_COLOURS as readonly string[]).includes(value);
}

function readCounts<T extends string>(
  value: unknown,
  allowed: readonly T[],
): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  if (!value || typeof value !== "object") return counts;
  for (const key of allowed) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n === "number" && Number.isInteger(n) && n > 0) counts[key] = n;
  }
  return counts;
}

/**
 * The most common value, if it is common enough to call it usual. One odd
 * scan (or one prankster) must never flip a plate's profile, so ties and
 * thin evidence give null.
 */
export function usualValue<T extends string>(
  counts: Partial<Record<T, number>>,
): { value: T | null; agreement: number } {
  let best: T | null = null;
  let bestCount = 0;
  let total = 0;
  let tied = false;
  for (const [key, raw] of Object.entries(counts)) {
    const count = raw as number;
    total += count;
    if (count > bestCount) {
      best = key as T;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  if (!best || tied || bestCount < MIN_AGREEING_SCANS ||
      bestCount / total < MIN_AGREEMENT_SHARE) {
    return { value: null, agreement: bestCount };
  }
  return { value: best, agreement: bestCount };
}

/**
 * Adds one observation to a stored profile (which may be missing or
 * malformed). Unknown type or colour words are ignored; returns null when
 * the observation carries nothing usable.
 */
export function addObservation(
  existing: unknown,
  observation: Observation,
): ObservedProfile | null {
  const type = isVehicleType(observation.vehicleType) ?
    observation.vehicleType : null;
  const colour = isVehicleColour(observation.colour) ?
    observation.colour : null;
  if (!type && !colour) return null;

  const stored = (existing && typeof existing === "object" ?
    existing : {}) as Record<string, unknown>;
  const typeCounts = readCounts(stored.typeCounts, VEHICLE_TYPES);
  const colourCounts = readCounts(stored.colourCounts, VEHICLE_COLOURS);
  if (type) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  if (colour) colourCounts[colour] = (colourCounts[colour] ?? 0) + 1;

  const previousCount = typeof stored.observationCount === "number" &&
    Number.isInteger(stored.observationCount) && stored.observationCount >= 0 ?
    stored.observationCount : 0;
  const usualType = usualValue(typeCounts);
  const usualColour = usualValue(colourCounts);
  return {
    observationCount: previousCount + 1,
    typeCounts,
    colourCounts,
    usualType: usualType.value,
    usualColour: usualColour.value,
    typeAgreement: usualType.agreement,
    colourAgreement: usualColour.agreement,
  };
}
