# Amica Cloud Backend

Firebase backend scaffolding for Amica safety workflows.

Amica is a women's safety and security MVP. The backend supports the mobile app features needed for the university prototype:

- Firebase Authentication user profile storage
- Emergency contacts
- Smart Journey Timer data
- SOS alert records
- Sample vehicle status data for Scan Before You Ride
- Firebase Cloud Functions placeholders for future backend logic

No Firebase credentials, service account keys, API keys, private keys, or `.env` files should be committed to this repository.

## Firestore Collections

The MVP focuses on these collections:

- `users`
- `emergency_contacts`
- `journeys`
- `sos_alerts`
- `vehicles`

The database schema is documented in [docs/database_schema.md](docs/database_schema.md).

## Flexible Schema Design

The schema is designed to support future Amica features without breaking the MVP. Major documents include:

- `schemaVersion`
- `createdAt`
- `updatedAt`
- optional `metadata` maps
- optional nested maps such as `preferences`, `safetySettings`, `evidence`, and `safetyCheck`

Future schema ideas are documented in [docs/schema_evolution.md](docs/schema_evolution.md). Future collections such as `risk_zones`, `notifications`, `user_reports`, `audit_logs`, and `app_config` are documented only and are not implemented yet.

## Firebase Security Rules

Firestore rules are kept simple for the MVP:

- Authenticated users can read/write only their own profile.
- Authenticated users can read/write their own emergency contacts.
- Authenticated users can read/write their own journeys.
- Authenticated users can create and read their own SOS alerts.
- Authenticated users can read vehicle status data.
- Public users cannot read private user data.
- Clients cannot write vehicle records.
- Everything else is denied by default.

## Emergency Contacts

The `emergency_contacts` collection stores trusted contacts for each signed-in user. SOS alerts will later read the user's active contacts and notify higher priority contacts first.

Each contact document is owned by `userId`. Firestore rules allow users to create, read, update, and delete only documents where `userId` matches their Firebase Auth UID. The mobile app should query contacts with:

```text
emergency_contacts where userId == currentUser.uid
```

Do not store real private contact data in seed files, screenshots, commits, or logs. No Firebase secrets, service account JSON files, API tokens, or `.env` files should be committed.

## Location, Journey and SOS Backend

The `journeys` collection stores Smart Journey Timer sessions for signed-in users. MVP journey documents can include `startLocation`, `currentLocation`, `destination`, `estimatedDurationMinutes`, `estimatedEndTime`, and `safetyCheck`.

The `sos_alerts` collection stores manual, timer, voice, and future SOS triggers. MVP SOS documents can include the user's current location so the mobile app can display and later share live-location alerts.

Location maps use this simple shape:

```json
{
  "latitude": 6.9271,
  "longitude": 79.8612,
  "address": "Colombo"
}
```

All journey and SOS documents are owned by `userId`. Firestore rules allow authenticated users to create, read, and update only their own journey data. Users can create and read their own SOS alerts, and can update SOS status fields for MVP testing.

The mobile app saves current location into:

- `journeys.startLocation`
- `journeys.currentLocation`
- `sos_alerts.location`

Live tracking history is planned later and should use a separate subcollection or collection. Route drawing, Google Directions API usage, background location tracking, and real notification dispatch are not implemented in this MVP foundation.

Do not commit Google Maps API keys, Firebase service account files, private keys, access tokens, `.env` files, or real user location exports.

## Fake Call and Voice SOS Backend

Fake Call is simulated inside the mobile app for the MVP. The backend foundation supports it through user safety settings and SOS alert evidence.

- The user's MVP `secretPhrase` can be stored on the `users` profile document.
- Fake call display settings can be stored in `users.safetySettings`, including `fakeCallContactName`, `fakeCallPhoneNumber`, `voiceSosEnabled`, `secretPhraseEnabled`, `fakeCallVolumeShortcutEnabled`, and `voiceSosEmergencyMessage`.
- Voice SOS creates a document in `sos_alerts` with `triggerType` set to `voice`.
- Voice SOS evidence is stored in `sos_alerts.evidence`, including detected phrase, expected phrase, confidence score, and whether the fake call screen was active.
- Fake call session logs are not required for the MVP. A future `fake_call_sessions` collection is documented in `docs/schema_evolution.md`.
- No real SMS, phone call, or emergency authority notification is implemented in this backend placeholder.

Do not commit secret phrases from real users, API keys, Firebase service account files, private keys, access tokens, or `.env` files.

## Mobile App Connection

The `amica-mobile-app` repo should connect to the Firebase development project using safe FlutterFire configuration. Mobile signup creates Firebase Auth users and writes profile documents to the `users` collection.

Do not commit real Firebase configuration secrets or service account JSON files into mobile or backend repositories.

## Deployment Strategy

- `dev` branch is used for development integration.
- Backend `dev` branch deploys to Firebase development project only.
- `main` branch is reserved for final demo/production-ready code.
- Production deployment is not automatic yet.
- Mobile app produces APK artifacts through GitHub Actions.
- AI repo produces test/artifact outputs only.

The GitHub Actions dev deployment requires these repository settings:

- Secret: `FIREBASE_SERVICE_ACCOUNT_DEV`
- Variable: `FIREBASE_PROJECT_ID_DEV`

## Local Development

Install and test Cloud Functions:

```bash
cd functions
npm install
npm test --if-present
```

Validate seed data:

```bash
python -m json.tool seed-data/vehicles.json
```

Confirm Firebase config files exist:

```bash
test -f firestore.rules
test -f firestore.indexes.json
test -f firebase.json
```

On Windows PowerShell:

```powershell
Test-Path firestore.rules
Test-Path firestore.indexes.json
Test-Path firebase.json
```

## Important Secret Rules

Never commit:

- Firebase service account JSON files
- Firebase private keys
- API keys
- access tokens
- `.env` files
- real user data
- production database exports

If a secret is accidentally committed, tell the team immediately and rotate the secret in Firebase/GitHub.
