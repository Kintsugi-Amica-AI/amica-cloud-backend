# API Flow

## SOS alert

1. Mobile app creates an `sos_alerts` document.
2. `onSosAlertCreated` validates the alert payload.
3. The phone texts every active contact from her own SIM (mobile
   `CircleAlertService`).
4. `sendSosNotifications` pushes the alert to contacts linked in Amica, with
   her location and the live journey link when there is one.
5. Linked contacts can reply ("Calling now" / "I've alerted others") through
   `respondToAlert`; replies appear on her SOS screen and as a push.

## Journey timer

1. Mobile app creates a `journeys` document.
2. User confirms arrival or responds to a safety check.
3. If no response is recorded, the backend can escalate to SOS.
4. With "Share live with my circle", `startJourneyShare` creates a watch-live
   link; the phone keeps `currentLocation` fresh and `onJourneyUpdated`
   mirrors it to the public page. See
   [live_journey_and_circle_push.md](live_journey_and_circle_push.md).

## Vehicle status

1. Mobile app sends OCR plate text to the backend or AI integration.
2. Backend checks `vehicles`.
3. Mobile app displays Safe, Reported, or Unknown.
