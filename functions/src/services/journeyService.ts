import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  GeoPointLike,
  JourneyModel,
  JourneyStatus,
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

  if (
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
  const estimatedDurationMinutes = readPositiveNumber(
    input.estimatedDurationMinutes,
    30,
  );
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
      required: input.safetyCheck?.required ?? true,
      responseDeadlineSeconds:
        input.safetyCheck?.responseDeadlineSeconds ?? 30,
      respondedAt: input.safetyCheck?.respondedAt ?? null,
    },
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

  return new Date(journey.estimatedEndTime) < now;
}
