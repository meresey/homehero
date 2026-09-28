# Coin economy and Hero Shop migration plan

Starry Habits will present its spendable quest currency as **Coins** (`🪙`) and its
reward marketplace as the **Hero Shop**. XP remains permanent level progress,
and badges remain permanent achievements.

## Phase 1 — Compatibility presentation

Status: implemented and validated on staging.

- Replace user-facing Stars terminology with Coins across Hero and Party Leader
  screens, alerts, accessibility labels, weekly progress, quest rewards, and
  reward approvals.
- Rename Star Store to Hero Shop.
- Preserve existing TypeScript properties and Supabase names such as `stars`,
  `star_reward`, `star_cost`, and the `star` ledger currency.
- Translate database-authored legacy error and badge wording before displaying
  it to users.
- Preserve all balances, rewards, redemptions, quest history, and reports.

This phase is intentionally backward compatible and requires no database
migration.

## Phase 2 — Staging validation

Status: complete.

- Deploy Phase 1 to staging.
- Verify a quest displays and awards Coins only after approval.
- Verify weekly available/earned totals still agree with quest values.
- Verify Hero Shop affordability, request, insufficient-balance, approval, and
  deduction flows.
- Verify existing households retain exactly the same numeric balances.
- Check mobile and desktop layouts, screen-reader labels, and empty states.

## Phase 3 — System content cleanup

Status: complete in migration `202609270003_coin_badge_copy.sql` and the
regenerated first-time guide.

- Update system badge descriptions and operational documentation to use Coins
  and Hero Shop.
- Regenerate the downloadable first-time guide PDF after the terminology and
  layouts have been approved.
- Keep stars only where they are decorative achievement imagery, such as a
  badge named “Reading Star”; do not use them as currency.

## Phase 4 — Optional database vocabulary migration

Only consider this after staging and production have been stable. A database
rename is not required for the feature to work and has more operational risk.

If pursued, use additive migrations rather than destructive renames:

1. Add coin-compatible views/RPC parameters while retaining old contracts.
2. Update application code and verify both contracts during a transition.
3. Backfill and reconcile balances against the immutable point ledger.
4. Remove legacy names only in a later release after rollback is no longer
   required.

At no point should a migration recalculate or reset a Hero’s balance.
