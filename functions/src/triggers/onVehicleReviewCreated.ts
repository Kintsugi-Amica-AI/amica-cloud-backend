import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "../config/firebaseAdmin";
import { addRating } from "../services/vehicleRatingService";

// Reviews use journey IDs. The transaction marker makes event retries harmless.
export const onVehicleReviewCreated = onDocumentCreated(
  "vehicle_reviews/{journeyId}",
  async (event) => {
    if (!event.data) return;
    await aggregateVehicleReview(event.params.journeyId);
  },
);

export async function aggregateVehicleReview(journeyId: string): Promise<void> {
    const db = getFirestore();
    const reviewRef = db.collection("vehicle_reviews").doc(journeyId);
    await db.runTransaction(async (transaction) => {
      const reviewSnapshot = await transaction.get(reviewRef);
      const review = reviewSnapshot.data();
      if (!review || review.aggregatedAt) return;
      const journey = (await transaction.get(
        db.collection("journeys").doc(journeyId),
      )).data();
      if (!journey || journey.status !== "safe" ||
          journey.userId !== review.userId ||
          journey.metadata?.vehiclePlate !== review.vehiclePlate ||
          !/^[A-Z]{2,3}[0-9]{4}$/.test(review.vehiclePlate)) return;
      const vehicleRef = db.collection("vehicles").doc(review.vehiclePlate);
      const vehicle = (await transaction.get(vehicleRef)).data();
      const aggregate = addRating(vehicle?.ratingTotal ?? 0,
        vehicle?.ratingCount ?? 0, review.stars);
      transaction.set(vehicleRef, {
        ...(!vehicle ? {
          plateNumber: review.vehiclePlate,
          normalizedPlateNumber: review.vehiclePlate,
          status: "unknown", reportsCount: 0, riskLevel: "unknown",
          metadata: {}, schemaVersion: 1,
          createdAt: FieldValue.serverTimestamp(),
        } : {}),
        ...aggregate, updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.update(reviewRef, { aggregatedAt: FieldValue.serverTimestamp() });
    });
}
