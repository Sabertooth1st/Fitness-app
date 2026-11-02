# Release blockers

`npm run release-check` fails while any box below is unchecked. Tick an item only with real evidence.

## Owner actions (need a person, an account or a purchase)

- [ ] Qualified exercise professional reviews exercises, templates, coaching rules, safety copy and muscle metadata, and the review is recorded in `content_reviews` (CONTENT_REVIEW.md)
- [ ] Licensed demonstration media purchased by the owning entity: RepDB Standard is the default candidate, after inspecting samples and coverage. Licence terms confirmed for on-device caching/bundling.
- [ ] Provider-specific import adapter written against the delivered bundle schema, and the full manifest imported into `content-private/`
- [ ] Every assignable movement has approved media and instructions (`npm run content:audit` passes on the imported catalogue)
- [ ] Supabase projects created (dev / staging / production), with region chosen deliberately and migrations applied
- [ ] RLS tests re-run against real Supabase staging (`supabase test db` or equivalent)
- [ ] Production SMTP configured with a verified sender domain; sign-in and recovery tested
- [ ] Operator legal name, address, monitored support and privacy email, backup retention, governing law: replace every `[[UNRESOLVED` in `website/`
- [ ] Legal/privacy review for the actual business and countries served (revDSG/FADP, GDPR if EU users)
- [ ] Domain, trademark and store-name availability checked for "ARRIVE"
- [ ] Apple Developer and Google Play accounts created, identity checks complete
- [ ] Google Play closed test with at least 12 testers for 14 continuous days (new personal accounts)
- [ ] Store listing, screenshots, privacy labels / data safety and health-app declaration completed (`store/listing.json`)

## Engineering work remaining

- [ ] Account UI: email OTP sign-in, cloud-backup consent screen, account-owner isolation on sign-in/out, trigger `flushOutbox` on reconnect
- [ ] Session storage for Supabase tokens that respects the SecureStore size limit (chunking or encrypted SQLite), tested on devices
- [ ] In-app account deletion calling `delete-account` with re-authentication; deploy and test the Edge Functions
- [ ] iOS: exclude the local SQLite DB from iCloud/device backup (config plugin), or document an accepted decision
- [ ] Licensed media download into private storage plus offline-ready indicator per asset; `media-url` deployed
- [ ] Remote feature switches fetched on reconnect (kill switch for exercises/templates)
- [ ] CSV export (JSON export done)
- [ ] Conflict surfacing UI for `conflict_completed_elsewhere` outbox entries
- [ ] Swiss High German locale translated and reviewed (draft only, dev builds only)
- [ ] App icon and splash (template placeholders in `assets/`)
- [ ] Native E2E: run `e2e/maestro/*` on iOS and Android development builds and record results in TEST_REPORT.md
- [ ] Real-device QA checklist completed (TEST_REPORT.md), including a real gym visit

## Billing (only when a paid test is approved)

- [ ] RevenueCat SDK installed behind `EXPO_PUBLIC_BILLING_ENABLED`, products and entitlement mapped, store-returned localised prices used, restore and manage-subscription links added
- [ ] Webhook verified with RevenueCat sandbox events (purchase, renewal, cancellation, expiry, billing issue); account switching tested
- [ ] Confirm no paywall can appear after a workout has started
