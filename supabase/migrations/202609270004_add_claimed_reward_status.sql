-- An approved purchase is an entitlement in the Hero's wallet. Claiming it
-- asks a Party Leader to deliver the real-world reward; fulfillment completes
-- the lifecycle. Existing approved purchases remain redeemable.

alter type public.redemption_status add value if not exists 'claimed' after 'approved';

alter table public.reward_redemptions
  add column if not exists claimed_at timestamptz,
  add column if not exists fulfilled_by uuid references public.profiles(id);

