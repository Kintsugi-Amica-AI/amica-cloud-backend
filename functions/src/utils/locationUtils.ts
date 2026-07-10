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
