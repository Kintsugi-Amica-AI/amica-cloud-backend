import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { EmergencyContactModel } from "../models/emergencyContact.model";

interface AddEmergencyContactInput {
  id?: string;
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
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

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeEmergencyContact(
  data: Record<string, unknown>,
  idFallback: string,
): EmergencyContactModel {
  const now = new Date().toISOString();
  return {
    id: readString(data.id, idFallback),
    userId: readString(data.userId),
    name: readString(data.name),
    phone: readString(data.phone, readString(data.phoneNumber)),
    relationship: readString(data.relationship) || undefined,
    priority: readNumber(data.priority, 1),
    isActive: readBoolean(data.isActive, true),
    notificationMethods: readStringArray(data.notificationMethods),
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readNumber(data.schemaVersion, 1),
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export async function addEmergencyContact(
  input: AddEmergencyContactInput,
): Promise<EmergencyContactModel> {
  // TODO: Add phone verification and duplicate contact handling after MVP demo.
  const collection = getFirestore().collection(COLLECTIONS.emergencyContacts);
  const document = input.id ? collection.doc(input.id) : collection.doc();
  const now = new Date().toISOString();
  const contact: EmergencyContactModel = {
    id: document.id,
    userId: input.userId,
    name: input.name,
    phone: input.phone,
    relationship: input.relationship,
    priority: 1,
    isActive: true,
    notificationMethods: ["push"],
    metadata: {},
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  await document.set(contact, { merge: true });
  return contact;
}

export async function listEmergencyContacts(userId: string): Promise<EmergencyContactModel[]> {
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.emergencyContacts)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => normalizeEmergencyContact(doc.data(), doc.id));
}
