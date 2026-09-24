/**
 * SOS audio clips — a short recording that starts the moment an SOS fires.
 *
 * The phone uploads `sos_audio/{uid}/{alertId}.m4a` (AAC, ~30 s). Storage
 * rules let only that user create it — once — and read it; it can never be
 * replaced or deleted from the app, so the evidence cannot be swapped. The
 * `onSosAudioUploaded` trigger then records it on the alert as
 * `evidence.audioClip`. Clients cannot write `evidence` after creation.
 */

export const SOS_AUDIO_PREFIX = "sos_audio/";

/** Largest clip accepted (also enforced by storage.rules). */
export const SOS_AUDIO_MAX_BYTES = 5 * 1024 * 1024;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface SosAudioObject {
  uid: string;
  alertId: string;
}

/** The owner and alert a Storage object is the clip of, or null. */
export function sosAudioFromPath(name: unknown): SosAudioObject | null {
  if (typeof name !== "string" || !name.startsWith(SOS_AUDIO_PREFIX)) {
    return null;
  }
  const parts = name.slice(SOS_AUDIO_PREFIX.length).split("/");
  if (parts.length !== 2) return null;
  const [uid, file] = parts;
  if (!file.endsWith(".m4a")) return null;
  const alertId = file.slice(0, -".m4a".length);
  if (!ID_PATTERN.test(uid) || !ID_PATTERN.test(alertId)) return null;
  return { uid, alertId };
}

export interface SosAudioClipEvidence {
  path: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  recordedAt: string | null;
  triggerType: string | null;
}

/** Builds `evidence.audioClip` from the uploaded object's metadata. */
export function buildAudioClipEvidence(
  path: string,
  contentType: string,
  sizeBytes: number,
  customMetadata: Record<string, string> | undefined,
): SosAudioClipEvidence {
  const durationMillis = Number(customMetadata?.durationMillis);
  const recordedAtMillis = Number(customMetadata?.recordedAtMillis);
  const triggerType = customMetadata?.triggerType;
  return {
    path,
    contentType,
    sizeBytes,
    durationSeconds: Number.isFinite(durationMillis) && durationMillis > 0
      ? Math.round(durationMillis / 100) / 10
      : null,
    recordedAt: Number.isFinite(recordedAtMillis) && recordedAtMillis > 0
      ? new Date(recordedAtMillis).toISOString()
      : null,
    triggerType: typeof triggerType === "string" && triggerType.length <= 20
      ? triggerType
      : null,
  };
}

/** True when the alert already has a recorded clip. */
export function hasAudioClip(alert: Record<string, unknown> | undefined): boolean {
  const evidence = alert?.evidence;
  if (typeof evidence !== "object" || evidence === null) return false;
  const clip = (evidence as { audioClip?: unknown }).audioClip;
  return typeof clip === "object" && clip !== null &&
    typeof (clip as { path?: unknown }).path === "string";
}
