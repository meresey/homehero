-- New managed Heroes inherit every active, age-appropriate household quest.
-- Generate today's instances immediately so first login does not wait for cron.

create or replace function public.finalize_managed_hero(
  p_user_id uuid,
  p_household_id uuid,
  p_created_by uuid,
  p_display_name text,
  p_username text,
  p_date_of_birth date
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  hero_age integer;
  local_start date;
begin
  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 60 then raise exception 'A valid Hero name is required'; end if;
  if p_username is null or p_username !~ '^[a-z][a-z0-9_]{2,19}$' then raise exception 'Invalid Hero username'; end if;
  if p_date_of_birth is null or p_date_of_birth > current_date then raise exception 'A valid birth date is required'; end if;
  hero_age := extract(year from age(current_date, p_date_of_birth))::integer;
  if hero_age not between 3 and 18 then raise exception 'Heroes must be between 3 and 18 years old'; end if;
  if not exists(select 1 from household_members where household_id=p_household_id and user_id=p_created_by and role='parent') then raise exception 'Only a Party Leader can enroll a Hero'; end if;

  select (now() at time zone timezone)::date into local_start from households where id=p_household_id;
  if local_start is null then raise exception 'Household was not found'; end if;

  insert into profiles(id,display_name,date_of_birth)
  values(p_user_id,trim(p_display_name),p_date_of_birth)
  on conflict(id) do update set display_name=excluded.display_name,date_of_birth=excluded.date_of_birth;

  insert into household_members(household_id,user_id,role) values(p_household_id,p_user_id,'child');
  insert into managed_hero_accounts(user_id,household_id,username,created_by) values(p_user_id,p_household_id,p_username,p_created_by);
  insert into parent_child_links(household_id,parent_id,child_id)
  select p_household_id,user_id,p_user_id from household_members where household_id=p_household_id and role='parent' on conflict do nothing;

  insert into quest_assignments(quest_template_id,child_id,starts_on,days_of_week,local_cutoff)
  select
    template.id,
    p_user_id,
    local_start,
    coalesce(existing.days_of_week, case when template.cadence='weekly' then '{1}'::smallint[] when template.cadence='guild' then '{6}'::smallint[] else '{1,2,3,4,5,6,7}'::smallint[] end),
    existing.local_cutoff
  from quest_templates template
  left join lateral (
    select assignment.days_of_week,assignment.local_cutoff
    from quest_assignments assignment
    where assignment.quest_template_id=template.id and assignment.active
    order by assignment.created_at desc
    limit 1
  ) existing on true
  where template.household_id=p_household_id
    and template.is_active
    and (template.minimum_age is null or hero_age >= template.minimum_age)
    and (template.maximum_age is null or hero_age <= template.maximum_age);

  perform public.generate_daily_quest_instances();
end $$;

revoke all on function public.finalize_managed_hero(uuid,uuid,uuid,text,text,date) from public, anon, authenticated;
grant execute on function public.finalize_managed_hero(uuid,uuid,uuid,text,text,date) to service_role;
