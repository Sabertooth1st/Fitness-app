# Privacy data map

This map is for the founder's review. It is not legal advice. Training data can be health-related, sensitive personal data under the Swiss revDSG/FADP and EU GDPR. Get qualified legal review for the actual operator and the launch countries.

## Data inventory

| Data | Where | When | Purpose | Leaves device? |
|---|---|---|---|---|
| Adult confirmation, goal, experience, units, locale, theme | SQLite `kv` | Onboarding | Personalise plan and UI | Only with account + backup consent (`profiles`) |
| Programme (days, minutes, pause) | SQLite `kv` | Onboarding / settings | Scheduling | With consent (`user_programmes`) |
| Gym label and equipment | SQLite `gym_profile` | Onboarding / gym screen | Exercise selection | With consent (label + equipment only) |
| **Gym pin (coordinates)** | SQLite `gym_profile` | User taps "Save current location" | On-device check-in comparison | **Never.** Not in sync, export or analytics |
| Live location sample | Memory only | User taps "Check with my location" | One comparison | **Never stored** |
| Check-in | SQLite `workout_sessions` | Check-in | Session record | With consent: method + time only |
| Sessions, exercises, sets, effort answers | SQLite | Workout | Training history, progression | With consent |
| Safety stops | SQLite (outcome only) | Safety answer / pain button | Honest outcome record, pilot metrics | With consent; no symptom details collected |
| Exercise familiarity | SQLite | User rating | Session ordering | With consent |
| XP ledger, milestones, lesson views | SQLite | App use | Habit rewards | With consent (ledger, milestones) |
| Device id | SQLite `kv` | First launch | Active-device policy | With consent |
| Email address | Supabase Auth | Account creation (not built yet) | Sign-in | Yes, when an account is created |
| Subscription status | Supabase `entitlements` | Billing (disabled) | Paid features | Server-managed |

Not collected: body weight, body photos, diagnoses, free-text health notes, contacts, Wi-Fi identifiers, background location, advertising identifiers.

## Processors (to confirm)

| Processor | Use | Status |
|---|---|---|
| Supabase | Auth, Postgres, Storage, Edge Functions | Not yet configured. Choose region deliberately. An EU region alone does not prove compliance. |
| SMTP provider | Auth email | Not chosen. The default Supabase mailer is not for production. |
| Apple / Google | Distribution, store billing | Accounts not created |
| RevenueCat | Subscription lifecycle | Disabled |
| Expo / EAS | Builds and updates | Not configured |

No analytics, crash reporting, advertising or session-replay SDK is installed. If crash reporting is added, scrub coordinates, tokens, email and pain details from it.

## Retention and deletion

- **Guest:** data stays on the device until "Delete all data on this phone" or uninstall. The app warns that deleting it removes guest-only history.
- **Account (planned):**
  - The `delete-account` Edge Function needs a sign-in within the last 10 minutes.
  - It deletes the auth user, and the deletion cascades to all user rows.
  - The app also cancels local reminders and wipes the local DB.
  - Provider backups keep data until their retention window expires: **[[UNRESOLVED: confirm the Supabase plan's backup retention]]**. Deletion from backups is not instant.
- Deleting an account does not cancel store subscriptions; the app explains this.
- The outbox removes completed operations after the retention window (`pruneOutbox`).

## Platform backup behaviour

- Android: `allowBackup: false`.
- iOS: the local DB is currently included in device/iCloud backups. Open blocker.

## Consent

`consent_records` stores purpose, version and timestamp, separately for:

- cloud backup
- analytics
- location assistance (OS permission)

The consent UI is not built yet; this is tracked in RELEASE_BLOCKERS.
