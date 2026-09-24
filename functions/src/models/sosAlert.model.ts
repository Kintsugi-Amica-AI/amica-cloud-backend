import { AlertType } from "../constants/alertTypes";
import { GeoPointLike } from "./journey.model";

export type SosAlertStatus = "active" | "sent" | "resolved" | "cancelled";

export interface SosAlertEvidence {
  voicePhraseDetected?: boolean;
  detectedPhrase?: string;
  expectedPhrase?: string;
  voiceConfidenceScore?: number;
  fakeCallActive?: boolean;
  scannedPlateNumber?: string;
  confidenceScore?: number;
  /** Server: the SOS audio clip, set by `onSosAudioUploaded`. */
  audioClip?: {
    path: string;
    contentType: string;
    sizeBytes: number;
    durationSeconds: number | null;
    recordedAt: string | null;
    triggerType: string | null;
    uploadedAt: unknown;
  };
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
  /** Server: which linked contacts the SOS push reached. */
  push?: { sentAt: unknown; reachedContactIds: string[] };
  /** Server: one-tap replies from linked contacts, keyed by their uid. */
  guardianResponses?: Record<
    string,
    { contactId: string; name: string; response: "calling" | "alerted_others"; at: string }
  >;
  evidence: SosAlertEvidence;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
