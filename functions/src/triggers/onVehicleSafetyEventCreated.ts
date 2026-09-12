import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "../config/firebaseAdmin";

export const onVehicleSafetyEventCreated = onDocumentCreated(
  "vehicle_safety_events/{journeyId}", async (event) => {
    if (!event.data) return;
    await aggregateVehicleSafetyEvent(event.params.journeyId);
  },
);

export async function aggregateVehicleSafetyEvent(journeyId: string): Promise<void> {
    const db = getFirestore();
    const eventRef = db.collection("vehicle_safety_events").doc(journeyId);
    await db.runTransaction(async (tx) => {
      const incident = (await tx.get(eventRef)).data();
      if (!incident || incident.aggregatedAt ||
          !/^[A-Z]{2,3}[0-9]{4}$/.test(incident.vehiclePlate)) return;
      const journey = (await tx.get(db.collection("journeys").doc(journeyId))).data();
      if (!journey || journey.userId !== incident.userId ||
          journey.metadata?.vehiclePlate !== incident.vehiclePlate) return;
      const ref = db.collection("vehicles").doc(incident.vehiclePlate);
      const vehicle = (await tx.get(ref)).data();
      tx.set(ref, {
        ...(!vehicle ? {
          plateNumber: incident.vehiclePlate, normalizedPlateNumber: incident.vehiclePlate,
          status: "unknown", reportsCount: 0, riskLevel: "unknown", metadata: {}, schemaVersion: 1,
          createdAt: FieldValue.serverTimestamp(),
        } : {}),
        unverifiedSafetyCheckCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.update(eventRef, { aggregatedAt: FieldValue.serverTimestamp() });
    });
}
