import { randomInt } from "node:crypto";

/**
 * Linking an emergency contact to their own Amica account, so alerts reach
 * them as push notifications as well as SMS.
 *
 * The owner asks for an invite code for one contact and her phone texts it
 * to that contact's number. Whoever types the code into Amica has therefore
 * read an SMS sent to that number, which is the proof we need while phone
 * numbers on profiles are not verified. Codes are single use and expire.
 */

/** No 0/O, 1/I/L: the code is read off an SMS and typed by hand. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type GuardianResponse = "calling" | "alerted_others";

export const GUARDIAN_RESPONSES: readonly GuardianResponse[] = [
  "calling",
  "alerted_others",
];

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/** Upper-cases and drops spaces/dashes; null if it cannot be a code. */
export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== INVITE_CODE_LENGTH) return null;
  for (const char of code) {
    if (!INVITE_ALPHABET.includes(char)) return null;
  }
  return code;
}

export interface InviteRecord {
  userId: string;
  contactId: string;
  expiresAt: string;
  usedAt?: string | null;
}

export type InviteProblem = "not_found" | "expired" | "used" | "own_invite";

export function inviteProblem(
  invite: InviteRecord | undefined,
  acceptingUid: string,
  now: Date,
): InviteProblem | null {
  if (!invite) return "not_found";
  if (invite.usedAt) return "used";
  if (Date.parse(invite.expiresAt) < now.getTime()) return "expired";
  if (invite.userId === acceptingUid) return "own_invite";
  return null;
}

export function isGuardianResponse(value: unknown): value is GuardianResponse {
  return typeof value === "string" && GUARDIAN_RESPONSES.includes(value as GuardianResponse);
}
