import { AlertType } from "../constants/alertTypes";
import { GeoPointLike } from "./journey.model";

export type SosAlertStatus = "active" | "sent" | "resolved" | "cancelled";

export interface SosAlertEvidence {
  voicePhraseDetected?: boolean;
  scannedPlateNumber?: string;
  confidenceScore?: number;
}

export interface SosAlertModel {
  id: string;
  userId: string;
  triggerType: AlertType;
  status: SosAlertStatus;
  journeyId?: string;
  location?: GeoPointLike;
  message?: string;
  notifiedContacts: string[];
  evidence: SosAlertEvidence;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
