import { AlertType } from "../constants/alertTypes";

export type SosAlertStatus = "created" | "notified" | "resolved";

export interface SosAlertModel {
  id: string;
  userId: string;
  triggerType: AlertType;
  status: SosAlertStatus;
  createdAt: string;
  latitude?: number;
  longitude?: number;
}
