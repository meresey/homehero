# Home Hero

A gamified family habit and chore app for children aged 10–13. This repository contains an Expo/React Native product prototype and a transaction-safe Supabase/PostgreSQL backend.

## What is implemented

- Child Today, Week, Star Store, and Hero screens
- Parent Dashboard, Quest Manager, Approval Inbox, and Rewards screens
- Parent-managed Hero enrollment with child-safe usernames and six-digit PINs
- Party Leader controls for changing managed Hero usernames and resetting PINs
- Separate Party Leader email sign-in and Hero username/PIN sign-in
- Functional Party Leader quest administration with daily, weekly, and Guild filters, create/edit forms, schedules, timers, rewards, and archive-safe removal
- Timer, direct-completion, Guild Quest approval, and reward-redemption interactions
- PostgreSQL schema for households, quests, instances, ledger, levels, streaks, weekly goals, rewards, and redemptions
- Row Level Security policies
- Atomic RPCs for completing quests, starting timers, reviewing Guild Quests, and redeeming rewards
- Idempotent star/XP ledger
- Bedtime expiration and Monday–Sunday streak functions
- Optional Edge Function wrapper for expiration

The app currently uses local demo data so the full interface works without cloud credentials. Supabase is disabled unless `EXPO_PUBLIC_USE_SUPABASE=true` is explicitly set.

## Run the app

Prerequisites: Node.js 20+ and pnpm or npm.

```bash
npm install
cp .env.example .env
npm run start
```

Press `i` for iOS, `a` for Android, or `w` for the browser. Leave the Supabase values unset while reviewing the demo UI.

## Provision Supabase

1. Create a Supabase project.
2. Install the Supabase CLI and link the project.
3. Apply migrations with `supabase db push`.
4. Deploy the managed-Hero functions with `supabase functions deploy enroll-hero manage-hero-credentials`.
5. Enable the `pg_cron` extension in the dashboard.
6. Schedule `expire_overdue_quests()` every five minutes.
7. Add the project URL and publishable/anon key to `.env`.
8. Never put the service-role key in the Expo application.

Example cron setup is included at the bottom of `202609140002_game_functions.sql`.

## Supabase reactivation checklist

Do not enable `EXPO_PUBLIC_USE_SUPABASE` until every item below is complete:

- Apply all pending migrations with `supabase db push`, including `202609150001_consistent_level_progression.sql`.
- Deploy `enroll-hero` and `manage-hero-credentials`; they use the automatically available `SUPABASE_SERVICE_ROLE_KEY` only inside Edge Functions.
- Confirm `level_definitions` contains the 0, 100, 200, 300, and 400 XP thresholds and the `characteristics text[]` column.
- Replace the client’s initial `heroLevels` fixture with a query that loads `level_definitions` from Supabase.
- Add a parent-authorized RPC and RLS policy for saving level titles, XP thresholds, and characteristics.
- Connect `LevelAdmin` saves to that RPC while retaining local-state behavior when the backend flag is off.
- Load the Hero header name from `profiles.display_name` instead of the local `Alex` placeholder.
- Continue loading header stars and lifetime XP from `child_balances`, then calculate the current level from the database-backed level definitions.
- Add `badge_definitions` and `child_badges` tables (including `earned_at`), with household-safe RLS policies.
- Query the child’s earned badge count and badge collection so the shared Hero header and Hero profile use the same database source.
- Retain the local profile and badge fixtures while `EXPO_PUBLIC_USE_SUPABASE=false`.
- Test child read access and parent update access across at least two unrelated households.
- Set `EXPO_PUBLIC_USE_SUPABASE=true`, rebuild the application, and run the authentication, quest, reward, and level regression tests.

Re-enabling the frontend flag never applies migrations automatically. Database migrations must be deployed before the application is rebuilt.

## Staging and production environments

The branded Party Leader confirmation email has a separate
[Supabase email setup runbook](supabase/templates/README.md). Expo deployments do
not publish email templates or SMTP settings.

Home Hero uses separate Supabase projects and Expo environments:

| Environment | Expo environment | Supabase project |
| --- | --- | --- |
| Staging | `preview` | `hqwwqpnmrzonutnqlxhw` |
| Production | `production` | `qufmceawkyuritfyfffa` |

Deploy a testable staging web build with `npm run deploy:staging`. Promote a separately rebuilt production bundle with `npm run deploy:production`. Each command injects the corresponding Expo environment before exporting, preventing a staging build from accidentally using production data.

Apply database changes to staging first:

```bash
npx supabase db push --project-ref hqwwqpnmrzonutnqlxhw
npx supabase functions deploy --project-ref hqwwqpnmrzonutnqlxhw
```

After validation, apply the same committed migrations and functions to production:

```bash
npx supabase db push --project-ref qufmceawkyuritfyfffa
npx supabase functions deploy --project-ref qufmceawkyuritfyfffa
```

Authentication users and household data are intentionally independent between the two projects. Never copy production user or household data into staging.

### Additional Party Leaders

The household owner can create an email-bound, one-time Party Leader invitation from the Party Leaders panel on the home dashboard. Share its 32-character code privately; it is shown only when created, expires after seven days, and can be revoked. The invited adult creates or signs in to their own confirmed account, then selects **Join household** during onboarding and enters the code. Existing Heroes become visible to the new leader automatically. The owner can remove another leader without deleting their account or historical activity. The Hero family join code cannot grant Party Leader access.

Apply `202609210001_party_leader_invitations.sql` to staging before testing this flow there. As with other migrations, a frontend deploy alone does not create the database functions. Apply to production only during an explicitly requested production release.

## Server command mapping

| User action | RPC |
| --- | --- |
| Complete daily/bedtime quest | `complete_quest(instance_id)` |
| Start a timed quest | `start_timer(instance_id)` |
| Finish timed quest | `finish_timer(instance_id)` |
| Submit family quest | `submit_guild_quest(instance_id)` |
| Approve/reject Guild Quest | `review_guild_quest(instance_id, approve, note)` |
| Spend stars | `redeem_reward(reward_id, idempotency_key)` |
| Create or edit a quest | `upsert_quest_admin(...)` |
| Remove a quest from future schedules | `archive_quest_admin(template_id)` |

`award_quest` is intentionally private. `finish_timer` verifies ownership, while `award_quest` verifies the server-recorded end time before writing either currency.

## Important production follow-ups

- Apply and verify the production Supabase password policy alongside the
  corresponding application release; follow
  [`docs/password-policy.md`](docs/password-policy.md).
- Add Party Leader PIN reset and managed-Hero archival controls.
- Connect the included timezone-aware `generate_daily_quest_instances()` job to Supabase Cron.
- Replace the local UI mutations with TanStack Query calls to the RPC layer.
- Register Expo push tokens and send Guild approval notifications from an Edge Function.
- Add signed evidence uploads.
- Test RLS with multiple households.
- Add clock, timezone, DST, concurrency, offline-sync, and double-tap integration tests.
- Add notification, audio, haptic, and reduced-motion preferences.

## Directory map

```text
app/                         Expo Router entry points
src/HomeHeroApp.tsx          Child and parent product surfaces
src/components.tsx           Shared UI primitives
src/data.ts                  Local demo fixtures
src/lib/supabase.ts          Optional backend client
supabase/migrations/         Schema, RLS, and game functions
supabase/functions/          Privileged serverless functions
```
