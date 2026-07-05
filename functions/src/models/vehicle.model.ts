export type VehicleStatus = "Safe" | "Reported" | "Unknown";

export interface VehicleModel {
  plateNumber: string;
  status: VehicleStatus;
  notes?: string;
  updatedAt?: string;
}
