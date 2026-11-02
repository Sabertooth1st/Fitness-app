# ARRIVE

A beginner gym app that helps adults arrive, know what to do today, learn each movement, and come back after a missed week. ARRIVE is a working name; domain, trademark and store-name availability have not been checked.

The main feature is **Comeback Coach**. It is a deterministic rules engine (no AI model) that turns a barrier into one safe next step. Barriers it handles: missed sessions, limited time, feeling unsure, a busy machine, and returning after a break.

> **Status: development build.** The exercise content, programme templates, coaching rules and safety copy are provisional engineering drafts marked **NOT REVIEWED**. No licensed demonstration media has been supplied. A production build refuses to assign unreviewed content. See [docs/RELEASE_BLOCKERS.md](docs/RELEASE_BLOCKERS.md).

## What works today

- **Design:** dark-first "iron and chalk" look (graphite surfaces, chalk text, safety-yellow accent) with a bold condensed display font (Barlow Condensed) and a matching light mode.
- **Built for the hard days:**
  - A daily line on Today, plus "weeks in a row" (paused weeks never break the run) and a "hard days beaten" counter.
  - **Hard-day mode** ("Hard day? Don't skip. Shrink it."): pick what's in the way and get a 20-minute short session. For "I don't feel like it", the deal is: check in and do the first exercise, and that counts.
  - Badges at 1, 5, 10, 25, 50 and 100 hard days beaten. Hard days never add volume and never override the safety stop.
- **Exercise library: 92 movements** across 17 movement types and 24 kinds of equipment (machines, barbell, dumbbells, kettlebells, cables, bars, bands, cardio). Each has setup steps, key points, mistakes to avoid, when to stop, a muscle diagram, and easier / swap / next-level links. All are marked NOT REVIEWED.
- **Learn tab:** "Gym basics" lessons (sets and reps, picking a weight, rest, etiquette, soreness vs pain), search, and filters by type, equipment, muscle and level.
- **Guest flow:** onboarding (grouped equipment) → Today → plan preview → check-in → readiness and safety → guided workout → summary.
- **Workout player:**
  - progress strip across exercises and a big set counter
  - logging a set takes one or two taps, with a short encouragement after each set
  - effort question and a rest timer stored as a deadline
  - approved swaps for "busy", "too hard" and "not sure"
  - "Pain: stop" ends the session safely
  - resume after the app is closed
- **Comeback Coach** (deterministic): picks the next session from actual completion history, never doubles a missed session, offers short, learn-the-gym and comeback sessions, and treats exclusions as hard constraints.
- **Progress, Profile, Supabase schema with RLS, sync outbox, release gate:** as before.

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
| `npm run e2e:web` | Browser end-to-end suite: full session, hard day, busy swap, pain stop, resume after reload, every exercise page, both themes (needs `npx expo export -p web --output-dir dist-web` first) |
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
e2e/                Web end-to-end suite and Maestro native flows (native flows not yet run)
website/            Draft privacy, terms, support and account-deletion pages
store/              Draft store listing and data-safety answers
docs/               Architecture, content, privacy, test report, release checklist and blockers
```

Read next: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TEST_REPORT.md](docs/TEST_REPORT.md), [docs/RELEASE_BLOCKERS.md](docs/RELEASE_BLOCKERS.md).
