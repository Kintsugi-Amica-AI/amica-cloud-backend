import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onObjectFinalized } from "firebase-functions/v2/storage";

import { getFirestore } from "../config/firebaseAdmin";
import { COLLECTIONS } from "../constants/collectionNames";
import {
  buildAudioClipEvidence,
  hasAudioClip,
  SOS_AUDIO_MAX_BYTES,
  sosAudioFromPath,
} from "../services/sosAudioService";

/**
 * Records an SOS audio clip on its alert (`evidence.audioClip`) once the
 * phone has uploaded `sos_audio/{uid}/{alertId}.m4a`.
 *
 * Only when the alert belongs to the uploader. A clip already recorded is
 * never replaced, which also makes event retries harmless.
 */
export const onSosAudioUploaded = onObjectFinalized(async (event) => {
  const object = event.data;
  const clip = sosAudioFromPath(object.name);
  if (!clip || object.contentType !== "audio/mp4") return;
  const sizeBytes = Number(object.size) || 0;
  if (sizeBytes <= 0 || sizeBytes > SOS_AUDIO_MAX_BYTES) return;

  const db = getFirestore();
  const alertRef = db.collection(COLLECTIONS.sosAlerts).doc(clip.alertId);
  await db.runTransaction(async (tx) => {
    const alert = (await tx.get(alertRef)).data();
    if (!alert) {
      logger.warn("SOS audio for a missing alert", { alertId: clip.alertId });
      return;
    }
    if (alert.userId !== clip.uid) {
      logger.warn("SOS audio owner mismatch", { alertId: clip.alertId });
      return;
    }
    if (hasAudioClip(alert)) return;
    tx.update(alertRef, {
      "evidence.audioClip": {
        ...buildAudioClipEvidence(
          object.name,
          object.contentType ?? "audio/mp4",
          sizeBytes,
          object.metadata,
        ),
        uploadedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
});
