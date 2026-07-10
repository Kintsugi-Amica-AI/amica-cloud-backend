import { ALERT_TYPES, AlertType } from "../constants/alertTypes";
import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { SosAlertModel, SosAlertStatus } from "../models/sosAlert.model";
import {
  LocationInput,
  normalizeLocation,
  validateLocation,
} from "../utils/locationUtils";

export interface SosAlertInput {
  id?: string;
  userId?: string;
  triggerType?: string;
  status?: SosAlertStatus;
  journeyId?: string;
  location?: LocationInput;
  message?: string;
  notifiedContacts?: string[];
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  schemaVersion?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function isSupportedAlertType(triggerType: string): triggerType is AlertType {
  return Object.values(ALERT_TYPES).includes(triggerType as AlertType);
}

export function normalizeAlertType(triggerType?: string): AlertType {
  return triggerType && isSupportedAlertType(triggerType) ? triggerType : ALERT_TYPES.unknown;
}

export function validateSosAlertInput(input: SosAlertInput): ValidationResult {
  const errors: string[] = [];

  if (!readString(input.userId)) {
    errors.push("userId is required");
  }

  if (input.location) {
    const locationValidation = validateLocation(input.location);
    errors.push(...locationValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function buildSosAlertPayload(
  input: SosAlertInput,
  userId: string,
): SosAlertModel {
  const validation = validateSosAlertInput({ ...input, userId });
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  const now = new Date().toISOString();
  const evidence = isRecord(input.evidence) ? input.evidence : {};

  return {
    id: readString(input.id),
    userId,
    triggerType: normalizeAlertType(input.triggerType ?? ALERT_TYPES.manual),
    status: input.status ?? "active",
    journeyId: readString(input.journeyId) || undefined,
    location: input.location ? normalizeLocation(input.location) : undefined,
    message: readString(
      input.message,
      "I need help. This is my live location.",
    ),
    notifiedContacts: readStringArray(input.notifiedContacts),
    evidence: {
      voicePhraseDetected: evidence.voicePhraseDetected === true,
      scannedPlateNumber: readString(evidence.scannedPlateNumber) || undefined,
      confidenceScore: readNumber(evidence.confidenceScore, 0),
    },
    metadata: isRecord(input.metadata) ? input.metadata : {},
    schemaVersion: readNumber(input.schemaVersion, 1),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildManualSosPayload(
  userId: string,
  location: LocationInput,
  journeyId?: string,
): SosAlertModel {
  return buildSosAlertPayload(
    {
      userId,
      triggerType: ALERT_TYPES.manual,
      journeyId,
      location,
    },
    userId,
  );
}

export function buildTimerSosPayload(
  userId: string,
  location: LocationInput,
  journeyId?: string,
): SosAlertModel {
  return buildSosAlertPayload(
    {
      userId,
      triggerType: ALERT_TYPES.timer,
      journeyId,
      location,
      metadata: {
        source: "journey_timer",
      },
    },
    userId,
  );
}

export function normalizeSosAlert(
  data: Record<string, unknown>,
  idFallback: string,
): SosAlertModel {
  const now = new Date().toISOString();
  const evidence = isRecord(data.evidence) ? data.evidence : {};

  return {
    id: readString(data.id, idFallback),
    userId: readString(data.userId),
    triggerType: normalizeAlertType(readString(data.triggerType)),
    status: readString(data.status, "active") as SosAlertStatus,
    journeyId: readString(data.journeyId) || undefined,
    location: isRecord(data.location) ? normalizeLocation(data.location) : undefined,
    message: readString(data.message) || undefined,
    notifiedContacts: readStringArray(data.notifiedContacts),
    evidence: {
      voicePhraseDetected: evidence.voicePhraseDetected === true,
      scannedPlateNumber: readString(evidence.scannedPlateNumber) || undefined,
      confidenceScore: readNumber(evidence.confidenceScore, 0),
    },
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readNumber(data.schemaVersion, 1),
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export async function createSosAlert(input: SosAlertInput): Promise<SosAlertModel> {
  // TODO: Add emergency contact notification dispatch after push/SMS providers are selected.
  const collection = getFirestore().collection(COLLECTIONS.sosAlerts);
  const document = input.id ? collection.doc(input.id) : collection.doc();
  const alert = buildSosAlertPayload(
    {
      ...input,
      id: document.id,
    },
    input.userId ?? "",
  );

  await document.set(alert, { merge: true });
  return alert;
}
