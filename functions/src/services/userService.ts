import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  UserModel,
  UserPreferences,
  UserSafetySettings,
  UserRole,
  UserStatus,
} from "../models/user.model";

interface CreateUserProfileInput {
  uid: string;
  name: string;
  email: string;
  phone: string;
  secretPhrase?: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  notificationsEnabled: true,
  locationSharingEnabled: true,
};

const DEFAULT_SAFETY_SETTINGS: UserSafetySettings = {
  defaultEmergencyMessage: "I need help. This is my live location.",
  autoSosDelaySeconds: 30,
  fakeCallContactName: "Amica Friend",
  fakeCallPhoneNumber: "+94 700 000 000",
  voiceSosEnabled: true,
  secretPhraseEnabled: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function normalizePreferences(value: unknown): UserPreferences {
  const data = isRecord(value) ? value : {};
  return {
    language: readString(data.language, DEFAULT_PREFERENCES.language),
    notificationsEnabled: readBoolean(
      data.notificationsEnabled,
      DEFAULT_PREFERENCES.notificationsEnabled,
    ),
    locationSharingEnabled: readBoolean(
      data.locationSharingEnabled,
      DEFAULT_PREFERENCES.locationSharingEnabled,
    ),
  };
}

export function getDefaultSafetySettings(): UserSafetySettings {
  return { ...DEFAULT_SAFETY_SETTINGS };
}

export function normalizeSecretPhrase(phrase: unknown): string {
  return readString(phrase)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function buildUserSafetySettings(value: unknown): UserSafetySettings {
  const data = isRecord(value) ? value : {};
  return {
    defaultEmergencyMessage: readString(
      data.defaultEmergencyMessage,
      DEFAULT_SAFETY_SETTINGS.defaultEmergencyMessage,
    ),
    autoSosDelaySeconds: readNumber(
      data.autoSosDelaySeconds,
      DEFAULT_SAFETY_SETTINGS.autoSosDelaySeconds,
    ),
    fakeCallContactName: readString(
      data.fakeCallContactName,
      DEFAULT_SAFETY_SETTINGS.fakeCallContactName,
    ),
    fakeCallPhoneNumber: readString(
      data.fakeCallPhoneNumber,
      DEFAULT_SAFETY_SETTINGS.fakeCallPhoneNumber,
    ),
    voiceSosEnabled: readBoolean(
      data.voiceSosEnabled,
      DEFAULT_SAFETY_SETTINGS.voiceSosEnabled,
    ),
    secretPhraseEnabled: readBoolean(
      data.secretPhraseEnabled,
      DEFAULT_SAFETY_SETTINGS.secretPhraseEnabled,
    ),
  };
}

export function normalizeUserProfile(
  data: Record<string, unknown>,
  uidFallback: string,
): UserModel {
  const now = new Date().toISOString();
  const role = readString(data.role, "user") as UserRole;
  const status = readString(data.status, "active") as UserStatus;

  return {
    uid: readString(data.uid, uidFallback),
    name: readString(data.name, readString(data.displayName)),
    email: readString(data.email),
    phone: readString(data.phone, readString(data.phoneNumber)),
    secretPhrase: normalizeSecretPhrase(data.secretPhrase) || undefined,
    role,
    status,
    preferences: normalizePreferences(data.preferences),
    safetySettings: buildUserSafetySettings(data.safetySettings),
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readNumber(data.schemaVersion, 1),
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export async function createUserProfile(input: CreateUserProfileInput): Promise<UserModel> {
  // TODO: Call this from an Auth user-created trigger or HTTPS endpoint when MVP auth flow is finalized.
  const now = new Date().toISOString();
  const profile: UserModel = {
    uid: input.uid,
    name: input.name,
    email: input.email,
    phone: input.phone,
    secretPhrase: normalizeSecretPhrase(input.secretPhrase),
    role: "user",
    status: "active",
    preferences: DEFAULT_PREFERENCES,
    safetySettings: getDefaultSafetySettings(),
    metadata: {},
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  await getFirestore().collection(COLLECTIONS.users).doc(input.uid).set(profile, { merge: true });
  return profile;
}

export async function getUserProfile(userId: string): Promise<UserModel | null> {
  const snapshot = await getFirestore().collection(COLLECTIONS.users).doc(userId).get();
  return snapshot.exists ? normalizeUserProfile(snapshot.data() ?? {}, snapshot.id) : null;
}

export const getUser = getUserProfile;
