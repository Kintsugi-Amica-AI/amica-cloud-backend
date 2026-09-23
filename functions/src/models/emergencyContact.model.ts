export interface EmergencyContactModel {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
  priority: number;
  isActive: boolean;
  notificationMethods: string[];
  /** Set by the server once the contact linked their Amica account. */
  guardianUid?: string;
  guardianName?: string;
  guardianLinkedAt?: string;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
