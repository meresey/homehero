-- Expand the platform-owned badge catalogue. Household members retain read-only
-- access; achievement evaluation and awards remain server controlled.

insert into public.badge_definitions(key,name,description,icon_key,sort_order)
values
  ('first-step','First Step','Complete your first quest.','🌱',50),
  ('reliable-hero','Reliable Hero','Complete 10 quests.','🛡️',60),
  ('quest-champion','Quest Champion','Complete 50 quests.','🏆',70),
  ('timer-tamer','Timer Tamer','Complete five timer-based quests.','⏱️',80),
  ('helping-hand','Helping Hand','Complete five approved Guild Quests.','🤝',90),
  ('safe-zone-sentinel','Safe Zone Sentinel','Complete five bedtime quests before their cutoff.','🌙',100),
  ('goal-getter','Goal Getter','Reach a weekly star goal.','🎯',110),
  ('seven-day-hero','Seven-Day Hero','Complete at least one quest every day for seven days.','🔄',120),
  ('quest-explorer','Quest Explorer','Complete five different quests.','🧭',130),
  ('first-reward','First Reward','Have your first Star Store request approved.','🎁',140)
on conflict (key) do update set
  name=excluded.name,
  description=excluded.description,
  icon_key=excluded.icon_key,
  sort_order=excluded.sort_order,
  active=true;

create or replace function public.evaluate_additional_hero_badges(p_child_id uuid, p_household_id uuid)
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

  select qi.id into source_id
  from quest_instances qi
  where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
  order by qi.rewarded_at,qi.id limit 1;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'first-step',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi
  where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
  having count(*) >= 10;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'reliable-hero',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi
  where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
  having count(*) >= 50;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'quest-champion',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
  where qi.child_id=p_child_id and qi.household_id=p_household_id
    and qi.status='rewarded' and qt.kind='timer'
  having count(*) >= 5;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'timer-tamer',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
  where qi.child_id=p_child_id and qi.household_id=p_household_id
    and qi.status='rewarded' and qt.kind='guild'
  having count(*) >= 5;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'helping-hand',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
  where qi.child_id=p_child_id and qi.household_id=p_household_id
    and qi.status='rewarded' and qt.kind='bedtime' and qi.cutoff_at is not null
    and qi.rewarded_at <= qi.cutoff_at
  having count(*) >= 5;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'safe-zone-sentinel',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from weekly_goals wg
  join quest_instances qi on qi.child_id=wg.child_id and qi.household_id=wg.household_id
    and qi.occurrence_date between wg.week_start and wg.week_start+6
  where wg.child_id=p_child_id and wg.household_id=p_household_id
  group by wg.id,wg.week_start,wg.target_stars
  having coalesce(sum(qi.star_reward_snapshot) filter (where qi.status='rewarded'),0) >= wg.target_stars
  order by max(wg.week_start) desc limit 1;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'goal-getter',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select latest.id into source_id
  from quest_instances latest
  where latest.child_id=p_child_id and latest.household_id=p_household_id and latest.status='rewarded'
    and (
      select count(distinct prior.occurrence_date)
      from quest_instances prior
      where prior.child_id=p_child_id and prior.household_id=p_household_id and prior.status='rewarded'
        and prior.occurrence_date between latest.occurrence_date-6 and latest.occurrence_date
    )=7
  order by latest.occurrence_date desc,latest.rewarded_at desc nulls last limit 1;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'seven-day-hero',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  select max(qi.id::text)::uuid into source_id
  from quest_instances qi
  where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
  having count(distinct qi.quest_template_id) >= 5;
  if source_id is not null then
    insert into hero_badges(household_id,child_id,badge_key,source_instance_id)
    values(p_household_id,p_child_id,'quest-explorer',source_id) on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  if exists(
    select 1 from reward_redemptions rr join rewards r on r.id=rr.reward_id
    where rr.child_id=p_child_id and r.household_id=p_household_id and rr.status in ('approved','fulfilled')
  ) then
    insert into hero_badges(household_id,child_id,badge_key)
    values(p_household_id,p_child_id,'first-reward') on conflict do nothing;
    get diagnostics inserted = row_count; awarded := awarded + inserted;
  end if;

  return awarded;
end $$;

revoke all on function public.evaluate_additional_hero_badges(uuid,uuid) from public, anon, authenticated;

create or replace function public.evaluate_badges_after_quest_reward()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status='rewarded' and old.status is distinct from 'rewarded' then
    perform public.evaluate_hero_badges(new.child_id,new.household_id);
    perform public.evaluate_additional_hero_badges(new.child_id,new.household_id);
  end if;
  return new;
end $$;

create or replace function public.evaluate_badges_after_reward_approval()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  if new.status in ('approved','fulfilled') and old.status is distinct from new.status then
    select household_id into target_household from rewards where id=new.reward_id;
    if target_household is not null then
      perform public.evaluate_additional_hero_badges(new.child_id,target_household);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reward_approval_badges on public.reward_redemptions;
create trigger reward_approval_badges
after update of status on public.reward_redemptions
for each row execute function public.evaluate_badges_after_reward_approval();

do $$
declare hero record;
begin
  for hero in
    select household_id,user_id child_id from household_members where role='child'
  loop
    perform public.evaluate_additional_hero_badges(hero.child_id,hero.household_id);
  end loop;
end $$;
