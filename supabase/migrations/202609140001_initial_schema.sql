create extension if not exists pgcrypto;

create type public.member_role as enum ('parent', 'child');
create type public.quest_kind as enum ('daily', 'timer', 'guild', 'bedtime');
create type public.quest_status as enum ('available', 'in_progress', 'pending_approval', 'rewarded', 'rejected', 'expired', 'skipped');
create type public.ledger_currency as enum ('star', 'xp');
create type public.ledger_reason as enum ('quest_reward', 'streak_bonus', 'manual_adjustment', 'redemption', 'refund');
create type public.redemption_status as enum ('requested', 'approved', 'fulfilled', 'rejected', 'cancelled');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  timezone text not null default 'Africa/Nairobi',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  birth_year smallint,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.parent_child_links (
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  primary key (household_id, parent_id, child_id),
  check (parent_id <> child_id)
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  notifications_enabled boolean not null default true,
  last_seen_at timestamptz not null default now()
);

create table public.quest_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 100),
  description text,
  icon_key text not null default 'sparkles',
  kind public.quest_kind not null,
  star_reward integer not null default 1 check (star_reward between 0 and 100),
  xp_reward integer not null default 1 check (xp_reward between 0 and 100),
  timer_seconds integer check (timer_seconds between 60 and 10800),
  parent_approval_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'timer' and timer_seconds is not null) or kind <> 'timer'),
  check (kind <> 'guild' or parent_approval_required)
);

create table public.quest_assignments (
  id uuid primary key default gen_random_uuid(),
  quest_template_id uuid not null references public.quest_templates(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  days_of_week smallint[] not null default '{1,2,3,4,5,6,7}',
  local_cutoff time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.quest_instances (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.quest_assignments(id) on delete cascade,
  quest_template_id uuid not null references public.quest_templates(id),
  household_id uuid not null references public.households(id),
  child_id uuid not null references public.profiles(id),
  occurrence_date date not null,
  available_at timestamptz not null,
  cutoff_at timestamptz,
  expires_at timestamptz not null,
  status public.quest_status not null default 'available',
  star_reward_snapshot integer not null check (star_reward_snapshot >= 0),
  xp_reward_snapshot integer not null check (xp_reward_snapshot >= 0),
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  expired_at timestamptz,
  rewarded_at timestamptz,
  timer_started_at timestamptz,
  timer_expected_end_at timestamptz,
  version integer not null default 1,
  unique (assignment_id, occurrence_date)
);

create index quest_instances_child_day on public.quest_instances(child_id, occurrence_date);
create index quest_instances_open_deadline on public.quest_instances(coalesce(cutoff_at, expires_at)) where status in ('available', 'in_progress');

create table public.quest_approvals (
  id uuid primary key default gen_random_uuid(),
  quest_instance_id uuid not null unique references public.quest_instances(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);

create table public.quest_events (
  id bigint generated always as identity primary key,
  quest_instance_id uuid not null references public.quest_instances(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  previous_status public.quest_status,
  new_status public.quest_status,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  child_id uuid not null references public.profiles(id),
  currency public.ledger_currency not null,
  amount integer not null check (amount <> 0),
  reason public.ledger_reason not null,
  quest_instance_id uuid references public.quest_instances(id),
  reference_key text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (child_id, currency, reference_key)
);

create index point_ledger_child_currency on public.point_ledger(child_id, currency, created_at);

create table public.level_definitions (
  level integer primary key check (level > 0),
  minimum_xp integer not null unique check (minimum_xp >= 0),
  title text not null,
  badge_key text not null
);

insert into public.level_definitions values
  (1, 0, 'Rookie Hero', 'shield-1'),
  (2, 100, 'Rising Hero', 'shield-2'),
  (3, 300, 'Home Hero', 'shield-3'),
  (4, 400, 'Legendary Leader', 'shield-4'),
  (5, 500, 'Ultimate Hero', 'shield-5');

create table public.streak_awards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  child_id uuid not null references public.profiles(id),
  assignment_id uuid not null references public.quest_assignments(id),
  week_start date not null,
  xp_awarded integer not null default 5,
  created_at timestamptz not null default now(),
  unique (child_id, assignment_id, week_start)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  icon_key text not null default 'gift',
  star_cost integer not null check (star_cost > 0),
  inventory integer check (inventory is null or inventory >= 0),
  requires_parent_approval boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  child_id uuid not null references public.profiles(id),
  week_start date not null,
  target_stars integer not null check (target_stars > 0),
  available_stars integer not null check (available_stars >= target_stars),
  bonus_reward_id uuid references public.rewards(id),
  achieved_at timestamptz,
  claimed_at timestamptz,
  unique (child_id, week_start)
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id),
  child_id uuid not null references public.profiles(id),
  star_cost_snapshot integer not null check (star_cost_snapshot > 0),
  status public.redemption_status not null default 'requested',
  reviewed_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  idempotency_key text not null,
  unique (child_id, idempotency_key)
);

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from household_members where household_id = target_household and user_id = auth.uid()) $$;

create or replace function public.is_household_parent(target_household uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from household_members where household_id = target_household and user_id = auth.uid() and role = 'parent') $$;

create view public.child_balances with (security_invoker = true) as
select child_id,
  coalesce(sum(amount) filter (where currency = 'star'), 0)::integer stars,
  coalesce(sum(amount) filter (where currency = 'xp'), 0)::integer xp
from public.point_ledger group by child_id;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.parent_child_links enable row level security;
alter table public.device_tokens enable row level security;
alter table public.quest_templates enable row level security;
alter table public.quest_assignments enable row level security;
alter table public.quest_instances enable row level security;
alter table public.quest_approvals enable row level security;
alter table public.quest_events enable row level security;
alter table public.point_ledger enable row level security;
alter table public.streak_awards enable row level security;
alter table public.rewards enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.reward_redemptions enable row level security;

create policy household_read on public.households for select using (public.is_household_member(id));
create policy profile_self on public.profiles for select using (id = (select auth.uid()) or exists(select 1 from public.parent_child_links l where l.parent_id = (select auth.uid()) and l.child_id = profiles.id));
create policy members_read on public.household_members for select using (public.is_household_member(household_id));
create policy links_read on public.parent_child_links for select using (public.is_household_member(household_id));
create policy tokens_self on public.device_tokens for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy templates_read on public.quest_templates for select using (public.is_household_member(household_id));
create policy templates_parent_write on public.quest_templates for all using (public.is_household_parent(household_id)) with check (public.is_household_parent(household_id));
create policy assignments_read on public.quest_assignments for select using (child_id = (select auth.uid()) or exists(select 1 from public.quest_templates q where q.id = quest_template_id and public.is_household_parent(q.household_id)));
create policy instances_read on public.quest_instances for select using (child_id = (select auth.uid()) or public.is_household_parent(household_id));
create policy approvals_read on public.quest_approvals for select using (exists(select 1 from public.quest_instances q where q.id = quest_instance_id and (q.child_id = (select auth.uid()) or public.is_household_parent(q.household_id))));
create policy events_read on public.quest_events for select using (exists(select 1 from public.quest_instances q where q.id = quest_instance_id and (q.child_id = (select auth.uid()) or public.is_household_parent(q.household_id))));
create policy ledger_read on public.point_ledger for select using (child_id = (select auth.uid()) or public.is_household_parent(household_id));
create policy streak_read on public.streak_awards for select using (child_id = (select auth.uid()) or public.is_household_parent(household_id));
create policy rewards_read on public.rewards for select using (public.is_household_member(household_id));
create policy rewards_parent_write on public.rewards for all using (public.is_household_parent(household_id)) with check (public.is_household_parent(household_id));
create policy goals_read on public.weekly_goals for select using (child_id = (select auth.uid()) or public.is_household_parent(household_id));
create policy redemptions_read on public.reward_redemptions for select using (child_id = (select auth.uid()) or exists(select 1 from public.rewards r where r.id = reward_id and public.is_household_parent(r.household_id)));
