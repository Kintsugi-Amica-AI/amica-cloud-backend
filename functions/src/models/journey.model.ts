export type JourneyType = "walk" | "taxi" | "bus" | "train" | "other";
export type JourneyStatus = "active" | "safe" | "sos" | "cancelled" | "expired";

export interface GeoPointLike {
  latitude?: number;
  longitude?: number;
  address?: string;
  name?: string;
}

export interface JourneySafetyCheck {
  required: boolean;
  responseDeadlineSeconds: number;
  respondedAt?: string | null;
}

export interface JourneyModel {
  id: string;
  userId: string;
  journeyType: JourneyType;
  status: JourneyStatus;
  startLocation?: GeoPointLike;
  destination?: GeoPointLike;
  estimatedEndTime?: string;
  actualEndTime?: string;
  safetyCheck?: JourneySafetyCheck;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
