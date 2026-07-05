import {
  buildUnknownVehicle,
  checkVehicleStatus,
  normalizePlateNumber,
} from "../services/vehicleService";
import { VehicleModel } from "../models/vehicle.model";

const sampleVehicle: VehicleModel = {
  plateNumber: "WP CA 9876",
  normalizedPlateNumber: "WPCA9876",
  status: "reported",
  reportsCount: 3,
  riskLevel: "high",
  notes: "Demo vehicle",
  metadata: {},
  schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export function vehicleServiceSmokeTest(): boolean {
  // TODO: Replace with Firestore emulator vehicle lookup tests.
  const reportedVehicle = checkVehicleStatus("wp ca 9876", [sampleVehicle]);
  const unknownVehicle = buildUnknownVehicle("");

  return (
    normalizePlateNumber(" wp-ca 9876 ") === "WPCA9876" &&
    reportedVehicle.status === "reported" &&
    unknownVehicle.status === "unknown"
  );
}
