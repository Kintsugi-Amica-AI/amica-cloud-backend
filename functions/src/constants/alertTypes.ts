export const ALERT_TYPES = {
  timer: "timer",
  voice: "voice",
  manual: "manual",
  plateScan: "plate_scan",
  unknown: "unknown",
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];
