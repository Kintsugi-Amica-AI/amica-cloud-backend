export async function sendSosNotifications(userId: string, alertId: string): Promise<void> {
  // TODO: Send push notifications/SMS to verified emergency contacts.
  console.info("SOS notification placeholder", { userId, alertId });
}

export async function sendJourneySafetyCheck(userId: string, journeyId: string): Promise<void> {
  // TODO: Notify the user before escalating an expired journey.
  console.info("Journey safety check placeholder", { userId, journeyId });
}
