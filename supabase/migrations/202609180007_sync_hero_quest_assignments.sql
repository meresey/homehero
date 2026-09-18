-- Repair managed Heroes enrolled before automatic assignment existed and keep
-- future household quests in sync when a Hero opens the app.

create or replace function public.sync_hero_quest_assignments(p_child_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  target_household uuid;
  target_timezone text;
  hero_age integer;
  local_start date;
  inserted_count integer;
begin
  select hm.household_id,h.timezone
  into target_household,target_timezone
  from household_members hm
  join households h on h.id=hm.household_id
  where hm.user_id=p_child_id and hm.role='child';
  if target_household is null then raise exception 'Hero household was not found'; end if;

  select extract(year from age((now() at time zone target_timezone)::date,date_of_birth))::integer
  into hero_age from profiles where id=p_child_id;
  local_start := (now() at time zone target_timezone)::date;

  with inserted as (
    insert into quest_assignments(quest_template_id,child_id,starts_on,days_of_week,local_cutoff)
    select
      template.id,
      p_child_id,
      local_start,
      coalesce(existing.days_of_week,case when template.cadence='weekly' then '{1}'::smallint[] when template.cadence='guild' then '{6}'::smallint[] else '{1,2,3,4,5,6,7}'::smallint[] end),
      existing.local_cutoff
    from quest_templates template
    left join lateral (
      select assignment.days_of_week,assignment.local_cutoff
      from quest_assignments assignment
      where assignment.quest_template_id=template.id and assignment.active
      order by assignment.created_at desc
      limit 1
    ) existing on true
    where template.household_id=target_household
      and template.is_active
      and (hero_age is null or template.minimum_age is null or hero_age >= template.minimum_age)
      and (hero_age is null or template.maximum_age is null or hero_age <= template.maximum_age)
      and not exists(
        select 1 from quest_assignments prior
        where prior.quest_template_id=template.id and prior.child_id=p_child_id
      )
    returning 1
  ) select count(*) into inserted_count from inserted;

  perform public.generate_daily_quest_instances();
  return inserted_count;
end $$;

revoke all on function public.sync_hero_quest_assignments(uuid) from public, anon, authenticated;

create or replace function public.sync_my_quest_assignments()
returns integer
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from household_members where user_id=auth.uid() and role='child') then raise exception 'Hero account required'; end if;
  return public.sync_hero_quest_assignments(auth.uid());
end $$;

revoke all on function public.sync_my_quest_assignments() from public, anon;
grant execute on function public.sync_my_quest_assignments() to authenticated;

do $$
declare managed record;
begin
  for managed in select user_id from managed_hero_accounts loop
    perform public.sync_hero_quest_assignments(managed.user_id);
  end loop;
end $$;
