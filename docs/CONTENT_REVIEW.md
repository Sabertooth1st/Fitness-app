# Content review

ARRIVE gives general fitness guidance to adults. Before any production recommendation, a **qualified exercise professional** must review the items below and record approval. Claude or other tooling must never be recorded as the reviewer. Never fabricate a reviewer name, qualification or signature.

## What needs review

| Item | Location | Current status |
|---|---|---|
| Exercise instructions, setup, cues, mistakes, stop guidance | `src/content/exercises.dev.ts`, or the imported catalogue | NOT REVIEWED (engineering drafts) |
| Primary/secondary muscle metadata | same | NOT REVIEWED |
| Alternatives, regressions and progressions | same | NOT REVIEWED |
| Programme templates (sets, reps, rest, short/introductory/re-entry variants) | `src/content/templates.dev.ts` | NOT REVIEWED |
| Coaching rules: rest days, long-break threshold (14 days), re-entry load factor (0.7), increments, reduction factor (0.9) | `src/domain/rules.ts` | NOT REVIEWED |
| Readiness safety question and safety-stop copy | `src/i18n/en.ts` → `readiness.safetyQuestion`, `safety.*` | NOT REVIEWED |
| Familiarisation guidance ("light weight you could lift for at least 4 more repetitions") | `src/i18n/en.ts` → `workout.familiarise` | NOT REVIEWED |
| Demonstration media accuracy | asset manifest | No media supplied |
| Muscle diagram geometry (an original schematic) | `src/components/MuscleMap.tsx` | NOT REVIEWED |
| Swiss High German translation | `src/i18n/de-CH.draft.ts` | Draft, structure only |

The safety question and emergency copy were informed by the ACSM/Exercise is Medicine pre-participation screening concepts named in the brief. They do not reproduce that form. The reviewer should confirm the wording and check reuse terms if any clinical material is adapted.

## How to record approval

1. Write one `content_reviews` row per reviewed item and version (see the migration). Include:
   - reviewer name
   - qualification
   - evidence reference (signed review document stored outside the repo)
   - decision
   - date
2. Only then set `reviewStatus: 'approved'` on the exercise, template or rules version, and bump the content version.
3. Run `npm run content:audit` and `npm run release-check`.

## Release gate

In a production build:

- `decideSession` refuses unapproved templates.
- `checkEligibility` refuses unapproved exercises.
- The content audit fails on any assignable movement that lacks approval, a licence, approved media or complete instructions.

## Pilot recommendation

The brief suggests a four-week pilot: 15–20 beginners and one qualified coach who can watch real sessions.
