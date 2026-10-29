# Content import

## Rules

- Import only content you legitimately acquired.
- Keep raw bundles, receipts and generated output in `content-private/`. Git ignores this folder. Never commit it to a public repository.
- Never scrape Google Images, YouTube, MuscleWiki or competing apps.
- Never invent animations or placeholder URLs.
- Never feed purchased artwork into generative tools.
- The importer marks every record `not_reviewed`. Only a human reviewer approves content (see CONTENT_REVIEW.md).
- The delivered manifest decides the real count. A vendor's "N exercises, all animated" claim is not evidence of coverage.

## Pipeline

1. Put the delivered bundle in `content-private/<provider>/<version>/`.
2. Write `content-private/<provider>/licence.json`, following the `LicenceRecord` type in `scripts/content/types.ts`. Set `permitsOfflineCache` and `permitsAppBundling` only when the binding licence, or the vendor's written confirmation, actually permits them.
3. Use an existing adapter, or write a new one in `scripts/content/` that reads the **delivered** schema. No RepDB or MoveKit adapter exists yet: write it after inspecting the real files.
4. Run the import:
   ```bash
   npm run content:import -- --adapter generic-json --bundle content-private/<provider>/<version> --licence content-private/<provider>/licence.json
   ```
   This writes `content-private/generated/catalogue.json`, `asset-manifest.json` and `licence.json`. Each asset has a SHA-256 checksum and a distribution mode (`app_bundle` / `private_cache` / `stream_only`).
5. Record the human review decisions, then run the audit:
   ```bash
   npm run content:audit -- --catalogue content-private/generated/catalogue.json --manifest content-private/generated/asset-manifest.json
   ```

## Intermediate format (`generic-json` adapter)

`exercises.json` is an array of `Exercise` objects (see `src/domain/types.ts`), without `reviewStatus` and `media`. Two optional fields can be added:

- `mediaFile`: a path relative to the bundle.
- `mediaType`: one of `video/mp4`, `image/png`, `image/webp`, `image/gif`.

## Provider notes (from the research brief, to verify at purchase)

- **RepDB Standard:** bundling and serving inside your own product is permitted. Raw catalogue redistribution and public bulk asset buckets are prohibited. White-label client products are excluded.
- **MoveKit:** get written confirmation of private on-device caching and app bundling for this app before relying on offline use.
- **MuscleWiki API:** no permanent media storage and no offline playback under the standard terms. It must not be used for the offline feature.

## Serving

Cloud assets go in the private `exercise-media` bucket. The `media-url` Edge Function returns a 5-minute signed URL for one approved asset. There is no listing endpoint. On-device caching happens only for assets whose `distributionMode` is `private_cache` or `app_bundle`.

## What's in the repo now

`src/content/exercises.dev.ts` holds 22 development movements that the engineering team wrote as placeholder text. They have no media and use the `internal-dev-text` licence marker. All are `not_reviewed`, and the content audit fails on them by design.
