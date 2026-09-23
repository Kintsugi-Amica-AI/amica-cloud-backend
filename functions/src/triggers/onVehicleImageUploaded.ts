import { FieldValue } from "firebase-admin/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";

import { getFirestore } from "../config/firebaseAdmin";
import {
  hasVehicleImage,
  plateFromImagePath,
} from "../services/vehicleImageService";

/**
 * Records a vehicle's first photo on `vehicles/{plate}.image` once the phone
 * has uploaded `vehicle_images/{plate}.jpg`. Clients cannot write `vehicles`,
 * so this is the only way the field is set. An existing photo is never
 * replaced, which also makes event retries harmless.
 */
export const onVehicleImageUploaded = onObjectFinalized(async (event) => {
  const object = event.data;
  const plate = plateFromImagePath(object.name);
  if (!plate || object.contentType !== "image/jpeg") return;
  await recordVehicleImage(plate, object.name, Number(object.size) || 0);
});

export async function recordVehicleImage(
  plate: string,
  path: string,
  sizeBytes: number,
): Promise<void> {
  const db = getFirestore();
  const vehicleRef = db.collection("vehicles").doc(plate);
  await db.runTransaction(async (tx) => {
    const vehicle = (await tx.get(vehicleRef)).data();
    if (hasVehicleImage(vehicle)) return;
    tx.set(vehicleRef, {
      ...(!vehicle ? {
        plateNumber: plate, normalizedPlateNumber: plate,
        status: "unknown", reportsCount: 0, riskLevel: "unknown",
        metadata: {}, schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
      } : {}),
      // No uploader id: vehicles are readable by every signed-in rider.
      image: {
        path,
        sizeBytes,
        createdAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
