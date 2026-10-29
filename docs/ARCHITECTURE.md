# Architecture

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Expo SDK 58 (React Native 0.88, React 19.3), TypeScript strict | Latest stable SDK on the build date (SDK 58.0.0 released 2026-09-29). Versions come from Expo's bundled compatibility list (`expo install`), and `package-lock.json` pins them. |
| 2 | Routes live in `src/app/`, not root `app/` | This is the SDK 58 template convention. Non-route code stays outside `src/app/`. |
| 3 | Domain logic is pure TypeScript in `src/domain/`, with an explicit date and no I/O | Plans can be reproduced and tested without devices or AI services. No production LLM dependency. |
| 4 | Local-first SQLite through a small `Db` interface | `expo-sqlite` runs in the app. Node's `node:sqlite` runs the same repository code in tests against a real SQLite engine. |
| 5 | Every write goes through `WriteQueue`: one serialised transaction plus its outbox op | `expo-sqlite`'s `withTransactionAsync` is not exclusive. Without the queue, async calls could interleave. |
| 6 | Logged weights are stored as entered (`value`, `unit`, `basis`) and converted only for display | Prevents kg↔lb rounding drift and accidental doubling of dumbbell weights. |
| 7 | Rest timer persists a deadline (`rest_until`) | Survives backgrounding and process death without relying on a JS interval. |
| 8 | XP is an immutable ledger with unique award keys, plus a weekly cap | Replays, retries and timezone changes cannot duplicate rewards. The server re-validates amounts and caps. |
| 9 | Sync uses an outbox with stable op IDs. `apply_sync_operations` applies each op at most once | Makes retries idempotent. Guest→account migration is just the first flush. |
| 10 | Conflict policy: a session completed on the server is immutable | Edits from another device are rejected with `conflict_completed_elsewhere`. The local copy is kept and surfaced, never silently overwritten. |
| 11 | The gym pin stays on the device | It is not in the sync payload, the export or analytics. Check-in stores only the method and time. |
| 12 | Content and templates carry `reviewStatus`. Outside `development`, only `approved` content is assignable | The engine enforces this in `checkEligibility` and `decideSession`. The content audit and release check also enforce it. |
| 13 | Billing (RevenueCat) is not installed yet; the env flag defaults to `false` | The free pilot comes first. The webhook and entitlements schema exist server-side. |
| 14 | Web exists only for smoke tests and a clickable preview | `expo-sqlite` on web needs cross-origin isolation, so `DbProvider.web.tsx` uses sql.js (SQLite compiled to JavaScript) and saves to localStorage. Phones always use `DbProvider.tsx` (expo-sqlite). Web is not a product target; async route splitting is off for web so the preview can be one file. |

## Comeback Coach (src/domain/coach.ts)

The coach takes these inputs:

- programme
- reviewed template
- catalogue
- completed history
- today's date
- rescheduled dates
- available minutes
- feeling (`comfortable`, `unsure`, `returning`)
- safety answer
- constraints: available, excluded and occupied equipment, plus excluded exercises
- familiarity
- environment
- rules version
- kill-switch list

Decision order:

1. Safety concern → `safety_stop`. This outranks everything.
2. Outside development, an unreviewed template → `no_valid_session`.
3. `evaluateDay` checks paused, completed today, recovery gap, weekly target met, planned day or rescheduled day. If it isn't a training day → `not_today`.
4. The next session key comes from **actual completion** (`nextSessionKey`), not from the calendar.
5. Variant order:
   - unsure → introductory
   - long break or returning → re-entry, then introductory
   - less time than the standard session → short, then introductory
   - otherwise standard, then short, then introductory
6. For each variant, `selectExercises` fills the slots:
   - It keeps the previous movement for each slot when it is still valid. This keeps practice stable.
   - Otherwise it orders eligible candidates by familiarity, then by template order.
   - A required slot with no eligible candidate rejects that variant.
   - An optional slot with no eligible candidate is dropped, with a reason given.
7. If no variant fits → `no_valid_session` with reasons. Exclusions are never relaxed to force a fit.

Every result carries reason codes. These map to reviewed copy in `src/i18n/en.ts`; the app never claims to sense emotions.

Substitution (`substitution.ts`) works like this:

- It uses only approved `alternatives` and `regressions` with the same movement pattern.
- It re-checks every hard constraint, treating the busy equipment as occupied.
- It never touches completed sets or other exercises. The repository keeps logged sets on the replaced record.

## Persistence

SQLite tables (`src/data/local/db.ts`, migration via `PRAGMA user_version`):

- `kv` (profile, programme, exclusions, reminders, consents, device id)
- `gym_profile` (pin is local only)
- `exercise_confidence`
- `workout_sessions` (one active session per device, enforced by a unique partial index)
- `workout_exercises` (with a content snapshot and a prescription snapshot)
- `set_logs`
- `xp_ledger`
- `milestones`
- `lesson_views`
- `rescheduled_dates`
- `outbox`

**Offline:** the whole plan, instructions and history are local. Nothing in the workout loop waits on the network. Licensed media will be cached into private app storage where the licence permits (`src/content/media.ts` resolver). No media exists yet.

**Cache invalidation (planned with cloud content):** on reconnect, the client fetches `feature_switches` and approved content versions. A disabled exercise or template is not assigned in *new* sessions. Sessions already in progress keep their snapshot. A device that stays offline keeps the last switches it received. This is a documented residual limitation.

## Server (supabase/)

- `migrations/20261029000000_init.sql` creates every entity from the brief, enables RLS, and applies explicit grants:
  - Own-row policies on user tables.
  - Read-only access for clients to the XP ledger, milestones, entitlements and sync bookkeeping.
  - Clients can read only approved catalogue content.
  - Licences, reviews, assets and billing events have no client grant.
- `apply_sync_operations(jsonb)` is a security-definer function bound to `auth.uid()`. It is idempotent by op id, rejects edits to completed sessions, and validates XP amounts and the weekly cap.
- Edge Functions:
  - `delete-account` requires a recent sign-in and cascades through `auth.users`.
  - `media-url` returns a short-lived signed URL for one approved asset only.
  - `revenuecat-webhook` verifies a shared secret, dedupes by event id, and updates entitlements. It has not been verified against a sandbox.

### Server-only configuration

These values must never be committed or embedded in the app:

- Supabase administrative/service-role key. It is provided to Edge Functions by the Supabase runtime. Confirm the current variable name in the Supabase docs before deploying; the code reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `REVENUECAT_WEBHOOK_AUTH`: the shared secret configured in the RevenueCat webhook settings.
- SMTP credentials for production auth email, configured in Supabase Auth settings (not in code).
- Media storage bucket `exercise-media`, which must be **private**.

Keep separate Supabase projects for development, staging and production. Apply migrations with `supabase db push` per environment.

**Rollback:** write a forward fix migration. Avoid destructive down-migrations on production data. Take a backup before every migration, and record the restore procedure in RELEASE_CHECKLIST.

## Accounts (not yet built)

The `getSupabase()` client and `supabaseGateway()` exist. What's still missing:

- Email OTP sign-in UI.
- A consent screen for cloud backup.
- Account ownership isolation: the kv key `account_owner` is reserved. If local data belongs to a different account, the app must refuse to mix it, and offer export then wipe.
- Calling `flushOutbox` on reconnect.

Tokens use `expo-secure-store`. Historically, SecureStore values have a size limit of about 2 KB on some platforms, and Supabase sessions can exceed it. Before enabling accounts, either chunk the session across keys, or encrypt it with a SecureStore-held key and keep the ciphertext in SQLite. Test this on real devices.

## Privacy-relevant platform settings

- Android: `allowBackup: false`, so the local fitness DB is not sent to Google Auto Backup. Background location and storage permissions are blocked in `app.json`.
- iOS: SQLite files in the app container are included in iCloud/device backups by default. Excluding them (`NSURLIsExcludedFromBackupKey`) needs a small native config plugin. This is an open blocker.
- Location: when-in-use only. Background modes and foreground service are disabled in the `expo-location` plugin config.
