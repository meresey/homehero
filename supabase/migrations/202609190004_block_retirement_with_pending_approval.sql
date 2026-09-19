-- Content with outstanding Party Leader decisions must remain active until every
-- pending quest completion or reward request has been reviewed.

create or replace function public.archive_quest_admin(p_template_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  select household_id into target_household from quest_templates where id=p_template_id;
  if target_household is null or not public.is_household_parent(target_household) then
    raise exception 'Only a Party Leader can retire this quest';
  end if;
  if exists(
    select 1 from quest_instances
    where quest_template_id=p_template_id and status='pending_approval'
  ) then
    raise exception 'Review all pending completions before retiring this quest';
  end if;
  update quest_templates set is_active=false,archived_at=now() where id=p_template_id;
  update quest_assignments set active=false,ends_on=coalesce(ends_on,current_date) where quest_template_id=p_template_id;
  return true;
end $$;

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
    where reward_id=p_reward_id and status='requested'
  ) then
    raise exception 'Review all pending requests before retiring this reward';
  end if;
  update rewards set active=false where id=p_reward_id;
  return true;
end $$;

revoke all on function public.archive_quest_admin(uuid) from public,anon;
revoke all on function public.archive_reward_admin(uuid) from public,anon;
grant execute on function public.archive_quest_admin(uuid) to authenticated;
grant execute on function public.archive_reward_admin(uuid) to authenticated;
