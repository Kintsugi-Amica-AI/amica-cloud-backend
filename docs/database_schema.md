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
| `vehicle_reviews` | One private passenger review per completed vehicle journey. |
| `vehicle_safety_events` | One unverified unanswered-check event per vehicle journey. |
| `vehicle_observations` | The vehicle type and colour one user's phone saw on a plate. There is one per user per plate, and no photos are stored. |
| `live_shares` | Server-only. One per shared journey; backs the public watch-live page. |
| `guardian_invites` | Server-only. Single-use codes that link a contact's Amica account. |
| `fcm_tokens` | One per device push token, owned by the signed-in user. |

See [Live journey links and circle push alerts](live_journey_and_circle_push.md)
for how `journeys.liveShare`, `emergency_contacts.guardianUid`,
`sos_alerts.push` and `sos_alerts.guardianResponses` are used.

Vehicle journeys store the confirmed canonical registration in the immutable
`metadata.vehiclePlate` field. Vehicles may now contain `ratingTotal`, `ratingCount`,
`ratingAverage`, and `unverifiedSafetyCheckCount` (default zero). Only server triggers
update these aggregates. See [Scan Vehicle schema and setup](scan_vehicle_setup.md)
for record fields, ownership rules, defaults, examples and demo imports.

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
- `secretPhrases`: optional array of up to ten normalized unique phrases. New
  mobile settings saves this array and mirrors the first entry into `secretPhrase`
  for legacy clients. All entries use the user's configured voice SOS message.
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
  - `fakeCallPhoneNumber`: string
  - `voiceSosEnabled`: boolean
  - `secretPhraseEnabled`: boolean
- `metadata`: map

Recommended default `safetySettings`:

```json
{
  "defaultEmergencyMessage": "I need help. This is my live location.",
  "autoSosDelaySeconds": 30,
  "fakeCallContactName": "Amica Friend",
  "fakeCallPhoneNumber": "+94 700 000 000",
  "voiceSosEnabled": true,
  "secretPhraseEnabled": true
}
```

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
    "defaultEmergencyMessage": "I need help. This is my live location.",
    "autoSosDelaySeconds": 30,
    "fakeCallContactName": "Amica Friend",
    "fakeCallPhoneNumber": "+94 700 000 000",
    "voiceSosEnabled": true,
    "secretPhraseEnabled": true
  },
  "metadata": {},
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Future extension notes:

- Fake Call settings can be added under `safetySettings`.
- `secretPhrase` is used for Stealth Voice SOS in the MVP.
- `fakeCallContactName` and `fakeCallPhoneNumber` are used by the simulated fake call UI.
- In production, sensitive safety settings and phrase fields should be protected carefully.
- For MVP demo testing, keep the secret phrase simple and user-editable.
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
- `currentLocation`: map
  - `latitude`: number
  - `longitude`: number
  - `address`: string
  - `updatedAt`: timestamp
- `destination`: map
  - `latitude`: number
  - `longitude`: number
  - `address`: string
  - `name`: string
- `estimatedDurationMinutes`: number
- `estimatedEndTime`: timestamp
- `actualEndTime`: timestamp
- `safetyCheck`: map
  - `required`: boolean
  - `responseDeadlineSeconds`: number
  - `respondedAt`: timestamp
- `stopAlert`: map
  - `enabled`: boolean
  - `alertDistanceMeters`: number
  - `alertedAt`: timestamp
- `metadata`: map
- `schemaVersion`: number

Recommended default values:

- `journeyType`: `walk`
- `status`: `active`
- `safetyCheck.required`: `true`
- `safetyCheck.responseDeadlineSeconds`: `30`
- `stopAlert`: `{}` (absent on ordinary timer journeys)
- `metadata`: `{}`
- `schemaVersion`: `1`

### Smart Stop Alert rides

Smart Stop Alert is implemented on this collection, using `destination` and `journeyType` as planned. A bus ride that watches the distance to a drop-off is an ordinary `journeys` document with:

- `journeyType`: `bus`
- `destination`: the drop-off point, with `latitude` and `longitude` set
- `stopAlert.enabled`: `true`
- `stopAlert.alertDistanceMeters`: how close to the drop-off the alarm sounds, `2000` by default
- `stopAlert.alertedAt`: `null` until the alarm sounds, then a timestamp
- `safetyCheck.required`: `false`, because this ride has no timer deadline to answer for
- `estimatedDurationMinutes`: `0`, since the rider cannot predict a bus journey's length

The mobile app tells the two kinds of journey apart by `stopAlert.enabled`, so the Smart Journey Timer and the Bus Stop Alert never pick up each other's documents. A document without a `stopAlert` map is an ordinary timer journey, which keeps every existing journey valid.

Example:

```json
{
  "id": "journey-2",
  "userId": "sample-user-1",
  "journeyType": "bus",
  "status": "active",
  "destination": {
    "latitude": 6.9036,
    "longitude": 79.9547,
    "address": "Malabe",
    "name": "Malabe"
  },
  "estimatedDurationMinutes": 0,
  "safetyCheck": {
    "required": false,
    "responseDeadlineSeconds": 30,
    "respondedAt": null
  },
  "stopAlert": {
    "enabled": true,
    "alertDistanceMeters": 2000,
    "alertedAt": null
  },
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "2026-01-01T18:00:00.000Z",
  "updatedAt": "2026-01-01T18:00:00.000Z"
}
```

Example:

```json
{
  "id": "journey-1",
  "userId": "sample-user-1",
  "journeyType": "walk",
  "status": "active",
  "startLocation": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo"
  },
  "currentLocation": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo",
    "updatedAt": "server timestamp"
  },
  "destination": {
    "latitude": 6.9036,
    "longitude": 79.9547,
    "address": "Malabe",
    "name": "Campus"
  },
  "estimatedDurationMinutes": 30,
  "estimatedEndTime": "2026-01-01T18:30:00.000Z",
  "safetyCheck": {
    "required": true,
    "responseDeadlineSeconds": 30,
    "respondedAt": null
  },
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "2026-01-01T18:00:00.000Z",
  "updatedAt": "2026-01-01T18:00:00.000Z"
}
```

Future extension notes:

- Live tracking can later store location history in a separate subcollection.
- Route drawing can later be added using Google Directions API.
- Risk zones can later be calculated from anonymized SOS locations.
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
  - `detectedPhrase`: string
  - `expectedPhrase`: string
  - `voiceConfidenceScore`: number
  - `fakeCallActive`: boolean
  - `scannedPlateNumber`: string
  - `confidenceScore`: number
  - `audioClip`: map, server-written by `onSosAudioUploaded` (clients cannot
    write `evidence` after creating the alert)
    - `path`: string, `sos_audio/{uid}/{alertId}.m4a` in Cloud Storage
    - `contentType`: string, `audio/mp4` (AAC)
    - `sizeBytes`: number
    - `durationSeconds`: number or null (about 30)
    - `recordedAt`: ISO string or null, when recording started on the phone
    - `triggerType`: string or null, `manual` or `voice`
    - `uploadedAt`: server timestamp
- `metadata`: map
- `schemaVersion`: number

Recommended default values:

- `triggerType`: `manual`
- `status`: `active`
- `message`: `"I need help. This is my live location."`
- `notifiedContacts`: `[]`
- `evidence`: `{}`
- `metadata`: `{}`
- `schemaVersion`: `1`

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
  "message": "I need help. This is my live location.",
  "notifiedContacts": [],
  "evidence": {},
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "2026-01-01T18:10:00.000Z",
  "updatedAt": "2026-01-01T18:10:00.000Z"
}
```

Voice SOS example:

```json
{
  "id": "sos_001",
  "userId": "firebase_user_uid",
  "triggerType": "voice",
  "status": "active",
  "location": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": ""
  },
  "message": "I need help. This is my live location.",
  "notifiedContacts": [],
  "evidence": {
    "voicePhraseDetected": true,
    "detectedPhrase": "amica help me",
    "expectedPhrase": "amica help me",
    "voiceConfidenceScore": 0.85,
    "fakeCallActive": true
  },
  "metadata": {},
  "schemaVersion": 1,
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
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
- `observedProfile` (map, written only by `onVehicleObservationCreated`): what Amica scans usually see on this plate.
  - `observationCount`: number of observations folded in
  - `typeCounts` / `colourCounts`: maps of word → count, e.g. `{ "car": 6, "van": 1 }`
  - `usualType` / `usualColour`: the usual value, or `null`. A value only counts as usual when at least 3 scans agree and those scans make up at least 60% of the scans that reported it. This means one odd scan never changes a plate's profile.
  - `typeAgreement` / `colourAgreement`: how many scans agree with the usual value
  - `updatedAt`: timestamp

## vehicle_observations

The Scan before you ride vehicle check reads type and colour on the phone. It saves only those words, never the photo. The document id is `{plate}_{uid}`, so each user counts once per plate. Clients can create an observation but can't change or delete it. The `onVehicleObservationCreated` trigger adds each observation to `vehicles/{plate}.observedProfile` and stamps `aggregatedAt`, so a retried event isn't counted twice.

| Field | Type | Notes |
|---|---|---|
| `userId` | string | Must be the signed-in user |
| `vehiclePlate` | string | Canonical letter-series plate, `^[A-Z]{2,3}[0-9]{4}$` |
| `vehicleType` | string, optional | `car`, `van`, `bus`, `lorry`, `motorbike`, `three_wheeler` |
| `colour` | string, optional | `white`, `silver`, `grey`, `black`, `red`, `maroon`, `orange`, `yellow`, `green`, `blue`, `brown` |
| `createdAt` | timestamp | Server time |
| `aggregatedAt` | timestamp | Set by the trigger |

At least one of `vehicleType` or `colour` must be present.

## live_shares

Server-only (clients have no access). Document ID is the share token.

- `token`, `userId`, `journeyId`: string
- `ownerName`: her first name only
- `status`: `active | sos | ended`
- `journeyType`, `destinationName`: string
- `destination`, `location`: `{ latitude, longitude, updatedAt }` or null
- `estimatedEndTime`, `endedAt`, `expiresAt`, `createdAt`, `updatedAt`: ISO strings
- `endReason`: journey status that ended it (`safe`, `cancelled`, …) or null
- `routePolyline`: Google encoded polyline or null

Related fields written only by the backend:

- `journeys.liveShare`: `{ token, url, createdAt, pushedAt? }`
- `emergency_contacts.guardianUid`, `guardianName`, `guardianLinkedAt`
- `sos_alerts.push`: `{ sentAt, reachedContactIds[] }`
- `sos_alerts.guardianResponses.{uid}`: `{ contactId, name, response, at }`,
  where `response` is `calling | alerted_others`

## guardian_invites

Server-only. Document ID is the 6-character code.

- `code`, `userId` (who invited), `contactId`, `contactName`, `ownerName`
- `createdAt`, `expiresAt` (7 days), `usedAt`, `usedBy`

## fcm_tokens

Document ID is the FCM registration token.

- `userId`: owner uid (rules: must be the signed-in user)
- `platform`: `android | iOS | …`
- `updatedAt`: server timestamp

## Schema Change Notes

- Add new optional fields instead of renaming required fields.
- Keep old fields readable until all clients are migrated.
- Increase `schemaVersion` only when a meaningful document shape change happens.
- Mobile and backend code should use default values when optional fields are missing.
- Future collections should get explicit Firestore rules before being used by the app.
