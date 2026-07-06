import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { EmergencyContactModel } from "../models/emergencyContact.model";

export interface EmergencyContactInput {
  id?: string;
  userId?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
  relationship?: string;
  priority?: number;
  isActive?: boolean;
  notificationMethods?: string[];
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

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && value > 0 ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const methods = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return methods.length > 0 ? methods : fallback;
}

export function normalizeEmergencyContactInput(
  input: EmergencyContactInput,
): EmergencyContactInput {
  const phone = readString(input.phone, readString(input.phoneNumber));

  return {
    id: readString(input.id),
    userId: readString(input.userId),
    name: readString(input.name),
    phone,
    relationship: readString(input.relationship),
    priority: readPositiveNumber(input.priority, 1),
    isActive: readBoolean(input.isActive, true),
    notificationMethods: readStringArray(input.notificationMethods, ["sms"]),
    metadata: isRecord(input.metadata) ? input.metadata : {},
    schemaVersion: readPositiveNumber(input.schemaVersion, 1),
  };
}

export function validateEmergencyContactInput(
  input: EmergencyContactInput,
): ValidationResult {
  const normalized = normalizeEmergencyContactInput(input);
  const errors: string[] = [];

  if (!normalized.userId) {
    errors.push("userId is required");
  }
  if (!normalized.name) {
    errors.push("name is required");
  }
  if (!normalized.phone) {
    errors.push("phone is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function buildEmergencyContactPayload(
  input: EmergencyContactInput,
  userId: string,
): EmergencyContactModel {
  const normalized = normalizeEmergencyContactInput({
    ...input,
    userId,
  });
  const validation = validateEmergencyContactInput(normalized);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  const now = new Date().toISOString();

  return {
    id: normalized.id || "",
    userId,
    name: normalized.name || "",
    phone: normalized.phone || "",
    relationship: normalized.relationship || "",
    priority: normalized.priority || 1,
    isActive: normalized.isActive ?? true,
    notificationMethods: normalized.notificationMethods || ["sms"],
    metadata: normalized.metadata || {},
    schemaVersion: normalized.schemaVersion || 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function canUserAccessEmergencyContact(
  contactUserId: string,
  currentUserId: string,
): boolean {
  return contactUserId.length > 0 && contactUserId === currentUserId;
}

export function normalizeEmergencyContact(
  data: Record<string, unknown>,
  idFallback: string,
): EmergencyContactModel {
  const input = normalizeEmergencyContactInput({
    id: readString(data.id, idFallback),
    userId: readString(data.userId),
    name: readString(data.name),
    phone: readString(data.phone, readString(data.phoneNumber)),
    relationship: readString(data.relationship),
    priority: readPositiveNumber(data.priority, 1),
    isActive: readBoolean(data.isActive, true),
    notificationMethods: readStringArray(data.notificationMethods, ["sms"]),
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readPositiveNumber(data.schemaVersion, 1),
  });
  const now = new Date().toISOString();

  return {
    id: input.id || idFallback,
    userId: input.userId || "",
    name: input.name || "",
    phone: input.phone || "",
    relationship: input.relationship || "",
    priority: input.priority || 1,
    isActive: input.isActive ?? true,
    notificationMethods: input.notificationMethods || ["sms"],
    metadata: input.metadata || {},
    schemaVersion: input.schemaVersion || 1,
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export async function addEmergencyContact(
  input: EmergencyContactInput,
): Promise<EmergencyContactModel> {
  // TODO: Add duplicate detection and phone verification after the MVP demo.
  const validation = validateEmergencyContactInput(input);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  const collection = getFirestore().collection(COLLECTIONS.emergencyContacts);
  const document = input.id ? collection.doc(input.id) : collection.doc();
  const contact = buildEmergencyContactPayload(
    {
      ...input,
      id: document.id,
    },
    input.userId || "",
  );

  await document.set(contact, { merge: true });
  return contact;
}

export async function listEmergencyContacts(
  userId: string,
): Promise<EmergencyContactModel[]> {
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.emergencyContacts)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => normalizeEmergencyContact(doc.data(), doc.id));
}
