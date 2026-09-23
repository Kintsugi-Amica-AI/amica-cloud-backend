# Live journey links and circle push alerts

Two features that make an alert more useful to the people who receive it:

1. **Watch my journey live.** A journey can have a private web link. Anyone
   who opens it sees a map with her position, updating every few seconds,
   until she arrives. No app or sign-in needed, so it works from an SMS.
2. **Push alerts for contacts who have Amica.** SMS still goes to everyone.
   Contacts who also use Amica and have linked their account get a push as
   well, which is faster and free. They can reply to an SOS with one tap
   ("Calling now" / "I've alerted others") and she sees the reply on her
   SOS screen.

## How the live link works

```
app ── startJourneyShare(journeyId, notifyCircle) ──▶ creates live_shares/{token}
app ── writes journeys/{id}.currentLocation every ≥10 s ─┐
                                                          ▼
                              onJourneyUpdated mirrors it to live_shares/{token}
contact's browser ── GET /j/{token} (Hosting, live.html)
                  ── polls GET /api/live?token=… (liveJourney function) every 6 s
```

- The token is 128 random bits and is the whole secret. `live_shares` and the
  journey itself are never readable from a client; the page gets a trimmed
  view (first name, destination, position, deadline, status) from
  `liveJourney`.
- When the journey ends the page says so ("arrived safely") and stops
  showing her position. Links stop working 12 hours after the journey's
  deadline.
- An SOS during a shared journey turns the page red with a "call 119" button
  and keeps it live.
- If her phone stops sending (no signal, app killed) the page says "no update
  for N min" instead of pretending the last position is current.
- `journeys.liveShare` (`token`, `url`, `createdAt`, `pushedAt`) is written
  only by the backend. Firestore rules reject client changes to it, and the
  mirror trigger only writes to a share whose `journeyId` and `userId` match,
  so a copied token cannot overwrite someone else's page.

The app writes location through a location foreground service on Android
(a "Sharing your live location" notification), so updates continue with
Amica in the background or the screen off. If Android kills Amica completely,
updates stop and the page shows the last update time.

## How contacts are linked for push

Contacts are matched to Amica accounts by an invite code, not by phone
number. Profile phone numbers are not verified yet, so matching by number
would let anyone who typed her mother's number receive her alerts.

1. On the Circle screen she taps "Connect in Amica for instant alerts" on a
   contact. `createGuardianInvite` returns a 6-character code (no 0/O/1/I/L)
   valid for 7 days, and her phone texts it to the contact's number.
2. The contact opens You → "Get alerts for someone" and enters the code.
   `acceptGuardianInvite` checks it (single use, not expired, not her own)
   and sets `emergency_contacts/{id}.guardianUid` in a transaction. Only the
   server can set this field.
3. She gets a "{name} is connected in Amica" push.

Either side can unlink (`unlinkGuardian`). Changing a contact's phone number
in the app also drops the link, because the code proved the old number.

## What gets pushed

| Event | To | Push type |
| --- | --- | --- |
| SOS created (`onSosAlertCreated`) | linked guardians | `sos`, with location, maps link and live link if on a shared journey |
| Journey shared with "notify circle" | linked guardians | `journey_started` with the live link |
| Shared journey marked safe | linked guardians | `journey_arrived` |
| Guardian taps a reply (`respondToAlert`) | her | `guardian_response` |
| Contact enters the code | her | `guardian_linked` |

All pushes are data-only, high priority. The app draws the notification
itself (in a background isolate when closed) so it can show it in the user's
language and add the reply buttons. Dead tokens are deleted when FCM reports
them. When the circle is told about a new live link, contacts reached by push
are skipped for the SMS, so nobody pays for a text they already got.

## Deploying

```
cd amica-cloud-backend
npm --prefix functions install
firebase deploy --only functions,firestore:rules,hosting
```

- The link base URL defaults to `https://<project-id>.web.app`. To use a
  custom domain, set `LIVE_SHARE_BASE_URL` in `functions/.env`
  (for example `LIVE_SHARE_BASE_URL=https://live.amica.lk`).
- Push needs the **Firebase Cloud Messaging API (V1)** enabled on the Google
  Cloud project (it is on by default for new Firebase projects).
- The live page uses OpenStreetMap tiles through Leaflet, so it needs no
  Maps API key. OpenStreetMap refuses tile requests that carry no `Referer`,
  so the page (and `firebase.json`) use
  `Referrer-Policy: strict-origin-when-cross-origin`: other sites only ever
  see the site origin, never the `/j/{token}` path.
- The dev deploy workflow deploys Hosting as well. Without it `/j/{token}`
  links have no page behind them ("Site Not Found").

## Tests

- `npm --prefix functions test` runs unit tests for tokens, expiry, the
  public view, invite codes and push payloads.
- `firebase emulators:exec --only firestore "npm --prefix functions run test:rules:live"`
  checks the new Firestore rules.
