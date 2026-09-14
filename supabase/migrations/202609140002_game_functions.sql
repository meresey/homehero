create or replace function public.award_quest(p_instance_id uuid)
returns public.quest_instances
language plpgsql security definer set search_path = public
as $$
declare q public.quest_instances; kind public.quest_kind; old_status public.quest_status;
begin
  select qi, qt.kind into q, kind
  from quest_instances qi join quest_templates qt on qt.id = qi.quest_template_id
  where qi.id = p_instance_id for update of qi;
  if q.id is null then raise exception 'Quest not found'; end if;
  if q.rewarded_at is not null then return q; end if;
  if now() >= coalesce(q.cutoff_at, q.expires_at) then raise exception 'Quest deadline has passed'; end if;
  if kind = 'timer' and (q.timer_expected_end_at is null or now() < q.timer_expected_end_at) then raise exception 'Timer is still running'; end if;
  if kind = 'guild' and q.status <> 'pending_approval' then raise exception 'Guild quest needs approval'; end if;

  old_status := q.status;
  update quest_instances set status = 'rewarded', completed_at = coalesce(completed_at, now()), rewarded_at = now(), version = version + 1 where id = q.id returning * into q;
  insert into point_ledger(household_id, child_id, currency, amount, reason, quest_instance_id, reference_key)
  values (q.household_id, q.child_id, 'star', q.star_reward_snapshot, 'quest_reward', q.id, 'quest:'||q.id),
         (q.household_id, q.child_id, 'xp', q.xp_reward_snapshot, 'quest_reward', q.id, 'quest:'||q.id)
  on conflict (child_id, currency, reference_key) do nothing;
  insert into quest_events(quest_instance_id, actor_id, event_type, previous_status, new_status)
  values(q.id, auth.uid(), 'quest_rewarded', old_status, 'rewarded');
  return q;
end $$;

create or replace function public.complete_quest(p_instance_id uuid)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances; kind public.quest_kind;
begin
  select qi, qt.kind into q, kind from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id where qi.id=p_instance_id;
  if q.child_id <> auth.uid() then raise exception 'Forbidden'; end if;
  if kind in ('guild','timer') then raise exception 'Use the guild or timer command'; end if;
  return public.award_quest(p_instance_id);
end $$;

create or replace function public.start_timer(p_instance_id uuid)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances; seconds integer;
begin
  select qi, qt.timer_seconds into q, seconds from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id where qi.id=p_instance_id for update of qi;
  if q.child_id <> auth.uid() or seconds is null then raise exception 'Forbidden or not a timer quest'; end if;
  if now() >= coalesce(q.cutoff_at,q.expires_at) then raise exception 'Quest deadline has passed'; end if;
  if q.status = 'available' then
    update quest_instances set status='in_progress', started_at=now(), timer_started_at=now(), timer_expected_end_at=now()+make_interval(secs=>seconds), version=version+1 where id=q.id returning * into q;
  end if;
  return q;
end $$;

create or replace function public.finish_timer(p_instance_id uuid)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances;
begin
  select * into q from quest_instances where id=p_instance_id;
  if q.child_id <> auth.uid() then raise exception 'Forbidden'; end if;
  return public.award_quest(p_instance_id);
end $$;

create or replace function public.submit_guild_quest(p_instance_id uuid)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances; kind public.quest_kind;
begin
  select qi, qt.kind into q, kind from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id where qi.id=p_instance_id for update of qi;
  if q.child_id <> auth.uid() or kind <> 'guild' then raise exception 'Forbidden or not a guild quest'; end if;
  if now() >= coalesce(q.cutoff_at,q.expires_at) then raise exception 'Quest deadline has passed'; end if;
  update quest_instances set status='pending_approval', submitted_at=now(), version=version+1 where id=q.id and status='available' returning * into q;
  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status) values(q.id,auth.uid(),'guild_submitted','available','pending_approval');
  return q;
end $$;

create or replace function public.review_guild_quest(p_instance_id uuid, p_approve boolean, p_note text default null)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances;
begin
  select * into q from quest_instances where id=p_instance_id for update;
  if q.id is null or not public.is_household_parent(q.household_id) then raise exception 'Forbidden'; end if;
  if q.status <> 'pending_approval' then raise exception 'Quest is not awaiting approval'; end if;
  insert into quest_approvals(quest_instance_id,reviewer_id,decision,note) values(q.id,auth.uid(),case when p_approve then 'approved' else 'rejected' end,p_note);
  if p_approve then return public.award_quest(q.id); end if;
  update quest_instances set status='rejected',version=version+1 where id=q.id returning * into q;
  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status) values(q.id,auth.uid(),'guild_rejected','pending_approval','rejected');
  return q;
end $$;

create or replace function public.redeem_reward(p_reward_id uuid, p_idempotency_key text)
returns public.reward_redemptions language plpgsql security definer set search_path = public
as $$ declare r public.rewards; result public.reward_redemptions; balance integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into r from rewards where id=p_reward_id and active for update;
  if r.id is null or not public.is_household_member(r.household_id) or coalesce(r.inventory, 1) <= 0 then raise exception 'Reward unavailable'; end if;
  select coalesce(sum(amount),0) into balance from point_ledger where child_id=auth.uid() and currency='star';
  if balance < r.star_cost then raise exception 'Not enough stars'; end if;
  insert into reward_redemptions(reward_id,child_id,star_cost_snapshot,status,idempotency_key)
  values(r.id,auth.uid(),r.star_cost,case when r.requires_parent_approval then 'requested' else 'approved' end,p_idempotency_key)
  on conflict(child_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into result;
  insert into point_ledger(household_id,child_id,currency,amount,reason,reference_key,metadata)
  values(r.household_id,auth.uid(),'star',-r.star_cost,'redemption','redemption:'||result.id,jsonb_build_object('reward_id',r.id)) on conflict do nothing;
  if r.inventory is not null then update rewards set inventory=inventory-1 where id=r.id and inventory>0; end if;
  return result;
end $$;

create or replace function public.generate_daily_quest_instances()
returns integer language plpgsql security definer set search_path = public
as $$ declare affected integer;
begin
  with candidates as (
    select
      qa.id assignment_id, qt.id quest_template_id, qt.household_id, qa.child_id,
      (now() at time zone h.timezone)::date local_day,
      h.timezone, qa.local_cutoff, qt.star_reward, qt.xp_reward
    from quest_assignments qa
    join quest_templates qt on qt.id=qa.quest_template_id
    join households h on h.id=qt.household_id
    where qa.active and qt.is_active
      and (now() at time zone h.timezone)::date >= qa.starts_on
      and (qa.ends_on is null or (now() at time zone h.timezone)::date <= qa.ends_on)
      and extract(isodow from (now() at time zone h.timezone)::date)::smallint = any(qa.days_of_week)
  ), inserted as (
    insert into quest_instances(
      assignment_id,quest_template_id,household_id,child_id,occurrence_date,
      available_at,cutoff_at,expires_at,star_reward_snapshot,xp_reward_snapshot
    )
    select assignment_id,quest_template_id,household_id,child_id,local_day,
      local_day::timestamp at time zone timezone,
      case when local_cutoff is null then null else (local_day+local_cutoff)::timestamp at time zone timezone end,
      (local_day+1)::timestamp at time zone timezone,
      star_reward,xp_reward
    from candidates
    on conflict(assignment_id,occurrence_date) do nothing
    returning 1
  ) select count(*) into affected from inserted;
  return affected;
end $$;

create or replace function public.expire_overdue_quests()
returns integer language plpgsql security definer set search_path = public
as $$ declare affected integer;
begin
  with expired as (
    update quest_instances set status='expired',expired_at=now(),version=version+1
    where status in ('available','in_progress') and now() >= coalesce(cutoff_at,expires_at)
    returning id
  ), events as (
    insert into quest_events(quest_instance_id,event_type,new_status,metadata)
    select id,'quest_expired','expired',jsonb_build_object('source','cron') from expired returning 1
  ) select count(*) into affected from events;
  return affected;
end $$;

create or replace function public.award_weekly_streaks(p_week_start date)
returns integer language plpgsql security definer set search_path = public
as $$ declare affected integer;
begin
  with eligible as (
    select qi.household_id, qi.child_id, qi.assignment_id
    from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
    where qi.occurrence_date between p_week_start and p_week_start+6 and qt.kind in ('daily','timer','bedtime') and qi.status='rewarded'
    group by qi.household_id,qi.child_id,qi.assignment_id having count(distinct qi.occurrence_date)=7
  ), awards as (
    insert into streak_awards(household_id,child_id,assignment_id,week_start,xp_awarded)
    select household_id,child_id,assignment_id,p_week_start,5 from eligible on conflict do nothing returning *
  ), ledger as (
    insert into point_ledger(household_id,child_id,currency,amount,reason,reference_key,metadata)
    select household_id,child_id,'xp',xp_awarded,'streak_bonus','streak:'||assignment_id||':'||week_start,jsonb_build_object('week_start',week_start) from awards
    on conflict do nothing returning 1
  ) select count(*) into affected from ledger;
  return affected;
end $$;

revoke all on function public.award_quest(uuid) from public, anon, authenticated;
grant execute on function public.complete_quest(uuid), public.start_timer(uuid), public.finish_timer(uuid), public.submit_guild_quest(uuid), public.review_guild_quest(uuid,boolean,text), public.redeem_reward(uuid,text) to authenticated;
revoke all on function public.expire_overdue_quests(), public.generate_daily_quest_instances(), public.award_weekly_streaks(date) from public, anon, authenticated;

-- Enable pg_cron in the Supabase dashboard, then schedule:
-- select cron.schedule('generate-quest-instances','*/15 * * * *',$$select public.generate_daily_quest_instances();$$);
-- select cron.schedule('expire-overdue-quests','*/5 * * * *',$$select public.expire_overdue_quests();$$);
-- select cron.schedule('weekly-streaks','15 0 * * 1',$$select public.award_weekly_streaks((current_date - 7)::date);$$);
