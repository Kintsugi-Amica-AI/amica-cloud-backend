import { randomBytes } from "node:crypto";

/**
 * "Watch my journey live" links.
 *
 * A share is a `live_shares/{token}` document holding only what a contact
 * needs to see: her first name, where she is heading, where she is now and
 * whether the journey is still going. The token is the whole secret (128
 * random bits), so the page needs no sign-in, and the journey document itself
 * is never exposed. Clients cannot read `live_shares` at all; the page gets a
 * trimmed view through the `liveJourney` HTTP function.
 */

export type LiveShareStatus = "active" | "sos" | "ended";

/** How long a link keeps working after the journey's deadline. */
export const LIVE_SHARE_GRACE_MS = 12 * 60 * 60 * 1000;

export interface LiveSharePoint {
  latitude: number;
  longitude: number;
  updatedAt: string | null;
}

export interface LiveShareDocument {
  token: string;
  userId: string;
  journeyId: string;
  ownerName: string;
  status: LiveShareStatus;
  journeyType: string;
  destinationName: string;
  destination: LiveSharePoint | null;
  location: LiveSharePoint | null;
  estimatedEndTime: string | null;
  endedAt: string | null;
  endReason: string | null;
  routePolyline: string | null;
  expiresAt: string;
}

/** What the public page receives. */
export interface LiveShareView {
  status: LiveShareStatus;
  ownerName: string;
  journeyType: string;
  destinationName: string;
  destination: LiveSharePoint | null;
  location: LiveSharePoint | null;
  estimatedEndTime: string | null;
  endedAt: string | null;
  endReason: string | null;
  routePolyline: string | null;
  serverTime: string;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export function generateShareToken(): string {
  return randomBytes(16).toString("base64url");
}

export function isValidShareToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function liveShareBaseUrl(): string {
  const configured = process.env.LIVE_SHARE_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const projectId =
    process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "amica-cloud-backend";
  return `https://${projectId}.web.app`;
}

export function buildShareUrl(token: string, baseUrl = liveShareBaseUrl()): string {
  return `${baseUrl.replace(/\/+$/, "")}/j/${token}`;
}

/** First word of a display name, so the page never shows a full name. */
export function firstName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts Firestore Timestamps, Dates and ISO strings. */
export function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (isRecord(value) && typeof value.toDate === "function") {
    return (value.toDate as () => Date)().toISOString();
  }
  return null;
}

export function readPoint(value: unknown): LiveSharePoint | null {
  if (!isRecord(value)) return null;
  const { latitude, longitude } = value;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, updatedAt: toIso(value.updatedAt) };
}

export function shareStatusForJourney(journeyStatus: unknown): LiveShareStatus {
  if (journeyStatus === "active") return "active";
  if (journeyStatus === "sos") return "sos";
  return "ended";
}

export function shareExpiry(estimatedEndTime: unknown, now: Date): string {
  const end = Date.parse(toIso(estimatedEndTime) ?? "") || now.getTime();
  return new Date(Math.max(end, now.getTime()) + LIVE_SHARE_GRACE_MS).toISOString();
}

/**
 * The fields of a share that follow the journey. Called when the share is
 * created and on every journey update, so the page always mirrors the
 * journey without the app writing anything twice.
 */
export function shareFieldsFromJourney(
  journey: Record<string, unknown>,
  now: Date,
): Omit<LiveShareDocument, "token" | "userId" | "journeyId" | "ownerName"> {
  const status = shareStatusForJourney(journey.status);
  const destination = isRecord(journey.destination) ? journey.destination : {};
  const route = isRecord(journey.route) ? journey.route : {};
  const destinationName =
    typeof destination.name === "string" && destination.name.trim()
      ? destination.name.trim()
      : typeof destination.address === "string"
        ? destination.address.trim()
        : "";
  const location =
    readPoint(journey.currentLocation) ?? readPoint(journey.startLocation);

  return {
    status,
    journeyType: typeof journey.journeyType === "string" ? journey.journeyType : "walk",
    destinationName: destinationName.slice(0, 120),
    destination: readPoint(destination),
    location,
    estimatedEndTime: toIso(journey.estimatedEndTime),
    endedAt: status === "ended" ? toIso(journey.actualEndTime) ?? now.toISOString() : null,
    endReason: status === "ended" && typeof journey.status === "string" ? journey.status : null,
    routePolyline:
      typeof route.polyline === "string" && route.polyline.length < 20000
        ? route.polyline
        : null,
    expiresAt: shareExpiry(journey.estimatedEndTime, now),
  };
}

export function isShareExpired(share: Pick<LiveShareDocument, "expiresAt">, now: Date): boolean {
  const expires = Date.parse(share.expiresAt);
  return Number.isNaN(expires) || now.getTime() > expires;
}

/**
 * The trimmed, public view. Once the journey has ended her position is
 * withheld: the link keeps saying she arrived, but no longer where she is.
 */
export function buildLiveShareView(share: LiveShareDocument, now: Date): LiveShareView {
  const ended = share.status === "ended";
  return {
    status: share.status,
    ownerName: share.ownerName,
    journeyType: share.journeyType,
    destinationName: share.destinationName,
    destination: ended ? null : share.destination,
    location: ended ? null : share.location,
    estimatedEndTime: share.estimatedEndTime,
    endedAt: share.endedAt,
    endReason: share.endReason,
    routePolyline: ended ? null : share.routePolyline,
    serverTime: now.toISOString(),
  };
}
