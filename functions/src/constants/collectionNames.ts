export const COLLECTIONS = {
  users: "users",
  emergencyContacts: "emergency_contacts",
  journeys: "journeys",
  sosAlerts: "sos_alerts",
  vehicles: "vehicles",
  liveShares: "live_shares",
  guardianInvites: "guardian_invites",
  fcmTokens: "fcm_tokens",
  // Website contact form (server-only; see http/submitContactMessage.ts).
  contactMessages: "contact_messages",
  contactRateLimits: "contact_rate_limits",
} as const;
