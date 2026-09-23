import { getMessaging } from "firebase-admin/messaging";

import { COLLECTIONS } from "../constants/collectionNames";
import { getFirebaseAdminApp, getFirestore } from "../config/firebaseAdmin";
import { GuardianResponse } from "./guardianService";

/**
 * Push notifications to Amica users.
 *
 * Every message is data-only with high priority. The app draws the
 * notification itself (in the background isolate when closed) so it can add
 * the one-tap reply buttons and show it in the user's own language. `title`
 * and `body` are English fallbacks for anything that cannot localise.
 */

export type PushType =
  | "sos"
  | "journey_started"
  | "journey_arrived"
  | "guardian_response"
  | "guardian_linked";

export interface PushMessage {
  type: PushType;
  title: string;
  body: string;
  /** All values are strings: FCM data payloads cannot carry anything else. */
  data: Record<string, string>;
}

function mapsUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function nameOr(name: string, fallback: string): string {
  return name.trim() || fallback;
}

export function buildSosPush(input: {
  alertId: string;
  ownerUid: string;
  ownerName: string;
  ownerPhone: string;
  triggerType: string;
  latitude?: number;
  longitude?: number;
  liveUrl?: string | null;
}): PushMessage {
  const name = nameOr(input.ownerName, "Someone in your circle");
  const hasLocation =
    typeof input.latitude === "number" && typeof input.longitude === "number";
  return {
    type: "sos",
    title: `${name} needs help`,
    body: hasLocation
      ? "SOS from Amica. Tap to see where she is and reply."
      : "SOS from Amica. Tap to reply.",
    data: {
      alertId: input.alertId,
      ownerUid: input.ownerUid,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      triggerType: input.triggerType,
      ...(hasLocation
        ? {
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          mapsUrl: mapsUrl(input.latitude as number, input.longitude as number),
        }
        : {}),
      ...(input.liveUrl ? { liveUrl: input.liveUrl } : {}),
    },
  };
}

export function buildJourneyStartedPush(input: {
  journeyId: string;
  ownerUid: string;
  ownerName: string;
  ownerPhone: string;
  destinationName: string;
  liveUrl: string;
}): PushMessage {
  const name = nameOr(input.ownerName, "Someone in your circle");
  return {
    type: "journey_started",
    title: `${name} is sharing her journey`,
    body: input.destinationName
      ? `Heading to ${input.destinationName}. Tap to watch live.`
      : "Tap to watch live.",
    data: {
      journeyId: input.journeyId,
      ownerUid: input.ownerUid,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      destinationName: input.destinationName,
      liveUrl: input.liveUrl,
    },
  };
}

export function buildJourneyArrivedPush(input: {
  journeyId: string;
  ownerUid: string;
  ownerName: string;
  destinationName: string;
}): PushMessage {
  const name = nameOr(input.ownerName, "Someone in your circle");
  return {
    type: "journey_arrived",
    title: `${name} arrived safely`,
    body: input.destinationName
      ? `Her journey to ${input.destinationName} has ended.`
      : "Her journey has ended.",
    data: {
      journeyId: input.journeyId,
      ownerUid: input.ownerUid,
      ownerName: input.ownerName,
      destinationName: input.destinationName,
    },
  };
}

export function buildGuardianResponsePush(input: {
  alertId: string;
  guardianName: string;
  response: GuardianResponse;
}): PushMessage {
  const name = nameOr(input.guardianName, "Your contact");
  return {
    type: "guardian_response",
    title: input.response === "calling"
      ? `${name} is calling you now`
      : `${name} has alerted others`,
    body: input.response === "calling"
      ? "Keep your phone close."
      : "More people know you need help.",
    data: {
      alertId: input.alertId,
      guardianName: input.guardianName,
      response: input.response,
    },
  };
}

export function buildGuardianLinkedPush(input: {
  contactId: string;
  guardianName: string;
}): PushMessage {
  const name = nameOr(input.guardianName, "Your contact");
  return {
    type: "guardian_linked",
    title: `${name} is connected in Amica`,
    body: "They will now get your alerts as notifications as well as texts.",
    data: { contactId: input.contactId, guardianName: input.guardianName },
  };
}

/** Uids of the owner's active contacts who have linked their Amica account. */
export async function linkedGuardians(
  ownerUid: string,
): Promise<Array<{ contactId: string; guardianUid: string }>> {
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.emergencyContacts)
    .where("userId", "==", ownerUid)
    .get();
  const seen = new Set<string>();
  const result: Array<{ contactId: string; guardianUid: string }> = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const guardianUid = data.guardianUid;
    if (
      data.isActive === false ||
      typeof guardianUid !== "string" ||
      !guardianUid ||
      guardianUid === ownerUid ||
      seen.has(guardianUid)
    ) {
      continue;
    }
    seen.add(guardianUid);
    result.push({ contactId: doc.id, guardianUid });
  }
  return result;
}

export async function tokensForUsers(uids: string[]): Promise<Map<string, string[]>> {
  const byUser = new Map<string, string[]>();
  const db = getFirestore();
  // `in` queries take at most 30 values.
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const snapshot = await db
      .collection(COLLECTIONS.fcmTokens)
      .where("userId", "in", chunk)
      .get();
    for (const doc of snapshot.docs) {
      const uid = String(doc.data().userId);
      byUser.set(uid, [...(byUser.get(uid) ?? []), doc.id]);
    }
  }
  return byUser;
}

const STALE_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Sends [message] to every device of every uid. Returns the uids that at
 * least one device accepted, and deletes tokens FCM says are dead.
 */
export async function sendPushToUsers(
  uids: string[],
  message: PushMessage,
): Promise<Set<string>> {
  const reached = new Set<string>();
  if (uids.length === 0) return reached;

  const tokensByUser = await tokensForUsers(uids);
  const entries: Array<{ uid: string; token: string }> = [];
  for (const [uid, tokens] of tokensByUser) {
    for (const token of tokens) entries.push({ uid, token });
  }
  if (entries.length === 0) return reached;

  const messaging = getMessaging(getFirebaseAdminApp());
  const stale: string[] = [];
  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map((entry) => entry.token),
      data: { type: message.type, title: message.title, body: message.body, ...message.data },
      android: {
        priority: "high",
        // An SOS older than an hour is no longer actionable as a notification.
        ttl: message.type === "sos" ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000,
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            alert: { title: message.title, body: message.body },
            sound: "default",
            ...(message.type === "sos" ? { "interruption-level": "time-sensitive" } : {}),
          },
        },
      },
    });
    response.responses.forEach((result, index) => {
      if (result.success) {
        reached.add(batch[index].uid);
      } else if (result.error && STALE_TOKEN_ERRORS.has(result.error.code)) {
        stale.push(batch[index].token);
      }
    });
  }

  if (stale.length > 0) {
    const db = getFirestore();
    await Promise.all(
      stale.map((token) =>
        db.collection(COLLECTIONS.fcmTokens).doc(token).delete().catch(() => undefined),
      ),
    );
  }
  return reached;
}

export interface OwnerProfile {
  name: string;
  firstName: string;
  phone: string;
}

export async function ownerProfile(uid: string): Promise<OwnerProfile> {
  const data = (await getFirestore().collection(COLLECTIONS.users).doc(uid).get()).data() ?? {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  return {
    name,
    firstName: name.split(/\s+/)[0] ?? "",
    phone: typeof data.phone === "string" ? data.phone.trim() : "",
  };
}
