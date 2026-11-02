# Release checklist

Use this list for every beta or production release. Record who did each step and when.

## Before building

1. `npm ci`, then `npm run check` (typecheck, lint, unit tests).
2. `npm run test:db` locally, then run the RLS tests against the **staging** Supabase project.
3. `npm run content:audit -- --catalogue content-private/generated/catalogue.json --manifest content-private/generated/asset-manifest.json`
4. `npm run release-check` must pass for production. It cannot certify legal compliance or exercise safety; those need the signed reviews in CONTENT_REVIEW.md.
5. Confirm that every EAS environment's variables match `.env.example`, and that no secret uses an `EXPO_PUBLIC_` prefix.

## Database

1. Back up the target project, and note the backup id.
2. `supabase db push` to staging, then smoke test, then production.
3. Rollback: restore from the backup id, or apply a forward fix migration. Never edit a migration that has already been applied.

## Build and submit

1. `npx eas-cli@latest build --profile preview` (internal testers), then run the manual QA checklist on real iPhone and Android devices.
2. `npx eas-cli@latest build --profile production`
3. `npx eas-cli@latest submit --profile production`
4. Make sure the store review notes match the implemented app: no account needed, location optional, billing state.

A successful build is not store approval, and store approval is not evidence of demand.

## After release

- Watch help requests, pain-related stops, failed check-ins and lost-log reports.
- Kill switch: add the exercise or template id to the remote `feature_switches` (once implemented), or to `src/config/featureSwitches.ts` in the next build.
- Offline devices keep their last-received switches until they reconnect.
