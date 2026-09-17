create or replace function public.finish_timer(p_instance_id uuid)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances; kind public.quest_kind;
begin
  select * into q from quest_instances where id=p_instance_id for update;
  select qt.kind into kind from quest_templates qt where qt.id=q.quest_template_id;
  if q.child_id <> auth.uid() or kind <> 'timer' then raise exception 'Forbidden or not a timer quest'; end if;
  if q.status <> 'in_progress' then raise exception 'Timer quest is not in progress'; end if;
  if q.timer_expected_end_at is null or now() < q.timer_expected_end_at then raise exception 'Timer is still running'; end if;
  update quest_instances set status='pending_approval',submitted_at=now(),version=version+1 where id=q.id returning * into q;
  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status) values(q.id,auth.uid(),'timer_submitted','in_progress','pending_approval');
  return q;
end $$;

create or replace function public.review_guild_quest(p_instance_id uuid, p_approve boolean, p_note text default null)
returns public.quest_instances language plpgsql security definer set search_path = public
as $$ declare q public.quest_instances; kind public.quest_kind;
begin
  select * into q from quest_instances where id=p_instance_id for update;
  select qt.kind into kind from quest_templates qt where qt.id=q.quest_template_id;
  if q.id is null or not public.is_household_parent(q.household_id) then raise exception 'Forbidden'; end if;
  if q.status <> 'pending_approval' then raise exception 'Quest is not awaiting approval'; end if;
  if p_approve and kind='timer' and (q.submitted_at is null or q.timer_expected_end_at is null or now() < q.timer_expected_end_at) then raise exception 'Timer has not completed'; end if;
  insert into quest_approvals(quest_instance_id,reviewer_id,decision,note) values(q.id,auth.uid(),case when p_approve then 'approved' else 'rejected' end,p_note);
  if p_approve then return public.award_quest(q.id); end if;
  update quest_instances set status='available',started_at=null,timer_started_at=null,timer_expected_end_at=null,submitted_at=null,version=version+1 where id=q.id returning * into q;
  insert into quest_events(quest_instance_id,actor_id,event_type,previous_status,new_status) values(q.id,auth.uid(),case when kind='timer' then 'timer_retry_requested' else 'guild_retry_requested' end,'pending_approval','available');
  return q;
end $$;

grant execute on function public.finish_timer(uuid), public.review_guild_quest(uuid,boolean,text) to authenticated;
