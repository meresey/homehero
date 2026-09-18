-- Database-backed Hero achievements. New Heroes begin with no badges; badges
-- are awarded only when rewarded quest history satisfies an achievement rule.

create table if not exists public.badge_definitions (
  key text primary key,
  name text not null check (char_length(name) between 1 and 60),
  description text not null,
  icon_key text not null,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hero_badges (
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null references public.badge_definitions(key),
  earned_at timestamptz not null default now(),
  source_instance_id uuid references public.quest_instances(id) on delete set null,
  primary key (child_id, badge_key)
);

create index if not exists hero_badges_household_child
  on public.hero_badges(household_id, child_id, earned_at);

insert into public.badge_definitions(key,name,description,icon_key,sort_order)
values
  ('on-fire','On Fire','Complete quests on three consecutive days.','🔥',10),
  ('team-player','Team Player','Complete a Guild Quest approved by a Party Leader.','🤝',20),
  ('bookworm','Bookworm','Complete five reading quests.','📚',30),
  ('perfect-day','Perfect Day','Complete every scheduled quest on the same day.','🌟',40)
on conflict (key) do update set
  name=excluded.name,
  description=excluded.description,
  icon_key=excluded.icon_key,
  sort_order=excluded.sort_order,
  active=true;

alter table public.badge_definitions enable row level security;
alter table public.hero_badges enable row level security;

drop policy if exists badge_definitions_read on public.badge_definitions;
create policy badge_definitions_read on public.badge_definitions
  for select to authenticated using (active);

drop policy if exists hero_badges_read on public.hero_badges;
create policy hero_badges_read on public.hero_badges
  for select to authenticated using (
    child_id=(select auth.uid()) or public.is_household_parent(household_id)
  );

grant select on public.badge_definitions, public.hero_badges to authenticated;

create or replace function public.evaluate_hero_badges(p_child_id uuid, p_household_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  awarded integer := 0;
  inserted integer := 0;
  source_id uuid;
begin
  if not exists(
    select 1 from household_members
    where household_id=p_household_id and user_id=p_child_id and role='child'
  ) then raise exception 'Hero is not in this household'; end if;

  select latest.id into source_id
  from quest_instances latest
  where latest.child_id=p_child_id and latest.household_id=p_household_id and latest.status='rewarded'
    and exists(
      select 1 from quest_instances prior
      where prior.child_id=p_child_id and prior.household_id=p_household_id and prior.status='rewarded'
        and prior.occurrence_date=latest.occurrence_date-1
    )
    and exists(
      select 1 from quest_instances prior
      where prior.child_id=p_child_id and prior.household_id=p_household_id and prior.status='rewarded'
        and prior.occurrence_date=latest.occurrence_date-2
    )
  order by latest.occurrence_date desc, latest.rewarded_at desc nulls last
  limit 1;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'on-fire',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select qi.id into source_id
  from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
  where qi.child_id=p_child_id and qi.household_id=p_household_id
    and qi.status='rewarded' and qt.kind='guild'
  order by qi.rewarded_at desc nulls last limit 1;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'team-player',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
  where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
    and (lower(qt.title) like '%read%' or qt.icon_key in ('📖','📚'))
  having count(*) >= 5;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'bookworm',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi
  where qi.child_id=p_child_id and qi.household_id=p_household_id
  group by qi.occurrence_date
  having count(*) > 0 and count(*) filter (where qi.status <> 'rewarded') = 0
  order by max(qi.occurrence_date) desc limit 1;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'perfect-day',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  return awarded;
end $$;

revoke all on function public.evaluate_hero_badges(uuid,uuid) from public, anon, authenticated;

create or replace function public.evaluate_badges_after_quest_reward()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status='rewarded' and old.status is distinct from 'rewarded' then
    perform public.evaluate_hero_badges(new.child_id,new.household_id);
  end if;
  return new;
end $$;

drop trigger if exists quest_reward_badges on public.quest_instances;
create trigger quest_reward_badges
after update of status on public.quest_instances
for each row execute function public.evaluate_badges_after_quest_reward();

do $$
declare hero record;
begin
  for hero in
    select distinct child_id,household_id from quest_instances where status='rewarded'
  loop
    perform public.evaluate_hero_badges(hero.child_id,hero.household_id);
  end loop;
end $$;
