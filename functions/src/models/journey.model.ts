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
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
