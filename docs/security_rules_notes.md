# Security Rules Notes

- Users should only read and write their own profile, contacts, journeys, and alert records.
- SOS alert updates should be tightly controlled because alerts are audit records.
- Vehicle records are read-only for authenticated users and should be managed by trusted backend processes.
- Rules in this scaffold are conservative placeholders and should be tested with Firebase Emulator Suite before production use.
