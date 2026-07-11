# Schema Evolution

Amica is an MVP prototype, but the Firestore schema should be flexible enough to support future safety features.

The current implementation focuses only on these MVP collections:

- `users`
- `emergency_contacts`
- `journeys`
- `sos_alerts`
- `vehicles`

Future collections are documented here only. They should not be implemented until the feature is approved and Firestore security rules are designed.

## Evolution Principles

- Prefer optional fields for new feature data.
- Keep required fields stable.
- Add `schemaVersion` to major documents.
- Add `createdAt` and `updatedAt` timestamps to major documents.
- Use `metadata` maps for experimental or feature-specific values.
- Avoid moving existing fields unless there is a migration plan.
- Mobile and backend code should use default values when optional fields are missing.

## Future Feature Examples

### Smart Stop Alert

Smart Stop Alert can extend `journeys`.

Useful existing fields:

- `journeyType`
- `destination`
- `status`
- `safetyCheck`
- `metadata`

Example future metadata:

```json
{
  "metadata": {
    "smartStopEnabled": true,
    "expectedStops": ["Main Gate", "Library"],
    "unexpectedStopDetected": false
  }
}
```

### Fake Call

Fake Call settings can extend `users.safetySettings`.

Example:

```json
{
  "safetySettings": {
    "fakeCallContactName": "Amica Friend",
    "fakeCallPhoneNumber": "+94 700 000 000",
    "voiceSosEnabled": true,
    "secretPhraseEnabled": true,
    "fakeCallVolumeShortcutEnabled": true,
    "voiceSosEmergencyMessage": "I need help. This is my live location."
  }
}
```

Future fake call session logs can use a new optional collection named `fake_call_sessions`.

Possible future fields:

- `id`
- `userId`
- `startedAt`
- `endedAt`
- `status`: `incoming | active | ended | sos_triggered`
- `voiceSosTriggered`: boolean
- `sosAlertId`
- `metadata`

For MVP, fake call session logs are not required. The important output is creating an SOS alert with `triggerType` set to `voice`.

### Voice SOS

Voice SOS can extend `sos_alerts.evidence`.

Example:

```json
{
  "evidence": {
    "voicePhraseDetected": true,
    "detectedPhrase": "amica help me",
    "expectedPhrase": "amica help me",
    "voiceConfidenceScore": 0.91,
    "fakeCallActive": true
  }
}
```

### Number Plate OCR

Number Plate OCR can extend both `vehicles` and `sos_alerts.evidence`.

Example:

```json
{
  "evidence": {
    "scannedPlateNumber": "WPCA9876",
    "confidenceScore": 0.87
  }
}
```

### Risk Zone Mapping

Risk zone mapping can later use a new collection named `risk_zones`.

Possible future use:

- Store geographic risk areas.
- Show warnings on the mobile app.
- Help journey safety checks.

Do not implement this collection now.

### Admin Dashboard

An admin dashboard can later use:

- `users.role`
- future analytics collections
- future moderation workflows

Do not implement admin collections now.

### Notifications

Notifications can later use a new collection named `notifications`.

Possible future use:

- Store push notification delivery status.
- Store contact alert history.
- Retry failed messages.

Do not implement this collection now.

### User Submitted Reports

User-submitted reports can later use a new collection named `user_reports`.

Possible future use:

- Report unsafe vehicles.
- Report unsafe locations.
- Support admin moderation.

Do not implement this collection now.

### Audit History

Audit history can later use a new collection named `audit_logs`.

Possible future use:

- Track sensitive backend actions.
- Track SOS alert status changes.
- Support demo explanations and future compliance needs.

Do not implement this collection now.

### App Configuration

App-level configuration can later use a new collection named `app_config`.

Possible future use:

- Feature flags.
- Emergency message templates.
- Supported app versions.

Do not implement this collection now.

## Future Optional Collections

Documented only:

- `risk_zones`
- `user_reports`
- `notifications`
- `audit_logs`
- `app_config`
- `fake_call_sessions`
