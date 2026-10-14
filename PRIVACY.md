# Plouto Privacy Architecture

## Claim

Plouto operates **entirely on-device**. There is no server component.

## What the app does

| Concern | Implementation |
|---|---|
| Storage | `expo-sqlite`, database `plouto.db` in app-private sandbox. WAL journal mode, foreign keys enforced. |
| Balances | Stored as decimal **strings** (never binary floats). Arithmetic with `decimal.js` (28-digit precision). |
| Preferences/rates | `app_settings` table + `exchange_rates` with effective dates. |
| Backups | User-initiated JSON export to app document directory; user-initiated JSON import with version validation. Never auto-uploaded. CSV can be derived from the same tables. |
| Reminders | `expo-notifications` scheduled **locally** only. No push service, no remote payload. |
| App lock | `expo-local-authentication` (biometrics/device credential) gates UI. This is an access gate, not encryption. |
| Logging | No `console.log` of balances, calculations, or notes in app code. |
| Network | The app issues **zero** financial network requests. No fetch/XHR to any finance, analytics, or AI endpoint. Currency conversion uses manually entered rates only. |

## What the app does NOT do

No registration, login, cloud sync, bank connections (no Plaid/Yodlee/open banking), third-party financial APIs, analytics/ads/tracking SDKs, AI API calls, or external transmission of financial data. No network needed after installation.

## Framework vs app network access

Building and developing any Expo app may involve network access by *tooling*, which is separate from Plouto's runtime behavior:

- `npx expo start` serves JS locally to your device/emulator.
- EAS Build/Update/Submit contact Expo servers **only if you use them** to build or ship updates.
- The Plouto codebase itself contains no `fetch()` of financial data.

## Device security vs encryption

- **Local storage**: data persists in the app sandbox after restarts, protected by OS-level sandboxing and the device passcode/file-system encryption (iOS Data Protection, Android file-based encryption) when the user enables them.
- **Device security**: OS lock screen, app lock (biometrics) reduce casual access but do not encrypt the SQLite file with an app-managed key.
- **Database encryption**: NOT enabled by default. `expo-sqlite` supports SQLCipher via the `useSQLCipher` config plugin + `PRAGMA key`. Enabling it requires a prebuild build, secure key storage (expo-secure-store), key rotation, and tested migration — deliberately out of scope for v1 claims. **Do not describe Plouto v1 as "encrypted"** beyond what the OS provides.

To enable SQLCipher in a future build: set `useSQLCipher: true` in `app.json` under the `expo-sqlite` plugin, store a random key in SecureStore, run `PRAGMA key = '<key>'` immediately after opening the database, and verify backup/restore across reinstalls.
