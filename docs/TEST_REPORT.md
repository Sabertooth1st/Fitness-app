# Test report

Recorded 2026-10-29 in a Linux cloud container (Node 22.22, PostgreSQL 16, Chromium via Playwright). Every result below was observed in that run. **No physical device, simulator or real gym test has been run yet.**

## Automated results

| Suite | Command | Result |
|---|---|---|
| TypeScript strict | `npm run typecheck` | Pass |
| ESLint (Expo config, React compiler rules) | `npm run lint` | Pass, 0 problems |
| Unit, repository, sync, content and component tests | `npm test` | **59/59 pass** (6 suites) |
| Supabase migration + RLS/sync tests (PostgreSQL 16 with a Supabase `auth` shim) | `npm run test:db` | **24/24 assertions pass** |
| Android JS bundle (Hermes) | `npx expo export -p android` | Builds (3.3 MB HBC) |
| Web smoke flow (Chromium, 390×844, fixed Monday clock) | `npm run e2e:web` | Pass, no console errors |
| Production content audit | `npm run content:audit` | **Fails, as intended**: 67 problems (unreviewed template and movements, no licence, no media) |
| Release check | `npm run release-check` | **Fails, as intended**: config, rules, content, legal placeholders, store info, open blockers |

Bugs found and fixed while testing:

- Partial session updates violated NOT NULL in the sync SQL.
- A PL/pgSQL variable had an ambiguous name.
- The weight stepper overflowed on narrow screens.
- Confirmation dialogs did nothing on web.

## Acceptance tests (from the brief)

| # | Test | Status | Evidence |
|---|---|---|---|
| 1 | Guest sees the next plan and all lessons before check-in | Partially automated (web) | `e2e/web-smoke.js` opens the plan preview before check-in. Each preview card links to its setup lesson, but the smoke test opens a lesson from Learn *after* the workout. On rest days the preview shows the next training date (code path; not yet in an automated test). |
| 2 | Location refusal, timeout, stale or poor accuracy leave a manual route | Logic automated; native not run | `tests/domain/rules.test.ts` (stale, poor and missing accuracy, unavailable, far). The UI always renders the manual button. `e2e/maestro/location-denied.yaml` is **not yet run**. |
| 3 | Check-in never triggers a purchase or hides safety info | By construction | No billing SDK installed. Check-in leads only to readiness. Safety copy is reachable from readiness and the workout. Needs a review when billing is enabled. |
| 4 | Rest day assigns no heavy session | Automated | `coach.test.ts` "rest day does not assign training" |
| 5 | Exclusions and missing equipment respected in selection and substitution | Automated | `coach.test.ts`, `rules.test.ts` (substitution re-checks exclusions) |
| 6 | No valid substitute → explanation, not a guess | Automated | `coach.test.ts`, `rules.test.ts` (`no_valid_substitute`) |
| 7 | Missed session does not double volume | Automated | `coach.test.ts` |
| 8 | Long break → re-entry policy | Automated | `coach.test.ts`, `rules.test.ts` (re-entry load) |
| 9 | Pain/concern outranks completion/XP | Automated (logic) | `coach.test.ts` (concern → `safety_stop`), `rules.test.ts` (no mission XP for `safety_stop`), `store.test.ts` (safety stop recorded distinctly). The pain button's UI path is in `e2e/maestro/guest-flow.yaml`, which is **not yet run**. |
| 10 | Termination after a logged set preserves it | Automated (SQLite file reopen + web reload) | `store.test.ts`, `e2e/web-smoke.js`. **Native process kill not yet run.** |
| 11 | Airplane mode with a prepared workout | Partially by construction | The workout loop makes no network calls. There is no licensed media to cache yet. **Not device-tested.** |
| 12 | Reconnect/retry does not duplicate | Automated | `sync.test.ts` (lost response after commit), `rls.test.sql` (replays), `store.test.ts` (concurrent XP) |
| 13 | Two devices cannot silently overwrite a completed workout | Automated (server + client) | `rls.test.sql`, `sync.test.ts`. The UI shows a warning when the session belongs to another device. |
| 14 | kg/lb and dumbbell conventions | Automated | `rules.test.ts` (units) |
| 15 | Timezone or midnight crossing does not duplicate rewards | Automated | `rules.test.ts` (DST local dates, same session on a different local date) |
| 16 | Users cannot read others' records or write authority fields | Automated (shim) | `rls.test.sql`. **Re-run on a real Supabase staging project.** |
| 17 | Guest migration can retry without duplicates | Automated (engine) | `sync.test.ts`. Account UI not built. |
| 18 | Export contains own records only; deletion removes data | Partially | Export excludes coordinates (`store.test.ts`). Local wipe implemented. Server deletion cascade tested in SQL. Edge Function **not deployed or tested**. |
| 19 | Subscription purchase/restore/expiry/cancel in native sandbox | **Not started** | Billing disabled; no RevenueCat SDK or sandbox accounts |
| 20 | Production audit fails without rights, approval or media | Automated | `tests/content/importAudit.test.ts`. The real audit currently fails. |
| 21 | Large text, screen reader, reduced motion in the player | Partially | Component tests cover labels and selection state. Font scaling is not disabled anywhere. Reduced motion switches media to stills. **No VoiceOver/TalkBack session yet.** |
| 22 | Real-device tests (iPhone, Android, permissions, low connectivity, real gym) | **Not run** | Needs devices and a pilot gym |

## Manual QA checklist (to be filled in with observed results)

| Case | iPhone | Android | Notes |
|---|---|---|---|
| Fresh install → onboarding → Today | not run | not run | |
| Location: allow / deny / "ask next time" / precise off | not run | not run | |
| Location indoors (large building), airplane mode | not run | not run | |
| Log sets, lock phone 3 min, rest timer correct on unlock | not run | not run | |
| Force-quit mid-workout, reopen → resumes | not run | not run | |
| Busy machine → swap → only that exercise changes | not run | not run | |
| Pain/stop → safety screen, no XP prompt | not run | not run | |
| VoiceOver / TalkBack through a full workout | not run | not run | |
| Largest text size in workout player | not run | not run | |
| Reduced motion on | not run | not run | No media yet |
| Reminder fires on a planned day, deep link opens app without check-in | not run | not run | |
| Export JSON via share sheet | not run | not run | |
| Delete all local data | not run | not run | |
| Real gym visit with a beginner | not run | not run | |
