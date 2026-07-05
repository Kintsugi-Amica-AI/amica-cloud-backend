export interface EmergencyContactModel {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
  priority: number;
  isActive: boolean;
  notificationMethods: string[];
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
