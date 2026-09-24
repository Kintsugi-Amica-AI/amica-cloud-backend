# Website contact form (Firebase)

Messages sent from the contact form on the Amica website are received by Firebase and emailed to
the team inbox **teamkintsugi2026@gmail.com**.

```
Website form ──POST──▶ submitContactMessage (HTTPS function)
                           │  validates, rate-limits, honeypot check
                           ▼
                 Firestore: contact_messages/{id}   ◀── every message is kept here
                           │  (document created)
                           ▼
                 onContactMessageCreated (trigger) ──Gmail SMTP──▶ teamkintsugi2026@gmail.com
                           │
                           └─ writes delivery.state = "sent" | "error" back to the document
```

Because the message is saved **before** the email is sent, nothing is lost if Gmail is down or the
password is wrong — the message stays in Firestore with `delivery.state: "error"` and the reason.

## Files

| File | Purpose |
|---|---|
| `functions/src/http/submitContactMessage.ts` | HTTPS endpoint the website posts to |
| `functions/src/triggers/onContactMessageCreated.ts` | Sends the notification email |
| `functions/src/services/contactMessageService.ts` | Validation, rate limit, email template (unit tested) |
| `functions/src/tests/contactMessageService.test.ts` | Tests (`npm test`) |

Collections (server-only — clients cannot read or write them, see `firestore.rules`):

- `contact_messages` — `name, email, topic, subject, message, page, origin, status, delivery{state, attempts, sentAt|error}, createdAt`
- `contact_rate_limits` — one doc per hashed sender IP (max 5 messages per hour). Raw IPs are never stored.

## One-time setup

### 1. Create a Gmail App Password for teamkintsugi2026@gmail.com

Gmail only lets apps send mail with an *App Password* (your normal password will not work).

1. Sign in to teamkintsugi2026@gmail.com → **Google Account → Security**.
2. Turn on **2-Step Verification** (required for App Passwords).
3. Open **App passwords** (search "App passwords" in the account settings), create one called
   `Amica website`, and copy the 16-character password.

### 2. Store it as a Firebase secret

```bash
cd amica-cloud-backend
firebase use amica-cloud-backend
firebase functions:secrets:set CONTACT_SMTP_PASSWORD
# paste the 16-character App Password when asked
```

Never put this password in code, `.env` files or commits.

### 3. Install and deploy

```bash
cd functions
npm install            # adds nodemailer
npm test               # includes contactMessageService tests
cd ..
firebase deploy --only functions:submitContactMessage,functions:onContactMessageCreated,firestore:rules
```

`CONTACT_SMTP_USER` and `CONTACT_INBOX` both default to `teamkintsugi2026@gmail.com`. If the CLI asks
for them, press Enter to accept the default. To notify several people, put
`CONTACT_INBOX=a@x.com,b@y.com` in `functions/.env.amica-cloud-backend` (already git-ignored) and redeploy.

> Cloud Functions and outbound email need the **Blaze (pay-as-you-go)** plan. A contact form uses a
> tiny fraction of the free monthly allowance, but a billing account must be attached.

### 4. Point the website at the function

`amica-website/js/main.js` already posts to:

```
https://us-central1-amica-cloud-backend.cloudfunctions.net/submitContactMessage
```

## Allowed websites (CORS)

The endpoint only accepts browser requests from the origins in `CONTACT_ALLOWED_ORIGINS`
(`contactMessageService.ts`): `localhost` / `127.0.0.1` on any port, `amica-cloud-backend.web.app`,
`amica-cloud-backend.firebaseapp.com` and Hosting preview channels. **When the website gets its own
domain, add it to that list and redeploy.**

## Reading messages

- **Email:** every message arrives in teamkintsugi2026@gmail.com. Press **Reply** — it goes straight
  to the visitor (the email's Reply-To is their address).
- **Firebase console → Firestore → `contact_messages`:** the full history. Filter by
  `delivery.state == "error"` to find any message whose email failed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Website says "couldn't send" and the browser console shows a CORS error | The page's origin isn't in `CONTACT_ALLOWED_ORIGINS`. |
| Message is in Firestore with `delivery.state: "error"`, `Invalid login` | Wrong / missing App Password. Re-run step 2 and redeploy `onContactMessageCreated`. |
| No document in `contact_messages` | Check `firebase functions:log --only submitContactMessage`. |
| Email lands in Spam | Mark it "Not spam" once; Gmail learns quickly since it is sent from the same account. |
