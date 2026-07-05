export type VehicleStatus = "safe" | "reported" | "unknown";
export type VehicleRiskLevel = "low" | "medium" | "high" | "unknown";

export interface VehicleModel {
  plateNumber: string;
  normalizedPlateNumber: string;
  status: VehicleStatus;
  reportsCount: number;
  riskLevel: VehicleRiskLevel;
  notes?: string;
  lastCheckedAt?: string;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
