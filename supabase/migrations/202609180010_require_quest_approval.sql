-- Make quest rewards approval-first. Completing a quest records the Hero's
-- submission; only a Party Leader review may award stars and XP.

alter table public.households
  add column if not exists require_quest_approval boolean not null default true;

update public.households set require_quest_approval=true;
update public.quest_templates set parent_approval_required=true;

create or replace function public.enforce_household_quest_approval()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists(
    select 1 from households
    where id=new.household_id and require_quest_approval
  ) then
    new.parent_approval_required := true;
  end if;
  return new;
end $$;

drop trigger if exists enforce_household_quest_approval on public.quest_templates;
create trigger enforce_household_quest_approval
before insert or update of household_id,parent_approval_required on public.quest_templates
for each row execute function public.enforce_household_quest_approval();

create or replace function public.complete_quest(p_instance_id uuid)
returns public.quest_instances
language plpgsql security definer set search_path = public
as $$
declare
  q public.quest_instances;
  kind public.quest_kind;
  approval_required boolean;
begin
  select qi.*
    into q
  from quest_instances qi
  where qi.id=p_instance_id
  for update of qi;

  if q.id is null then raise exception 'Quest not found'; end if;
  select qt.kind,qt.parent_approval_required into kind,approval_required
  from quest_templates qt where qt.id=q.quest_template_id;
  if q.child_id <> auth.uid() then raise exception 'Forbidden'; end if;
  if kind in ('guild','timer') then raise exception 'Use the guild or timer command'; end if;
  if q.status <> 'available' then raise exception 'Quest is not available'; end if;
  if now() >= coalesce(q.cutoff_at,q.expires_at) then raise exception 'Quest deadline has passed'; end if;

  if not approval_required then return public.award_quest(q.id); end if;

  update quest_instances
  set status='pending_approval',submitted_at=now(),completed_at=now(),version=version+1
  where id=q.id
  returning * into q;

  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status)
  values(q.id,auth.uid(),'quest_submitted','available','pending_approval');
  return q;
end $$;

create or replace function public.award_quest(p_instance_id uuid)
returns public.quest_instances
language plpgsql security definer set search_path = public
as $$
declare q public.quest_instances; kind public.quest_kind; old_status public.quest_status;
begin
  select * into q from quest_instances where id=p_instance_id for update;
  if q.id is null then raise exception 'Quest not found'; end if;
  select qt.kind into kind from quest_templates qt where qt.id=q.quest_template_id;
  if q.rewarded_at is not null then return q; end if;
  if q.status <> 'pending_approval' and now() >= coalesce(q.cutoff_at,q.expires_at) then raise exception 'Quest deadline has passed'; end if;
  if kind='timer' and (q.timer_expected_end_at is null or now() < q.timer_expected_end_at) then raise exception 'Timer is still running'; end if;
  if q.status <> 'pending_approval' then raise exception 'Quest needs Party Leader approval'; end if;

  old_status := q.status;
  update quest_instances
  set status='rewarded',completed_at=coalesce(completed_at,now()),rewarded_at=now(),version=version+1
  where id=q.id returning * into q;

  insert into point_ledger(household_id,child_id,currency,amount,reason,quest_instance_id,reference_key)
  values (q.household_id,q.child_id,'star',q.star_reward_snapshot,'quest_reward',q.id,'quest:'||q.id),
         (q.household_id,q.child_id,'xp',q.xp_reward_snapshot,'quest_reward',q.id,'quest:'||q.id)
  on conflict (child_id,currency,reference_key) do nothing;

  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status)
  values(q.id,auth.uid(),'quest_rewarded',old_status,'rewarded');
  return q;
end $$;

create or replace function public.review_quest(p_instance_id uuid,p_approve boolean,p_note text default null)
returns public.quest_instances
language plpgsql security definer set search_path = public
as $$
declare q public.quest_instances; kind public.quest_kind;
begin
  select * into q from quest_instances where id=p_instance_id for update;
  if q.id is null or not public.is_household_parent(q.household_id) then raise exception 'Forbidden'; end if;
  select qt.kind into kind from quest_templates qt where qt.id=q.quest_template_id;
  if q.status <> 'pending_approval' then raise exception 'Quest is not awaiting approval'; end if;
  if p_approve and kind='timer' and (q.submitted_at is null or q.timer_expected_end_at is null or now() < q.timer_expected_end_at) then raise exception 'Timer has not completed'; end if;

  insert into quest_approvals(quest_instance_id,reviewer_id,decision,note)
  values(q.id,auth.uid(),case when p_approve then 'approved' else 'rejected' end,p_note)
  on conflict (quest_instance_id) do update set
    reviewer_id=excluded.reviewer_id,
    decision=excluded.decision,
    note=excluded.note,
    created_at=now();

  if p_approve then return public.award_quest(q.id); end if;

  update quest_instances
  set status='available',started_at=null,timer_started_at=null,timer_expected_end_at=null,
      submitted_at=null,completed_at=null,expired_at=null,version=version+1
  where id=q.id returning * into q;

  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status)
  values(q.id,auth.uid(),case when kind='timer' then 'timer_retry_requested' else 'quest_retry_requested' end,'pending_approval','available');
  return q;
end $$;

create or replace function public.review_guild_quest(p_instance_id uuid,p_approve boolean,p_note text default null)
returns public.quest_instances
language plpgsql security definer set search_path = public
as $$
begin
  return public.review_quest(p_instance_id,p_approve,p_note);
end $$;

grant execute on function public.complete_quest(uuid), public.review_quest(uuid,boolean,text), public.review_guild_quest(uuid,boolean,text) to authenticated;
