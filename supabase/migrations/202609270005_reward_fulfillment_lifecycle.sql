create or replace function public.claim_reward_redemption(p_redemption_id uuid)
returns public.reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare redemption public.reward_redemptions;
begin
  select * into redemption
  from reward_redemptions
  where id=p_redemption_id
  for update;

  if redemption.id is null or redemption.child_id <> auth.uid() then
    raise exception 'Reward not found';
  end if;
  if redemption.status <> 'approved' then
    raise exception 'Only an available reward can be redeemed';
  end if;

  update reward_redemptions
  set status='claimed', claimed_at=now(), fulfilled_at=null, fulfilled_by=null
  where id=redemption.id
  returning * into redemption;
  return redemption;
end $$;

create or replace function public.cancel_reward_claim(p_redemption_id uuid)
returns public.reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare redemption public.reward_redemptions;
begin
  select * into redemption
  from reward_redemptions
  where id=p_redemption_id
  for update;

  if redemption.id is null or redemption.child_id <> auth.uid() then
    raise exception 'Reward not found';
  end if;
  if redemption.status <> 'claimed' then
    raise exception 'Only a reward awaiting fulfillment can be returned to your wallet';
  end if;

  update reward_redemptions
  set status='approved', claimed_at=null
  where id=redemption.id
  returning * into redemption;
  return redemption;
end $$;

create or replace function public.fulfill_reward_redemption(p_redemption_id uuid)
returns public.reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare redemption public.reward_redemptions; reward public.rewards;
begin
  select * into redemption
  from reward_redemptions
  where id=p_redemption_id
  for update;
  if redemption.id is null then raise exception 'Reward claim not found'; end if;

  select * into reward from rewards where id=redemption.reward_id;
  if reward.id is null or not public.is_household_parent(reward.household_id) then
    raise exception 'Only a Party Leader can fulfill this reward';
  end if;
  if redemption.status <> 'claimed' then
    raise exception 'This reward is not awaiting fulfillment';
  end if;

  update reward_redemptions
  set status='fulfilled', fulfilled_at=now(), fulfilled_by=auth.uid()
  where id=redemption.id
  returning * into redemption;
  return redemption;
end $$;

grant execute on function public.claim_reward_redemption(uuid) to authenticated;
grant execute on function public.cancel_reward_claim(uuid) to authenticated;
grant execute on function public.fulfill_reward_redemption(uuid) to authenticated;

-- A reward with an unresolved purchase or delivery request must remain active
-- so the Party Leader can complete the lifecycle safely.
create or replace function public.archive_reward_admin(p_reward_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  select household_id into target_household from rewards where id=p_reward_id;
  if target_household is null or not public.is_household_parent(target_household) then
    raise exception 'Only a Party Leader can retire this reward';
  end if;
  if exists(
    select 1 from reward_redemptions
    where reward_id=p_reward_id and status in ('requested','claimed')
  ) then
    raise exception 'Complete all pending approvals and fulfillment requests before retiring this reward';
  end if;
  update rewards set active=false where id=p_reward_id;
  return true;
end $$;

revoke all on function public.archive_reward_admin(uuid) from public,anon;
grant execute on function public.archive_reward_admin(uuid) to authenticated;

-- Keep approved-reward badge progress stable while an entitlement moves from
-- available to claimed and fulfilled.
create or replace function public.hero_badge_metric(
  p_child_id uuid,
  p_household_id uuid,
  p_metric_key text
)
returns integer
language plpgsql stable security definer set search_path=public
as $$
declare result integer := 0;
begin
  case p_metric_key
    when 'total_quests' then
      select count(*) into result from quest_instances where child_id=p_child_id and household_id=p_household_id and status='rewarded';
    when 'reading_quests' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
        and (lower(qt.title) like '%read%' or qt.icon_key in ('📖','📚'));
    when 'timer_quests' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded' and qt.kind='timer';
    when 'guild_quests' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded' and qt.kind='guild';
    when 'bedtime_on_time' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded' and qt.kind='bedtime'
        and qi.cutoff_at is not null and qi.submitted_at is not null and qi.submitted_at <= qi.cutoff_at;
    when 'weekly_goals' then
      select count(*) into result from weekly_goals wg
      where wg.child_id=p_child_id and wg.household_id=p_household_id and (
        select coalesce(sum(qi.star_reward_snapshot),0) from quest_instances qi
        where qi.child_id=wg.child_id and qi.household_id=wg.household_id and qi.status='rewarded'
          and qi.occurrence_date between wg.week_start and wg.week_start+6
      ) >= wg.target_stars;
    when 'perfect_days' then
      select count(*) into result from (
        select occurrence_date from quest_instances
        where child_id=p_child_id and household_id=p_household_id
        group by occurrence_date having count(*) > 0 and bool_and(status='rewarded')
      ) perfect;
    when 'active_days' then
      select count(distinct occurrence_date) into result from quest_instances
      where child_id=p_child_id and household_id=p_household_id and status='rewarded';
    when 'longest_streak' then
      select coalesce(max(streak_days),0) into result from (
        select count(*)::integer streak_days from (
          select active_date, active_date - row_number() over(order by active_date)::integer streak_group
          from (select distinct occurrence_date active_date from quest_instances
            where child_id=p_child_id and household_id=p_household_id and status='rewarded') dates
        ) grouped_dates group by streak_group
      ) streaks;
    when 'distinct_quests' then
      select count(distinct quest_template_id) into result from quest_instances
      where child_id=p_child_id and household_id=p_household_id and status='rewarded';
    when 'approved_rewards' then
      select count(*) into result from reward_redemptions rr join rewards r on r.id=rr.reward_id
      where rr.child_id=p_child_id and r.household_id=p_household_id
        and rr.status in ('approved','claimed','fulfilled');
    else result := 0;
  end case;
  return coalesce(result,0);
end $$;

revoke all on function public.hero_badge_metric(uuid,uuid,text) from public,anon;
grant execute on function public.hero_badge_metric(uuid,uuid,text) to authenticated;
