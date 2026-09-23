# Firebase Setup

1. Create a Firebase project for each environment.
2. Enable Authentication providers required by the mobile app.
3. Enable Cloud Firestore.
4. Deploy rules and indexes from this repository.
5. Deploy Cloud Functions from the `functions/` directory.
6. Deploy Hosting (the watch-live page in `hosting/`):
   `firebase deploy --only hosting`. See
   [live_journey_and_circle_push.md](live_journey_and_circle_push.md).

Do not commit service account files, `.firebaserc`, generated app config files, or production environment values.

## Optional: road distance for the Smart Stop Alert

The `getRouteDistance` callable function backs the mobile Bus Stop Alert. It reports how far the road runs between the rider and their drop-off, so the alarm can mean "2 km of bus travel left" rather than 2 km in a straight line.

It is optional. With no key configured the function returns `{ "available": false }`, and the app falls back to straight-line distance, which sounds the alarm slightly early rather than late.

To enable it:

1. Enable the **Directions API** on the Google Cloud project and create an API key for it.
2. Set the key as a function secret or environment variable named `GOOGLE_DIRECTIONS_API_KEY`, for example:

   ```
   firebase functions:secrets:set GOOGLE_DIRECTIONS_API_KEY
   ```

3. Redeploy the functions.

The key belongs here rather than in the mobile app. A Directions API key is a web-service key and cannot be restricted to an Android app signature, so shipping one inside the APK would expose a billable key to anyone who unpacked it. Restrict the key to the Directions API, and never commit it.

Note that the alarm itself never calls this function. The route is resolved once, before the ride starts, and the device applies the result offline for the rest of the journey, so a bus passing through a tunnel or a dead zone does not stop the alarm from sounding.
