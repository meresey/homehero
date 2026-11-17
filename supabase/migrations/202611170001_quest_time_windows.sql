alter table public.households
  add column quest_hours jsonb not null default
    '{"morning":{"start":"05:00","end":"09:00"},"daytime":{"start":"09:00","end":"18:00"},"bedtime":{"start":"19:00","end":"21:00"}}';

alter table public.quest_catalog
  add column time_window text not null default 'anytime'
  check (time_window in ('anytime','morning','daytime','bedtime'));

alter table public.quest_templates
  add column time_window text not null default 'anytime'
  check (time_window in ('anytime','morning','daytime','bedtime'));

update public.quest_catalog set time_window = 'morning' where slug = 'make-bed';
update public.quest_catalog set time_window = 'daytime' where slug in ('homework','outside');
update public.quest_templates template set time_window = catalog.time_window
from public.quest_catalog catalog
where template.catalog_quest_id = catalog.id and catalog.time_window <> 'anytime';
update public.quest_templates set time_window = 'bedtime' where kind = 'bedtime';

create function public.valid_quest_hours(p_hours jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(coalesce(
    jsonb_typeof(p_hours->period) = 'object'
      and (p_hours->period->>'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (p_hours->period->>'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and (p_hours->period->>'start') < (p_hours->period->>'end'),
    false)), false)
  from unnest(array['morning', 'daytime', 'bedtime']) as windows(period);
$$;

alter table public.households add constraint valid_household_quest_hours
  check (public.valid_quest_hours(quest_hours));

create function public.set_household_quest_hours(p_household_id uuid, p_hours jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_household_parent(p_household_id) then
    raise exception 'Only a Party Leader can edit quest hours' using errcode = '42501';
  end if;
  if not public.valid_quest_hours(p_hours) then
    raise exception 'Enter opening and closing times in 24-hour format for each window';
  end if;
  update public.households set quest_hours = p_hours where id = p_household_id;
end;
$$;

revoke all on function public.set_household_quest_hours(uuid,jsonb) from public,anon;
grant execute on function public.set_household_quest_hours(uuid,jsonb) to authenticated;

create function public.save_quest_admin(
  p_household_id uuid,p_child_ids uuid[],p_template_id uuid,p_title text,p_description text,
  p_icon_key text,p_cadence text,p_star_reward integer,p_xp_reward integer,p_timer_seconds integer,
  p_days_of_week smallint[],p_local_cutoff time,p_schedule_label text,p_minimum_age integer,
  p_maximum_age integer,p_catalog_quest_id uuid,p_school_schedule text,p_time_window text
)
returns public.quest_templates
language plpgsql security definer set search_path = ''
as $$
declare
  saved public.quest_templates;
  original_kind public.quest_kind;
begin
  if p_time_window is null or p_time_window not in ('anytime','morning','daytime','bedtime') then
    raise exception 'Choose a valid time of day';
  end if;
  if not public.is_household_parent(p_household_id) then
    raise exception 'Only a Party Leader can manage quests' using errcode = '42501';
  end if;
  if p_template_id is not null then
    select kind into original_kind from public.quest_templates
    where id = p_template_id and household_id = p_household_id;
    if p_local_cutoff is null then
      select local_cutoff into p_local_cutoff from public.quest_assignments
      where quest_template_id = p_template_id and active
      order by created_at desc limit 1;
    end if;
  end if;

  saved := public.save_quest_admin(p_household_id,p_child_ids,p_template_id,p_title,p_description,
    p_icon_key,p_cadence,p_star_reward,p_xp_reward,p_timer_seconds,p_days_of_week,p_local_cutoff,
    p_schedule_label,p_minimum_age,p_maximum_age,p_catalog_quest_id,p_school_schedule);

  update public.quest_templates
  set time_window = p_time_window,
      kind = case when original_kind = 'bedtime' and saved.kind = 'daily' then original_kind else saved.kind end
  where id = saved.id returning * into saved;
  return saved;
end;
$$;

revoke all on function public.save_quest_admin(uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid,text,text) from public,anon;
grant execute on function public.save_quest_admin(uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid,text,text) to authenticated;

create function public.enforce_quest_time_window()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  instant timestamptz := clock_timestamp();
  zone text;
  window_hours jsonb;
  local_day date;
  opens_at timestamptz;
  closes_at timestamptz;
begin
  select household.timezone, household.quest_hours->template.time_window into zone, window_hours
  from public.quest_templates template
  join public.households household on household.id = template.household_id
  where template.id = new.quest_template_id;

  opens_at := new.available_at;
  closes_at := least(new.cutoff_at, new.expires_at);
  if window_hours is not null then
    local_day := (instant at time zone zone)::date;
    opens_at := greatest(opens_at, (local_day + (window_hours->>'start')::time) at time zone zone);
    closes_at := least(closes_at, (local_day + (window_hours->>'end')::time) at time zone zone);
  end if;
  if instant < opens_at then
    raise exception 'This quest has not opened yet';
  end if;
  if instant >= closes_at then
    raise exception 'The quest window has closed';
  end if;
  if new.status = 'in_progress' and new.timer_expected_end_at >= closes_at then
    raise exception 'There is not enough time to finish this quest before it closes';
  end if;
  return new;
end;
$$;

-- Submission is time-bound. Review of a previously submitted quest can happen later.
create trigger enforce_quest_time_window before update of status on public.quest_instances
for each row when (
  (old.status = 'available' and new.status in ('in_progress','pending_approval','rewarded'))
  or (old.status = 'in_progress' and new.status = 'pending_approval')
)
execute function public.enforce_quest_time_window();

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'households') then
    alter publication supabase_realtime add table public.households;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quest_templates') then
    alter publication supabase_realtime add table public.quest_templates;
  end if;
end;
$$;
