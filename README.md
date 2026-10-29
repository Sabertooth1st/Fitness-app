# ARRIVE

A beginner gym app that helps adults arrive, know what to do today, learn each movement, and come back after a missed week. ARRIVE is a working name; domain, trademark and store-name availability have not been checked.

The main feature is **Comeback Coach**. It is a deterministic rules engine (no AI model) that turns a barrier into one safe next step. Barriers it handles: missed sessions, limited time, feeling unsure, a busy machine, and returning after a break.

> **Status: development build.** The exercise content, programme templates, coaching rules and safety copy are provisional engineering drafts marked **NOT REVIEWED**. No licensed demonstration media has been supplied. A production build refuses to assign unreviewed content. See [docs/RELEASE_BLOCKERS.md](docs/RELEASE_BLOCKERS.md).

## What works today

- Local guest start, with no account. Onboarding asks for goal, experience, 2–3 training days, session length, equipment, units and exclusions.
- The Today screen has training, rest, paused, completed, return and no-valid-session states. A missed session is never doubled.
- Full plan preview and setup lessons are available before arriving at the gym.
- Check-in can be manual (always available) or location-assisted. Location assistance is optional, foreground-only and evaluated on the device.
- A readiness step asks about time, how you feel today, and safety. A safety concern stops the session before anything else happens.
- Guided workout:
  - logging each set takes one or two taps
  - you can edit a logged set
  - the effort question uses plain language
  - the rest timer is stored as a deadline
  - "busy", "too hard" and "not sure" each offer approved swaps
  - "pain/stop" ends the session safely
- Resume after the app is closed, with every set saved in a SQLite transaction.
- Summary screen shows the honest outcome (full / partial / introductory / safety stop), capped habit XP, and lets you update your confidence with each movement.
- Learn library with filters. Exercise detail includes an original front/back muscle diagram with written labels.
- Progress shows "N of M planned sessions this week", completed weeks, permanent levels and history.
- Profile:
  - pause and resume the plan
  - units, theme and reduced motion
  - optional reminders
  - JSON export
  - delete all local data
- Supabase schema with RLS, and an idempotent sync function. A sync outbox and engine are tested; the account UI is not built yet.

## Run it

Requirements: Node 22, npm. Native features need a development build. Expo Go only includes its bundled modules.

```bash
npm ci
cp .env.example .env.local        # optional; empty values = fully local guest mode
npx expo start                    # then open a development build
npx expo run:android | run:ios    # local native build (Android Studio / Xcode)
npx eas-cli@latest build --profile development   # cloud development build
```

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript strict mode |
| `npm run lint` | Expo ESLint config |
| `npm test` | Domain, repository (real SQLite via `node:sqlite`), sync, content and component tests |
| `npm run test:db` | Supabase migration and RLS/sync tests on a throwaway local PostgreSQL |
| `npm run e2e:web` | Browser smoke test of the guest flow (needs `npx expo export -p web --output-dir dist-web` first) |
| `npm run content:audit` | Fails if any assignable movement lacks approval, a licence or media |
| `npm run preview:web` | Builds `dist-preview/arrive.html`: one self-contained file for clicking through the app in a browser (preview only; uses sql.js storage instead of expo-sqlite) |
| `npm run release-check` | Release gate: config, content, rules, legal placeholders, store info, blockers, tests |

## Repository map

```
src/app/            Expo Router screens (tabs: Today, Learn, Progress, Profile; focused workout flow)
src/domain/         Pure TypeScript rules: coach, schedule, substitution, progression, XP, units, check-in
src/content/        Development catalogue and templates (NOT REVIEWED), media resolver
src/data/local/     SQLite schema/migrations and the local-first repository
src/data/sync/      Outbox flush engine (idempotent, bounded, backoff)
src/data/remote/    Optional Supabase client and sync gateway
src/features/       App state, check-in location, workout widgets, settings helpers
src/i18n/           English strings and a draft Swiss High German locale
supabase/           Migrations, RLS tests, Edge Functions
scripts/            Content import/audit, release check, DB test runner
e2e/                Web smoke test and Maestro native flows (native flows not yet run)
website/            Draft privacy, terms, support and account-deletion pages
store/              Draft store listing and data-safety answers
docs/               Architecture, content, privacy, test report, release checklist and blockers
```

Read next: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TEST_REPORT.md](docs/TEST_REPORT.md), [docs/RELEASE_BLOCKERS.md](docs/RELEASE_BLOCKERS.md).
