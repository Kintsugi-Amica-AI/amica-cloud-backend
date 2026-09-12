import { COLLECTIONS } from "../constants/collectionNames";
import { getFirestore } from "../config/firebaseAdmin";
import { VehicleModel, VehicleRiskLevel, VehicleStatus } from "../models/vehicle.model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function normalizePlateNumber(plateNumber: string): string {
  return plateNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function buildUnknownVehicle(plateNumber: string): VehicleModel {
  const now = new Date().toISOString();
  const normalizedPlateNumber = normalizePlateNumber(plateNumber);
  return {
    plateNumber: plateNumber || "UNKNOWN",
    normalizedPlateNumber: normalizedPlateNumber || "UNKNOWN",
    status: "unknown",
    reportsCount: 0,
    riskLevel: "unknown",
    notes: "No vehicle record found.",
    metadata: {},
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeVehicle(
  data: Record<string, unknown>,
  plateFallback: string,
): VehicleModel {
  const now = new Date().toISOString();
  const plateNumber = readString(data.plateNumber, plateFallback || "UNKNOWN");
  return {
    plateNumber,
    normalizedPlateNumber: readString(
      data.normalizedPlateNumber,
      normalizePlateNumber(plateNumber),
    ),
    status: readString(data.status, "unknown") as VehicleStatus,
    reportsCount: readNumber(data.reportsCount, 0),
    ratingTotal: readNumber(data.ratingTotal, 0),
    ratingCount: readNumber(data.ratingCount, 0),
    ratingAverage: readNumber(data.ratingAverage, 0),
    unverifiedSafetyCheckCount: readNumber(data.unverifiedSafetyCheckCount, 0),
    riskLevel: readString(data.riskLevel, "unknown") as VehicleRiskLevel,
    notes: readString(data.notes) || undefined,
    lastCheckedAt: readString(data.lastCheckedAt) || undefined,
    metadata: isRecord(data.metadata) ? data.metadata : {},
    schemaVersion: readNumber(data.schemaVersion, 1),
    createdAt: readString(data.createdAt, now),
    updatedAt: readString(data.updatedAt, now),
  };
}

export function checkVehicleStatus(
  plateNumber: string,
  knownVehicles: VehicleModel[] = [],
): VehicleModel {
  // TODO: Replace in-memory lookup with Firestore query or admin-managed import pipeline.
  const normalizedPlateNumber = normalizePlateNumber(plateNumber);
  const match = knownVehicles.find(
    (vehicle) => vehicle.normalizedPlateNumber === normalizedPlateNumber,
  );

  return match ?? buildUnknownVehicle(plateNumber);
}

export async function getVehicleStatus(plateNumber: string): Promise<VehicleModel> {
  const normalizedPlateNumber = normalizePlateNumber(plateNumber);
  if (!normalizedPlateNumber) {
    return buildUnknownVehicle(plateNumber);
  }

  const snapshot = await getFirestore()
    .collection(COLLECTIONS.vehicles)
    .doc(normalizedPlateNumber)
    .get();

  return snapshot.exists
    ? normalizeVehicle(snapshot.data() ?? {}, normalizedPlateNumber)
    : buildUnknownVehicle(plateNumber);
}
