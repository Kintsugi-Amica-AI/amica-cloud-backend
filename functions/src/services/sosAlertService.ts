import { ALERT_TYPES, AlertType } from "../constants/alertTypes";
import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { SosAlertModel, SosAlertStatus } from "../models/sosAlert.model";

interface CreateSosAlertInput {
  id?: string;
  userId: string;
  triggerType?: string;
  journeyId?: string;
  message?: string;
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

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function isSupportedAlertType(triggerType: string): triggerType is AlertType {
  return Object.values(ALERT_TYPES).includes(triggerType as AlertType);
}

export function normalizeAlertType(triggerType?: string): AlertType {
  return triggerType && isSupportedAlertType(triggerType) ? triggerType : ALERT_TYPES.unknown;
}

export function normalizeSosAlert(data: Record<string, unknown>, idFallback: string): SosAlertModel {
  const now = new Date().toISOString();
  const evidence = isRecord(data.evidence) ? data.evidence : {};

  return {
    id: readString(data.id, idFallback),
    userId: readString(data.userId),
    triggerType: normalizeAlertType(readString(data.triggerType)),
    status: readString(data.status, "active") as SosAlertStatus,
    journeyId: readString(data.journeyId) || undefined,
    location: isRecord(data.location) ? data.location : undefined,
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

export async function createSosAlert(input: CreateSosAlertInput): Promise<SosAlertModel> {
  // TODO: Add contact notification dispatch after push/SMS providers are selected.
  const collection = getFirestore().collection(COLLECTIONS.sosAlerts);
  const document = input.id ? collection.doc(input.id) : collection.doc();
  const now = new Date().toISOString();
  const alert: SosAlertModel = {
    id: document.id,
    userId: input.userId,
    triggerType: normalizeAlertType(input.triggerType),
    status: "active",
    journeyId: input.journeyId,
    message: input.message ?? "I need help. Please check my location.",
    notifiedContacts: [],
    evidence: {},
    metadata: {},
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  await document.set(alert, { merge: true });
  return alert;
}
