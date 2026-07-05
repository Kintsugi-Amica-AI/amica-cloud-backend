import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { JourneyModel, JourneyStatus, JourneyType } from "../models/journey.model";

interface CreateJourneyInput {
  id?: string;
  userId: string;
  journeyType?: JourneyType;
  destinationName?: string;
  estimatedEndTime?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function normalizeJourney(data: Record<string, unknown>, idFallback: string): JourneyModel {
  const now = new Date().toISOString();
  return {
    id: readString(data.id, idFallback),
    userId: readString(data.userId),
    journeyType: readString(data.journeyType, "other") as JourneyType,
    status: readString(data.status, "active") as JourneyStatus,
    startLocation: isRecord(data.startLocation) ? data.startLocation : undefined,
    destination: isRecord(data.destination) ? data.destination : undefined,
    estimatedEndTime: readString(data.estimatedEndTime) || undefined,
    actualEndTime: readString(data.actualEndTime) || undefined,
    safetyCheck: isRecord(data.safetyCheck)
      ? {
          required: data.safetyCheck.required === true,
          responseDeadlineSeconds: readNumber(data.safetyCheck.responseDeadlineSeconds, 60),
          respondedAt: readString(data.safetyCheck.respondedAt) || null,
        }
      : undefined,
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readNumber(data.schemaVersion, 1),
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export async function createJourney(input: CreateJourneyInput): Promise<JourneyModel> {
  // TODO: Add live location update support when mobile location service is connected.
  const collection = getFirestore().collection(COLLECTIONS.journeys);
  const document = input.id ? collection.doc(input.id) : collection.doc();
  const now = new Date().toISOString();
  const journey: JourneyModel = {
    id: document.id,
    userId: input.userId,
    journeyType: input.journeyType ?? "other",
    status: "active",
    destination: input.destinationName ? { name: input.destinationName } : undefined,
    estimatedEndTime: input.estimatedEndTime,
    safetyCheck: {
      required: true,
      responseDeadlineSeconds: 60,
      respondedAt: null,
    },
    metadata: {},
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

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
