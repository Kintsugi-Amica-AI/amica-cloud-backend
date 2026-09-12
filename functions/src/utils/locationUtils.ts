export interface LocationInput {
  latitude?: unknown;
  longitude?: unknown;
  address?: unknown;
  updatedAt?: unknown;
}

export interface NormalizedLocation {
  latitude: number;
  longitude: number;
  address: string;
  updatedAt?: string;
}

export interface LocationValidationResult {
  isValid: boolean;
  errors: string[];
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function isValidLatitude(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function normalizeLocation(location?: LocationInput | null): NormalizedLocation {
  return {
    latitude: readNumber(location?.latitude),
    longitude: readNumber(location?.longitude),
    address: readString(location?.address),
    updatedAt: readString(location?.updatedAt) || undefined,
  };
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates, in metres.
 *
 * This is straight-line distance, which is always shorter than the distance a
 * bus actually drives. Callers that need road distance should use the route
 * service instead.
 */
export function distanceInMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): number {
  const latDistance = toRadians(endLatitude - startLatitude);
  const lonDistance = toRadians(endLongitude - startLongitude);
  const startLat = toRadians(startLatitude);
  const endLat = toRadians(endLatitude);

  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(lonDistance / 2) *
      Math.sin(lonDistance / 2);

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateLocation(location?: LocationInput | null): LocationValidationResult {
  const errors: string[] = [];

  if (!location || !isValidLatitude(location.latitude)) {
    errors.push("latitude must be between -90 and 90");
  }

  if (!location || !isValidLongitude(location.longitude)) {
    errors.push("longitude must be between -180 and 180");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
