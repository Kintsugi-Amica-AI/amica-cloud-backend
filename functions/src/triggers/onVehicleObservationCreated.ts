import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "../config/firebaseAdmin";
import { addObservation } from "../services/vehicleObservationService";

// Observation ids are `{plate}_{uid}`: one per user per plate. The
// `aggregatedAt` marker makes event retries harmless.
export const onVehicleObservationCreated = onDocumentCreated(
  "vehicle_observations/{observationId}",
  async (event) => {
    if (!event.data) return;
    await aggregateVehicleObservation(event.params.observationId);
  },
);

export async function aggregateVehicleObservation(
  observationId: string,
): Promise<void> {
  const db = getFirestore();
  const observationRef = db.collection("vehicle_observations")
    .doc(observationId);
  await db.runTransaction(async (tx) => {
    const observation = (await tx.get(observationRef)).data();
    if (!observation || observation.aggregatedAt) return;
    const plate = observation.vehiclePlate;
    if (typeof plate !== "string" || !/^[A-Z]{2,3}[0-9]{4}$/.test(plate) ||
        observationId !== `${plate}_${observation.userId}`) return;

    const vehicleRef = db.collection("vehicles").doc(plate);
    const vehicle = (await tx.get(vehicleRef)).data();
    const profile = addObservation(vehicle?.observedProfile, observation);
    if (profile) {
      tx.set(vehicleRef, {
        ...(!vehicle ? {
          plateNumber: plate, normalizedPlateNumber: plate,
          status: "unknown", reportsCount: 0, riskLevel: "unknown",
          metadata: {}, schemaVersion: 1,
          createdAt: FieldValue.serverTimestamp(),
        } : {}),
        observedProfile: {
          ...profile,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    tx.update(observationRef, {
      aggregatedAt: FieldValue.serverTimestamp(),
    });
  });
}
