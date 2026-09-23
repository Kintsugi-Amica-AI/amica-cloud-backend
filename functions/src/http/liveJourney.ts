import { onRequest } from "firebase-functions/v2/https";

import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import {
  LiveShareDocument,
  buildLiveShareView,
  isShareExpired,
  isValidShareToken,
} from "../services/liveShareService";

/**
 * JSON for the public live journey page (`/j/{token}` on Hosting, which
 * rewrites `/api/live` here). Anyone with the link can read the trimmed
 * view; nothing else about her or the journey is reachable.
 */
export const liveJourney = onRequest({ cors: true }, async (request, response) => {
  response.set("Cache-Control", "no-store");
  response.set("X-Robots-Tag", "noindex");

  if (request.method !== "GET") {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const fromPath = request.path.split("/").filter(Boolean).pop();
  const token = typeof request.query.token === "string" ? request.query.token : fromPath;
  if (!isValidShareToken(token)) {
    response.status(404).json({ error: "not_found" });
    return;
  }

  const snapshot = await getFirestore().collection(COLLECTIONS.liveShares).doc(token).get();
  const share = snapshot.data() as LiveShareDocument | undefined;
  const now = new Date();
  if (!share) {
    response.status(404).json({ error: "not_found" });
    return;
  }
  if (isShareExpired(share, now)) {
    response.status(410).json({ error: "expired", ownerName: share.ownerName });
    return;
  }

  response.json(buildLiveShareView(share, now));
});
