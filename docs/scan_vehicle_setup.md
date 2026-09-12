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
