export type UserRole = "user" | "admin" | "tester";
export type UserStatus = "active" | "disabled";

export interface UserPreferences {
  language: string;
  notificationsEnabled: boolean;
  locationSharingEnabled: boolean;
}

export interface UserSafetySettings {
  defaultEmergencyMessage: string;
  autoSosDelaySeconds: number;
  fakeCallContactName: string;
  fakeCallPhoneNumber: string;
  voiceSosEnabled: boolean;
  secretPhraseEnabled: boolean;
}

export interface UserModel {
  uid: string;
  name: string;
  email: string;
  phone: string;
  secretPhrase?: string;
  role: UserRole;
  status: UserStatus;
  preferences: UserPreferences;
  safetySettings: UserSafetySettings;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
