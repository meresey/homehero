alter table public.quest_catalog
  add column school_schedule text not null default 'year_round'
  check (school_schedule in ('year_round', 'term_weekdays'));

alter table public.quest_templates
  add column school_schedule text not null default 'year_round'
  check (school_schedule in ('year_round', 'term_weekdays'));

update public.quest_catalog set school_schedule = 'term_weekdays' where slug = 'homework';
update public.quest_templates template set school_schedule = 'term_weekdays'
from public.quest_catalog catalog
where catalog.id = template.catalog_quest_id and catalog.slug = 'homework';

-- Keep these inclusive term intervals aligned with src/schoolCalendar.ts.
-- Outside published calendar years, keep weekday access so quests don't
-- disappear while the next calendar is being prepared.
create function public.is_kenya_term_weekday(p_day date)
returns boolean language sql immutable set search_path = ''
as $$
  select extract(isodow from p_day) between 1 and 5
    and case extract(year from p_day)
      when 2026 then p_day between '2026-01-05' and '2026-02-24'
        or p_day between '2026-03-02' and '2026-04-02'
        or p_day between '2026-04-27' and '2026-06-23'
        or p_day between '2026-06-29' and '2026-07-31'
        or p_day between '2026-08-24' and '2026-10-23'
      when 2027 then p_day between '2027-01-04' and '2027-02-18'
        or p_day between '2027-03-01' and '2027-04-09'
        or p_day between '2027-05-03' and '2027-06-08'
        or p_day between '2027-06-21' and '2027-07-30'
        or p_day between '2027-08-30' and '2027-11-05'
      else true
    end;
$$;

-- Reject starts from cached clients or previously generated instances.
-- Completion and approval of work already started continue as usual.
create function public.enforce_quest_school_schedule()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.quest_templates template
    join public.households household on household.id = template.household_id
    where template.id = new.quest_template_id
      and template.school_schedule = 'term_weekdays'
      and not public.is_kenya_term_weekday((now() at time zone household.timezone)::date)
  ) then
    raise exception 'This quest is available on school term weekdays';
  end if;
  return new;
end;
$$;

create trigger enforce_quest_school_schedule before update of status on public.quest_instances
for each row
when (old.status = 'available' and new.status in ('in_progress', 'pending_approval', 'rewarded'))
execute function public.enforce_quest_school_schedule();

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
      and (qt.school_schedule = 'year_round' or public.is_kenya_term_weekday((now() at time zone h.timezone)::date))
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

create function public.save_quest_admin(
  p_household_id uuid,p_child_ids uuid[],p_template_id uuid,p_title text,p_description text,
  p_icon_key text,p_cadence text,p_star_reward integer,p_xp_reward integer,p_timer_seconds integer,
  p_days_of_week smallint[],p_local_cutoff time,p_schedule_label text,p_minimum_age integer,
  p_maximum_age integer,p_catalog_quest_id uuid,p_school_schedule text
)
returns public.quest_templates
language plpgsql security definer set search_path=public
as $$
declare saved public.quest_templates; previous_days smallint[]; calculated_xp integer;
begin
  if p_school_schedule is null or p_school_schedule not in ('year_round', 'term_weekdays') then
    raise exception 'Choose a valid school calendar setting';
  end if;
  if p_school_schedule = 'term_weekdays' and not (p_days_of_week && array[1,2,3,4,5]::smallint[]) then
    raise exception 'Choose a weekday for a term-weekday quest';
  end if;
  if p_star_reward not between 0 and 100 then raise exception 'Stars must be between 0 and 100'; end if;
  if p_cadence='guild' and cardinality(p_days_of_week) not in (1,7) then
    raise exception 'A Guild Quest must use one weekday or any day this week';
  end if;
  calculated_xp := case when p_cadence='guild' then 3 when p_timer_seconds is not null then 2 else 1 end;
  if p_template_id is not null then
    select assignment.days_of_week into previous_days from quest_assignments assignment
    where assignment.quest_template_id=p_template_id and assignment.active order by assignment.created_at desc limit 1;
  end if;
  select * into saved from public.upsert_quest_admin(
    p_household_id,null,p_template_id,p_title,p_description,p_icon_key,p_cadence,
    p_star_reward,calculated_xp,case when p_cadence='guild' then null else p_timer_seconds end,
    p_days_of_week,p_local_cutoff,p_schedule_label,p_minimum_age,p_maximum_age,p_catalog_quest_id
  );
  update public.quest_templates set school_schedule = p_school_schedule
  where id = saved.id returning * into saved;
  perform public.set_quest_assignments(saved.id,coalesce(p_child_ids,'{}'::uuid[]),p_days_of_week,p_local_cutoff);
  if previous_days is not null and previous_days is distinct from p_days_of_week then
    with expired as (
      update quest_instances set status='expired',expired_at=now(),version=version+1
      where quest_template_id=saved.id and status in ('available','in_progress') returning id
    )
    insert into quest_events(quest_instance_id,event_type,new_status,metadata)
    select id,'quest_expired','expired',jsonb_build_object('source','schedule_change') from expired;
  end if;
  perform public.generate_daily_quest_instances();
  return saved;
end $$;

revoke all on function public.save_quest_admin(uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid,text) from public,anon;
grant execute on function public.save_quest_admin(uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid,text) to authenticated;
