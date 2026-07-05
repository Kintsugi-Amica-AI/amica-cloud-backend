# API Flow

## SOS alert

1. Mobile app creates an `sos_alerts` document.
2. `onSosAlertCreated` validates the alert payload.
3. Notification service locates emergency contacts.
4. Trusted contacts receive an alert with live location context.

## Journey timer

1. Mobile app creates a `journeys` document.
2. User confirms arrival or responds to a safety check.
3. If no response is recorded, the backend can escalate to SOS.

## Vehicle status

1. Mobile app sends OCR plate text to the backend or AI integration.
2. Backend checks `vehicles`.
3. Mobile app displays Safe, Reported, or Unknown.
