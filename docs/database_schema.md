# Database Schema

Amica uses a flexible Firestore schema for the MVP. The current backend focuses on the collections needed for authentication, emergency contacts, journeys, SOS alerts, and vehicle status checks.

The schema is designed so future safety features can be added without breaking the mobile app. Major documents should include:

- `schemaVersion` for future migrations.
- `createdAt` and `updatedAt` timestamps.
- `metadata` maps for optional future data.
- Required fields for MVP behavior.
- Optional fields that mobile/backend code can safely ignore if missing.

## Collection Overview

| Collection | Purpose |
| --- | --- |
| `users` | Stores authenticated user profile and safety preferences. |
| `emergency_contacts` | Stores trusted contacts owned by a user. |
| `journeys` | Stores Smart Journey Timer sessions. |
| `sos_alerts` | Stores SOS alerts triggered by manual, timer, voice, or future features. |
| `vehicles` | Stores sample vehicle safety records for Scan Before You Ride. |

## users

Stores profile data for authenticated users.

Required fields:

- `uid`: string
- `name`: string
- `email`: string
- `phone`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp

Optional and extendable fields:

- `secretPhrase`: string
- `role`: `user | admin | tester`
- `status`: `active | disabled`
- `schemaVersion`: number
- `preferences`: map
  - `language`: string
  - `notificationsEnabled`: boolean
  - `locationSharingEnabled`: boolean
- `safetySettings`: map
  - `defaultEmergencyMessage`: string
  - `autoSosDelaySeconds`: number
  - `fakeCallContactName`: string
- `metadata`: map

Example:

```json
{
  "uid": "sample-user-1",
  "name": "Sample User",
  "email": "sample@example.com",
  "phone": "+94770000000",
  "secretPhrase": "send help",
  "role": "user",
  "status": "active",
  "schemaVersion": 1,
  "preferences": {
    "language": "en",
    "notificationsEnabled": true,
    "locationSharingEnabled": true
  },
  "safetySettings": {
    "defaultEmergencyMessage": "I need help. Please check my location.",
    "autoSosDelaySeconds": 60,
    "fakeCallContactName": "Amica Safety"
  },
  "metadata": {},
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Future extension notes:

- Fake Call settings can be added under `safetySettings`.
- Admin dashboard permissions can use `role`.
- Per-user app settings can be added under `preferences`.

## emergency_contacts

Stores trusted contacts for a user.

Required fields:

- `id`: string
- `userId`: string
- `name`: string
- `phone`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp

Optional and extendable fields:

- `relationship`: string
- `priority`: number
- `isActive`: boolean
- `notificationMethods`: array
- `metadata`: map
- `schemaVersion`: number

Recommended default values:

- `relationship`: `""`
- `priority`: `1`
- `isActive`: `true`
- `notificationMethods`: `["sms"]`
- `metadata`: `{}`
- `schemaVersion`: `1`

Example:

```json
{
  "id": "contact_001",
  "userId": "firebase_user_uid",
  "name": "Mother",
  "phone": "+94771234567",
  "relationship": "Mother",
  "priority": 1,
  "isActive": true,
  "notificationMethods": ["sms"],
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

Future extension notes:

- SOS alerts will later read active emergency contacts for the signed-in user.
- Higher priority contacts should be notified first in future notification flows.
- `notificationMethods` can later support `sms`, `call`, `email`, and `push`.
- Contact verification status can be stored in `metadata` later.
- `metadata` is reserved for future feature expansion without changing the MVP fields.

## journeys

Stores Smart Journey Timer sessions.

Required fields:

- `id`: string
- `userId`: string
- `journeyType`: `walk | taxi | bus | train | other`
- `status`: `active | safe | sos | cancelled | expired`
- `createdAt`: timestamp
- `updatedAt`: timestamp

Optional and extendable fields:

- `startLocation`: map
  - `latitude`: number
  - `longitude`: number
  - `address`: string
- `destination`: map
  - `latitude`: number
  - `longitude`: number
  - `address`: string
  - `name`: string
- `estimatedEndTime`: timestamp
- `actualEndTime`: timestamp
- `safetyCheck`: map
  - `required`: boolean
  - `responseDeadlineSeconds`: number
  - `respondedAt`: timestamp
- `metadata`: map
- `schemaVersion`: number

Example:

```json
{
  "id": "journey-1",
  "userId": "sample-user-1",
  "journeyType": "taxi",
  "status": "active",
  "startLocation": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo"
  },
  "destination": {
    "latitude": 6.9036,
    "longitude": 79.9547,
    "address": "Malabe",
    "name": "Campus"
  },
  "estimatedEndTime": "2026-01-01T18:30:00.000Z",
  "safetyCheck": {
    "required": true,
    "responseDeadlineSeconds": 60,
    "respondedAt": null
  },
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "2026-01-01T18:00:00.000Z",
  "updatedAt": "2026-01-01T18:00:00.000Z"
}
```

Future extension notes:

- Smart Stop Alert can extend journeys using `journeyType` and `destination`.
- Route sharing, delay reasons, and transport details can be added under `metadata`.

## sos_alerts

Stores SOS alerts created by manual, timer, voice, plate scan, or future triggers.

Required fields:

- `id`: string
- `userId`: string
- `triggerType`: `timer | voice | manual | plate_scan | unknown`
- `status`: `active | sent | resolved | cancelled`
- `createdAt`: timestamp
- `updatedAt`: timestamp

Optional and extendable fields:

- `journeyId`: string
- `location`: map
  - `latitude`: number
  - `longitude`: number
  - `address`: string
- `message`: string
- `notifiedContacts`: array
- `evidence`: map
  - `voicePhraseDetected`: boolean
  - `scannedPlateNumber`: string
  - `confidenceScore`: number
- `metadata`: map
- `schemaVersion`: number

Example:

```json
{
  "id": "sos-1",
  "userId": "sample-user-1",
  "journeyId": "journey-1",
  "triggerType": "manual",
  "status": "active",
  "location": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo"
  },
  "message": "I need help. Please check my location.",
  "notifiedContacts": [],
  "evidence": {
    "voicePhraseDetected": false,
    "scannedPlateNumber": "",
    "confidenceScore": 0
  },
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "2026-01-01T18:10:00.000Z",
  "updatedAt": "2026-01-01T18:10:00.000Z"
}
```

Future extension notes:

- Voice SOS can add phrase detection data under `evidence`.
- Number Plate OCR can add scanned plate evidence.
- Notification delivery results can later be stored in `notifiedContacts` or a separate `notifications` collection.

## vehicles

Stores sample vehicle status records for OCR demo checks.

Required fields:

- `plateNumber`: string
- `normalizedPlateNumber`: string
- `status`: `safe | reported | unknown`
- `reportsCount`: number
- `createdAt`: timestamp
- `updatedAt`: timestamp

Optional and extendable fields:

- `riskLevel`: `low | medium | high | unknown`
- `notes`: string
- `lastCheckedAt`: timestamp
- `metadata`: map
- `schemaVersion`: number

Example:

```json
{
  "plateNumber": "WP CA 9876",
  "normalizedPlateNumber": "WPCA9876",
  "status": "reported",
  "reportsCount": 3,
  "riskLevel": "high",
  "notes": "Sample reported vehicle for demo testing only.",
  "lastCheckedAt": "2026-01-01T12:00:00.000Z",
  "metadata": {
    "source": "seed-data",
    "demoOnly": true
  },
  "schemaVersion": 1,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Future extension notes:

- OCR confidence and check history can be added later.
- Verified reports should eventually come from trusted backend/admin processes.

## Schema Change Notes

- Add new optional fields instead of renaming required fields.
- Keep old fields readable until all clients are migrated.
- Increase `schemaVersion` only when a meaningful document shape change happens.
- Mobile and backend code should use default values when optional fields are missing.
- Future collections should get explicit Firestore rules before being used by the app.
