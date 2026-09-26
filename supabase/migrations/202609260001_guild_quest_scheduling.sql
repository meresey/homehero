-- Guild Quests can be completed once on a chosen weekday or once at any time
-- during the household week. For assignments, all seven ISO weekdays is the
-- durable representation of "any day this week"; a single value represents a
-- specific weekday.

-- Correct Guild assignments created by the previous UI, which always sent all
-- seven days even when the visible label named a specific weekday.
update public.quest_assignments assignment
set days_of_week = array[
  case lower(trim(template.schedule_label))
    when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3
    when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6
    when 'sunday' then 7
  end
]::smallint[]
from public.quest_templates template
where template.id=assignment.quest_template_id
  and template.kind='guild'
  and lower(trim(template.schedule_label)) in (
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
  );

-- New households should receive the ready-made co-op quest with the more
-- flexible weekly schedule.
update public.quest_catalog
set schedule_label='Any day this week'
where slug='dinner' and kind='guild';

-- Guild Quests use submission approval, not a focus countdown. Remove stale
-- timer values accepted by the previous form and prevent older clients from
-- writing new ones through the atomic save endpoint.
update public.quest_templates set timer_seconds=null where kind='guild';
update public.quest_catalog set timer_seconds=null where kind='guild';

create or replace function public.save_quest_admin(
  p_household_id uuid,
  p_child_ids uuid[],
  p_template_id uuid,
  p_title text,
  p_description text,
  p_icon_key text,
  p_cadence text,
  p_star_reward integer,
  p_xp_reward integer,
  p_timer_seconds integer,
  p_days_of_week smallint[],
  p_local_cutoff time,
  p_schedule_label text,
  p_minimum_age integer,
  p_maximum_age integer,
  p_catalog_quest_id uuid
)
returns public.quest_templates
language plpgsql security definer set search_path = public
as $$
declare
  saved public.quest_templates;
  previous_days smallint[];
begin
  if p_cadence='guild' and cardinality(p_days_of_week) not in (1,7) then
    raise exception 'A Guild Quest must use one weekday or any day this week';
  end if;
  if p_template_id is not null then
    select assignment.days_of_week into previous_days
    from public.quest_assignments assignment
    where assignment.quest_template_id=p_template_id and assignment.active
    order by assignment.created_at desc limit 1;
  end if;
  select * into saved from public.upsert_quest_admin(
    p_household_id,null,p_template_id,p_title,p_description,p_icon_key,p_cadence,
    p_star_reward,p_xp_reward,
    case when p_cadence='guild' then null else p_timer_seconds end,
    p_days_of_week,p_local_cutoff,p_schedule_label,
    p_minimum_age,p_maximum_age,p_catalog_quest_id
  );
  perform public.set_quest_assignments(
    saved.id,coalesce(p_child_ids,'{}'::uuid[]),p_days_of_week,p_local_cutoff
  );
  if previous_days is not null and previous_days is distinct from p_days_of_week then
    with expired as (
      update public.quest_instances
      set status='expired',expired_at=now(),version=version+1
      where quest_template_id=saved.id and status in ('available','in_progress')
      returning id
    )
    insert into public.quest_events(quest_instance_id,event_type,new_status,metadata)
    select id,'quest_expired','expired',jsonb_build_object('source','schedule_change') from expired;
  end if;
  perform public.generate_daily_quest_instances();
  return saved;
end $$;

revoke all on function public.save_quest_admin(
  uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid
) from public,anon;
grant execute on function public.save_quest_admin(
  uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid
) to authenticated;

create or replace function public.generate_daily_quest_instances()
returns integer language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  with base as (
    select
      qa.id assignment_id, qt.id quest_template_id, qt.household_id, qa.child_id,
      (now() at time zone h.timezone)::date local_today,
      date_trunc('week',now() at time zone h.timezone)::date week_start,
      h.timezone, qa.starts_on, qa.ends_on, qa.days_of_week, qa.local_cutoff,
      qt.kind, qt.star_reward, qt.xp_reward,
      (qt.kind='guild' and cardinality(qa.days_of_week)=7) any_week_guild
    from quest_assignments qa
    join quest_templates qt on qt.id=qa.quest_template_id
    join households h on h.id=qt.household_id
    join profiles p on p.id=qa.child_id
    where qa.active and qt.is_active
      and (now() at time zone h.timezone)::date >= qa.starts_on
      and (qa.ends_on is null or (now() at time zone h.timezone)::date <= qa.ends_on)
      and (p.date_of_birth is null or qt.minimum_age is null or extract(year from age((now() at time zone h.timezone)::date,p.date_of_birth)) >= qt.minimum_age)
      and (p.date_of_birth is null or qt.maximum_age is null or extract(year from age((now() at time zone h.timezone)::date,p.date_of_birth)) <= qt.maximum_age)
  ), candidates as (
    select
      assignment_id,quest_template_id,household_id,child_id,timezone,
      case when any_week_guild then greatest(week_start,starts_on) else local_today end occurrence_date,
      case when any_week_guild then null else local_cutoff end local_cutoff,
      case when any_week_guild then least(week_start+7,coalesce(ends_on+1,week_start+7)) else local_today+1 end expiry_date,
      star_reward,xp_reward
    from base
    where any_week_guild
       or extract(isodow from local_today)::smallint=any(days_of_week)
  ), inserted as (
    insert into quest_instances(
      assignment_id,quest_template_id,household_id,child_id,occurrence_date,
      available_at,cutoff_at,expires_at,star_reward_snapshot,xp_reward_snapshot
    )
    select assignment_id,quest_template_id,household_id,child_id,occurrence_date,
      occurrence_date::timestamp at time zone timezone,
      case when local_cutoff is null then null else (occurrence_date+local_cutoff)::timestamp at time zone timezone end,
      expiry_date::timestamp at time zone timezone,
      star_reward,xp_reward
    from candidates
    on conflict(assignment_id,occurrence_date) do nothing
    returning 1
  ) select count(*) into affected from inserted;
  return affected;
end $$;

revoke all on function public.generate_daily_quest_instances() from public,anon,authenticated;

-- New Heroes inherit the structured schedule used by existing assignments. If
-- a Guild Quest has never been assigned, default it to once per week.
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
      template.id,p_child_id,local_start,
      coalesce(existing.days_of_week,case when template.cadence='weekly' then '{1}'::smallint[] else '{1,2,3,4,5,6,7}'::smallint[] end),
      existing.local_cutoff
    from quest_templates template
    left join lateral (
      select assignment.days_of_week,assignment.local_cutoff
      from quest_assignments assignment
      where assignment.quest_template_id=template.id and assignment.active
      order by assignment.created_at desc limit 1
    ) existing on true
    where template.household_id=target_household and template.is_active
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

revoke all on function public.sync_hero_quest_assignments(uuid) from public,anon,authenticated;

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
  hero_age := extract(year from age(current_date,p_date_of_birth))::integer;
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
    template.id,p_user_id,local_start,
    coalesce(existing.days_of_week,case when template.cadence='weekly' then '{1}'::smallint[] else '{1,2,3,4,5,6,7}'::smallint[] end),
    existing.local_cutoff
  from quest_templates template
  left join lateral (
    select assignment.days_of_week,assignment.local_cutoff
    from quest_assignments assignment
    where assignment.quest_template_id=template.id and assignment.active
    order by assignment.created_at desc limit 1
  ) existing on true
  where template.household_id=p_household_id and template.is_active
    and (template.minimum_age is null or hero_age >= template.minimum_age)
    and (template.maximum_age is null or hero_age <= template.maximum_age);

  perform public.generate_daily_quest_instances();
end $$;

revoke all on function public.finalize_managed_hero(uuid,uuid,uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.finalize_managed_hero(uuid,uuid,uuid,text,text,date) to service_role;

-- Generate the current week's flexible Guild instances immediately rather than
-- waiting for the next cron run.
select public.generate_daily_quest_instances();
