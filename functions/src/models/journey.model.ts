export type JourneyStatus = "active" | "completed" | "expired" | "cancelled";

export interface JourneyModel {
  id: string;
  userId: string;
  destination: string;
  status: JourneyStatus;
  startedAt: string;
  expectedArrivalAt: string;
  completedAt?: string;
}
