# Security Rules Notes

- Users should only read and write their own profile, contacts, journeys, and alert records.
- SOS alert updates should be tightly controlled because alerts are audit records.
- Vehicle records are read-only for authenticated users and should be managed by trusted backend processes.
- Rules in this scaffold are conservative placeholders and should be tested with Firebase Emulator Suite before production use.
- The `journeys` collection now holds two kinds of document: Smart Journey Timer sessions, and Smart Stop Alert bus rides carrying a `stopAlert` map. Both are owned by one user, so the existing owner-scoped rules already cover them and no rule change was needed. Anything that later restricts which journey fields a client may write must account for both shapes, or it will silently break one of the two features.
- `getRouteDistance` is a callable function and rejects unauthenticated callers. It takes only coordinates and returns only a distance, so it cannot be used to read another user's data, but it does spend Directions API quota. Consider rate limiting it before production.
