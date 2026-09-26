import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  DEFAULT_STOP_ALERT_DISTANCE_METERS,
  GeoPointLike,
  JourneyModel,
  JourneyStatus,
  JourneyStopAlert,
  JourneyType,
} from "../models/journey.model";
import {
  LocationInput,
  normalizeLocation,
  validateLocation,
} from "../utils/locationUtils";

export interface JourneyInput {
  id?: string;
  userId?: string;
  journeyType?: JourneyType;
  status?: JourneyStatus;
  startLocation?: LocationInput;
  currentLocation?: LocationInput;
  destination?: GeoPointLike;
  destinationName?: string;
  estimatedDurationMinutes?: number;
  estimatedEndTime?: string;
  safetyCheck?: {
    required?: boolean;
    responseDeadlineSeconds?: number;
    respondedAt?: string | null;
  };
  stopAlert?: {
    enabled?: boolean;
    alertDistanceMeters?: number;
    alertedAt?: string | null;
  };
  metadata?: Record<string, unknown>;
  schemaVersion?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const journeyStatuses: JourneyStatus[] = [
  "active",
  "safe",
  "sos",
  "cancelled",
  "expired",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function toGeoPointLike(location?: LocationInput): GeoPointLike | undefined {
  if (!location) {
    return undefined;
  }
  return normalizeLocation(location);
}

/**
 * Reads a `stopAlert` map, or returns undefined when the journey does not have
 * one. A journey without this map is an ordinary timer journey, which keeps
 * every journey written before Smart Stop Alert existed valid.
 */
function readStopAlert(value: unknown): JourneyStopAlert | undefined {
  if (!isRecord(value) || value.enabled !== true) {
    return undefined;
  }

  return {
    enabled: true,
    alertDistanceMeters: readPositiveNumber(
      value.alertDistanceMeters,
      DEFAULT_STOP_ALERT_DISTANCE_METERS,
    ),
    alertedAt: readString(value.alertedAt) || null,
  };
}

/**
 * Whether this journey watches the distance to a drop-off rather than counting
 * down a safety timer.
 */
export function isStopAlertRide(
  journey: Pick<JourneyModel, "stopAlert">,
): boolean {
  return journey.stopAlert?.enabled === true;
}

function buildDestination(input: JourneyInput): GeoPointLike | undefined {
  if (input.destination) {
    return {
      latitude: input.destination.latitude,
      longitude: input.destination.longitude,
      address: input.destination.address ?? "",
      name: input.destination.name ?? input.destinationName ?? "",
    };
  }

  const destinationName = readString(input.destinationName);
  return destinationName ? { name: destinationName, address: "" } : undefined;
}

export function validateJourneyInput(input: JourneyInput): ValidationResult {
  const errors: string[] = [];

  if (!readString(input.userId)) {
    errors.push("userId is required");
  }

  if (input.startLocation) {
    const locationValidation = validateLocation(input.startLocation);
    errors.push(...locationValidation.errors);
  }

  // A Smart Stop Alert ride has no duration to validate: a rider cannot
  // predict how long a bus takes, which is the reason they asked to be warned
  // by distance instead. Those rides legitimately store 0.
  if (
    !readStopAlert(input.stopAlert) &&
    input.estimatedDurationMinutes !== undefined &&
    readPositiveNumber(input.estimatedDurationMinutes, 0) <= 0
  ) {
    errors.push("estimatedDurationMinutes must be positive");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function buildCurrentLocationPayload(location: LocationInput): GeoPointLike {
  const validation = validateLocation(location);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  return {
    ...normalizeLocation(location),
    updatedAt: new Date().toISOString(),
  };
}

export function updateJourneyStatusPayload(status: JourneyStatus): Record<string, unknown> {
  if (!journeyStatuses.includes(status)) {
    throw new Error("Unsupported journey status");
  }

  return {
    status,
    updatedAt: new Date().toISOString(),
    ...(status === "safe" || status === "cancelled" || status === "expired"
      ? { actualEndTime: new Date().toISOString() }
      : {}),
  };
}

export function buildJourneyPayload(input: JourneyInput, userId: string): JourneyModel {
  const validation = validateJourneyInput({ ...input, userId });
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  const now = new Date();
  const stopAlert = readStopAlert(input.stopAlert);
  // A stop alert ride has no countdown, so it must not be given an invented
  // 30-minute deadline that would later read as an expired safety journey.
  const estimatedDurationMinutes = stopAlert
    ? 0
    : readPositiveNumber(input.estimatedDurationMinutes, 30);
  const estimatedEndTime =
    input.estimatedEndTime ??
    new Date(now.getTime() + estimatedDurationMinutes * 60 * 1000).toISOString();
  const startLocation = toGeoPointLike(input.startLocation);

  return {
    id: readString(input.id),
    userId,
    journeyType: input.journeyType ?? "walk",
    status: input.status ?? "active",
    startLocation,
    currentLocation: toGeoPointLike(input.currentLocation) ?? startLocation,
    destination: buildDestination(input),
    estimatedDurationMinutes,
    estimatedEndTime,
    safetyCheck: {
      // A stop alert ride has no deadline to answer for, so its safety check
      // defaults off unless the caller explicitly asked for one.
      required: input.safetyCheck?.required ?? !stopAlert,
      responseDeadlineSeconds:
        input.safetyCheck?.responseDeadlineSeconds ?? 30,
      respondedAt: input.safetyCheck?.respondedAt ?? null,
    },
    ...(stopAlert ? { stopAlert } : {}),
    metadata: isRecord(input.metadata) ? input.metadata : {},
    schemaVersion: readPositiveNumber(input.schemaVersion, 1),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function normalizeJourney(
  data: Record<string, unknown>,
  idFallback: string,
): JourneyModel {
  const now = new Date().toISOString();
  const safetyCheck = isRecord(data.safetyCheck) ? data.safetyCheck : {};

  return {
    id: readString(data.id, idFallback),
    userId: readString(data.userId),
    journeyType: readString(data.journeyType, "walk") as JourneyType,
    status: readString(data.status, "active") as JourneyStatus,
    startLocation: isRecord(data.startLocation) ? data.startLocation : undefined,
    currentLocation: isRecord(data.currentLocation)
      ? data.currentLocation
      : undefined,
    destination: isRecord(data.destination) ? data.destination : undefined,
    estimatedDurationMinutes: readNumber(data.estimatedDurationMinutes, 0) || undefined,
    estimatedEndTime: readString(data.estimatedEndTime) || undefined,
    actualEndTime: readString(data.actualEndTime) || undefined,
    safetyCheck: {
      required: safetyCheck.required !== false,
      responseDeadlineSeconds: readNumber(
        safetyCheck.responseDeadlineSeconds,
        30,
      ),
      respondedAt: readString(safetyCheck.respondedAt) || null,
    },
    // Carried through rather than dropped: normalizing a bus ride and writing
    // it back must not erase the rider's alarm settings mid-journey.
    ...(readStopAlert(data.stopAlert)
      ? { stopAlert: readStopAlert(data.stopAlert) }
      : {}),
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readNumber(data.schemaVersion, 1),
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export async function createJourney(input: JourneyInput): Promise<JourneyModel> {
  // TODO: Add background safety-check scheduling after MVP demo.
  const collection = getFirestore().collection(COLLECTIONS.journeys);
  const document = input.id ? collection.doc(input.id) : collection.doc();
  const journey = buildJourneyPayload(
    {
      ...input,
      id: document.id,
    },
    input.userId ?? "",
  );

  await document.set(journey, { merge: true });
  return journey;
}

export async function getJourney(journeyId: string): Promise<JourneyModel | null> {
  const snapshot = await getFirestore().collection(COLLECTIONS.journeys).doc(journeyId).get();
  return snapshot.exists ? normalizeJourney(snapshot.data() ?? {}, snapshot.id) : null;
}

export function hasJourneyExpired(journey: JourneyModel, now = new Date()): boolean {
  if (journey.status !== "active" || !journey.estimatedEndTime) {
    return false;
  }

  // A stop-alert-only ride can never expire: it has no deadline, and its
  // estimatedEndTime is only a placeholder equal to when the ride started.
  // Without this, every bus ride would read as expired the moment it began and
  // `onJourneyUpdated` would send the rider a safety check they never asked
  // for, seconds after boarding.
  //
  // A bus or train journey started from the journey screen has the stop alert
  // AND a real safety timer (safetyCheck.required stays true), so it expires
  // like any other timer journey.
  if (isStopAlertRide(journey) && journey.safetyCheck?.required === false) {
    return false;
  }

  return new Date(journey.estimatedEndTime) < now;
}
