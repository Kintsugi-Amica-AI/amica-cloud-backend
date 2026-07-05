import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { VehicleModel } from "../models/vehicle.model";

export async function getVehicleStatus(plateNumber: string): Promise<VehicleModel> {
  // TODO: Normalize regional plate formats before lookup.
  const normalizedPlate = plateNumber.trim().toUpperCase();
  const snapshot = await getFirestore().collection(COLLECTIONS.vehicles).doc(normalizedPlate).get();

  if (!snapshot.exists) {
    return {
      plateNumber: normalizedPlate,
      status: "Unknown",
      notes: "No vehicle record found.",
    };
  }

  return {
    plateNumber: normalizedPlate,
    ...snapshot.data(),
  } as VehicleModel;
}
