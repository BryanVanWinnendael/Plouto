# Plouto — Your money. Your progress. Your privacy.

A private, local-only mobile wealth tracker built with Expo + React Native + TypeScript.

## Features

- **Accounts**: checking, savings, cash, investments, crypto, real estate, credit cards, loans, mortgages + custom. Create, edit, archive, restore, reorder (by name/order), delete with history protection.
- **Flexible snapshots**: record any accounts at any time. Observation timestamp + entry timestamp preserved. Atomic SQLite transactions. Duplicate-time detection. Edit, duplicate, delete.
- **Overview**: net worth / assets / liabilities / banking / investments / liquid with as-of dates, coverage warnings, interactive line chart (1M–All, recorded-only or labeled step mode), latest-known-position (mixed dates labeled), recent activity, stale-balance callouts.
- **History**: recorded-only series, highest/lowest recorded, filter by category, select-two-to-compare.
- **Compare**: A vs B totals, absolute + % change, per-account rows, only-in-A/B lists, common-coverage mode (like-for-like), sort by increase/decrease/name. Never zero-fills missing. Never labeled as returns.
- **History**: recorded-only net worth chart with highest/lowest, allocation donut by category/account/class/liquidity, yearly breakdowns, snapshot list with two-way compare.
- **Multi-currency**: per-account currency, reporting currency, manual effective-dated rates, original+rate+converted shown, incomplete totals when rate missing.
- **Settings**: currency, theme (light/dark/system), manual FX rates, app lock flag, JSON backup export/import with validation, CSV-ready data model, wipe-all, privacy explainer.
- **Onboarding**: currency + theme + first steps, optional clearly-labeled demo data.

## Privacy architecture (local-only)

See [PRIVACY.md](./PRIVACY.md). Summary:

- No backend, no accounts, no login, no sync, no bank APIs, no analytics/tracking/ads SDKs, no AI calls, no network dependency for normal use.
- All data in app-private SQLite (`plouto.db`, WAL mode, foreign keys on) via `expo-sqlite`. Balances stored as decimal strings; math via `decimal.js`.
- No `console.log` of financial values in production paths. Exported JSON backups contain sensitive data — user warned, never auto-uploaded.
- Framework-level network access (Expo dev server, EAS builds/updates if you enable them) is separate from app behavior; the app itself makes zero financial network calls.
- Local storage ≠ encryption. Device OS sandbox + passcode protect at rest. Optional SQLCipher path documented in PRIVACY.md but not claimed by default.

## Run

```bash
npm install
npx expo start
# then: a (Android emulator) / i (iOS simulator, macOS) / scan QR with Expo Go (limited: expo-sqlite works in Go)
```

For native features (notifications, local-auth, document picker), prefer a development build:

```bash
npx expo run:android
npx expo run:ios
```

Production builds via EAS:

```bash
npx eas-cli@latest build --platform android
npx eas-cli@latest build --platform ios
```

## Tests & typecheck

```bash
npm test        # jest: money precision, sign conventions, snapshots, compare, LKP, yearly, FX
npm run typecheck  # tsc --noEmit
```

## Project layout

```
src/app/            Expo Router screens (native tabs: overview/history/accounts/settings)
src/components/     UI primitives + SVG charts (LineChart/DonutChart/BarChart)
src/db/             schema+migrations, mappers, repositories, backup
src/finance/        money (decimal.js), calculations, compare, allocation, yearly, types
src/store/          AppContext (loads SQLite → memory, FX converter)
src/theme/          tokens + light/dark/system
src/lib/            demo seed
```

## Database

Tables: `accounts`, `snapshots`, `snapshot_entries` (CASCADE on snapshot delete, RESTRICT on account), `transactions`, `categories`, `exchange_rates`, `app_settings`. Migrations via `PRAGMA user_version` (current v3). Backup version 1 JSON.

## Conventions

- Assets positive; liabilities stored as positive outstanding amounts, subtracted: `Net = Assets − Liabilities`.
- Missing observation ≠ 0 — always excluded with coverage labels.
- `% change = Δ / |base| × 100`; null when base is zero (show absolute only).
- Never present carried-forward as verified; never call balance change "return".
