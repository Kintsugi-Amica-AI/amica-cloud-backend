export const ALERT_TYPES = {
  timerExpiredNoResponse: "timer_expired_no_response",
  secretPhraseDetected: "secret_phrase_detected",
  manualSosPressed: "manual_sos_pressed",
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];
