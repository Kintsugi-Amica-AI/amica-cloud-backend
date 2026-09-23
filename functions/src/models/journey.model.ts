export type JourneyType = "walk" | "taxi" | "bus" | "train" | "other";
export type JourneyStatus = "active" | "safe" | "sos" | "cancelled" | "expired";

export interface GeoPointLike {
  latitude?: number;
  longitude?: number;
  address?: string;
  name?: string;
  updatedAt?: string;
}

export interface JourneySafetyCheck {
  required: boolean;
  responseDeadlineSeconds: number;
  respondedAt?: string | null;
}

/**
 * Smart Stop Alert settings on a bus ride.
 *
 * Present only on rides started from the mobile Bus Stop Alert flow, which
 * watch the distance to `destination` instead of counting down a safety timer.
 * Absent on ordinary timer journeys.
 */
export interface JourneyStopAlert {
  enabled: boolean;
  /** How close to the drop-off the alarm sounds. */
  alertDistanceMeters: number;
  /** Null until the approaching-stop alarm has sounded for this ride. */
  alertedAt?: string | null;
}

/**
 * A pause on a timer journey, written by the mobile app.
 *
 * While paused, `estimatedEndTime` is already moved to `resumeAt` plus the
 * time that was left, so anything that checks the deadline (including
 * `hasJourneyExpired`) keeps working without knowing about pauses. Cleared
 * when the user resumes early.
 */
export interface JourneyPause {
  pausedAt: string;
  /** When the timer resumes on its own if the user does not resume it first. */
  resumeAt: string;
  /** Countdown time left when the pause started, in seconds. */
  remainingSeconds: number;
}

/** Suggested route saved when the journey started. */
export interface JourneyRouteSnapshot {
  mode: "walking" | "driving";
  distanceMeters: number;
  durationSeconds: number;
  /** Google encoded polyline. */
  polyline: string;
  summary?: string;
}

export interface JourneyLiveShare {
  token: string;
  url: string;
  createdAt: string;
  /** When linked guardians were last pushed the link. */
  pushedAt?: string;
}

export const DEFAULT_STOP_ALERT_DISTANCE_METERS = 2000;

export interface JourneyModel {
  id: string;
  userId: string;
  journeyType: JourneyType;
  status: JourneyStatus;
  startLocation?: GeoPointLike;
  currentLocation?: GeoPointLike;
  destination?: GeoPointLike;
  estimatedDurationMinutes?: number;
  estimatedEndTime?: string;
  actualEndTime?: string;
  safetyCheck?: JourneySafetyCheck;
  stopAlert?: JourneyStopAlert;
  pause?: JourneyPause | null;
  route?: JourneyRouteSnapshot | null;
  /** Watch-live link, written only by `startJourneyShare`. */
  liveShare?: JourneyLiveShare;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
