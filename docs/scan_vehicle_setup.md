# Scan Vehicle development setup

## Data and identity

The supplied examples normalize to `NC9024`, `CBR6797`, `CBO3286`, `CBR6307`.
Province prefixes are omitted from the canonical modern registration. These
fixtures have fictional passenger ratings and `metadata.demo: true`. They do not
identify a driver or assert that a real vehicle is safe/reported. Original seed
data remains unchanged in `vehicles.json`.

Vehicles add `ratingTotal`, `ratingCount`, `ratingAverage`, and optionally
`unverifiedSafetyCheckCount`. A new review adds its stars to the total and one to
the count. Averages are not rounded in storage. `createdAt`/`updatedAt` are server
timestamps. Existing vehicle records are preserved by the importer.

`journeys.metadata.vehiclePlate` is immutable after creation. Reviews live at
`vehicle_reviews/{journeyId}` with `userId`, `vehiclePlate`, integer `stars` (1-5),
and `createdAt`. The server adds `aggregatedAt`. The owner must have marked the
matching journey safe. Clients cannot update/delete reviews or vehicle totals.
This is MVP anti-duplication, not proof that a physical ride occurred.

`vehicle_safety_events/{journeyId}` contains `userId`, `vehiclePlate`,
`type: unanswered_safety_check`, and `createdAt`. The server adds `aggregatedAt`
and increments a separate unverified counter. Device reports can be inaccurate;
do not use this count as a driver rating or automatically punish a driver.
The app syncs a persisted native escalation when the journey screen is reopened.

## Import sample plates

Use a development account with Firestore write access. Do not email credential
JSON or put it in the repository. From `amica-cloud-backend/functions`:

```powershell
npm install
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT = 'amica-cloud-backend'
node scripts/seed-scan-vehicles.cjs
```

Alternatively set `GOOGLE_APPLICATION_CREDENTIALS` to an existing local development
service-account JSON path. The script only accepts the development project and
creates missing documents. It never replaces an existing vehicle or rating.
The database must be enabled and accessible; billing/permissions errors require
project administrator action. JSON fixtures alone are not a database import.

## Deploy and verify

Merge the feature PR into `dev` after review so the existing development deployment
workflow publishes the rules and both new Firestore triggers. Production is not
deployed by this change. Review writes will fail until the rules are deployed;
averages will not update until `onVehicleReviewCreated` is deployed. Event counts
need `onVehicleSafetyEventCreated`.

Run `npm test` for compilation and rating arithmetic tests. Integration testing:

1. Complete a vehicle journey as user A, submit 4 stars, and verify total +4/count +1.
2. Retry the same review and confirm the aggregate increments once.
3. Verify user B cannot read A's review, submit for A, or modify vehicle aggregates.
4. Verify an active journey, wrong plate, fractional/out-of-range rating are denied.
5. With consenting test contacts, verify SMS at +60 seconds and a primary-contact
   call attempt at +180 seconds after the safety deadline. Answer safe first and
   verify both are cancelled. Test foreground and locked screen separately.

Transactions follow Firebase's [transaction documentation](https://firebase.google.com/docs/firestore/manage-data/transactions).

## First photo of each vehicle

The first time anyone scans a plate that has no photo yet, the app saves the
camera photo so later riders can see what the vehicle looks like on the plate
result screen.

- Only live camera scans are saved (never gallery pictures or typed plates).
- The phone crops the photo to the detected vehicle (the whole photo if no
  vehicle was found), shrinks it to 1024 px on the long side and re-encodes it,
  so no EXIF or GPS data is uploaded. No uploader id is stored anywhere.
- It is uploaded to `vehicle_images/{plate}.jpg`. `storage.rules` let a
  signed-in rider create that object once and never replace or delete it, so
  the first photo wins even if two riders scan a new car at the same time.
- `onVehicleImageUploaded` (Storage trigger) records it on
  `vehicles/{plate}.image` (`path`, `sizeBytes`, `createdAt`). The app skips the
  upload whenever that field is present.
- To remove a bad photo: delete the Storage object and the `image` field in the
  console. The next first scan saves a new one.

Deploy: `firebase deploy --only storage,functions:onVehicleImageUploaded`.

One-time setup (a CI deploy fails with
`Permission 'firebasestorage.defaultBucket.get' denied` until both are done):

1. Create the default bucket: Firebase console → Build → Storage → Get started
   (needs the Blaze plan, which Cloud Functions already require). It should be
   `amica-cloud-backend.firebasestorage.app`.
2. Give the CI service account (the one in `FIREBASE_SERVICE_ACCOUNT_DEV`)
   the **Firebase Storage Admin** role (`roles/firebasestorage.admin`) in
   Google Cloud console → IAM. The Storage trigger also needs Eventarc: the
   first `functions` deploy that includes `onVehicleImageUploaded` grants the
   Cloud Storage service agent `roles/pubsub.publisher`, so either run that
   first deploy from an Owner account or give the CI account
   **Project IAM Admin** for it.
