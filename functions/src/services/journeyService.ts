import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { JourneyModel } from "../models/journey.model";

export async function getJourney(journeyId: string): Promise<JourneyModel | null> {
  // TODO: Add ownership checks before exposing journey data to clients.
  const snapshot = await getFirestore().collection(COLLECTIONS.journeys).doc(journeyId).get();
  return snapshot.exists ? ({ id: snapshot.id, ...snapshot.data() } as JourneyModel) : null;
}

export function hasJourneyExpired(journey: JourneyModel, now = new Date()): boolean {
  return journey.status === "active" && new Date(journey.expectedArrivalAt) < now;
}
