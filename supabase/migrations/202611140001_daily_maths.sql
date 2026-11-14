create table public.hero_maths_grades (
  household_id uuid not null,
  child_id uuid not null,
  school_grade integer not null check (school_grade between 1 and 12),
  primary key (household_id, child_id),
  foreign key (household_id, child_id)
    references public.household_members(household_id, user_id) on delete cascade
);

create table public.hero_maths_attempts (
  household_id uuid not null,
  child_id uuid not null,
  quest_date date not null,
  grade integer not null check (grade between 4 and 7),
  set_index integer not null check (set_index >= 0),
  bank_version integer not null check (bank_version > 0),
  results text[] not null default '{}'
    check (cardinality(results) <= 5
      and array_position(results, null) is null
      and results <@ array['correct', 'with_hint', 'worked']::text[]),
  completed_at timestamptz,
  primary key (household_id, child_id, quest_date),
  foreign key (household_id, child_id)
    references public.household_members(household_id, user_id) on delete cascade
);

alter table public.hero_maths_grades enable row level security;
alter table public.hero_maths_attempts enable row level security;
revoke all on public.hero_maths_grades, public.hero_maths_attempts from public, anon, authenticated;
grant select on public.hero_maths_grades, public.hero_maths_attempts to authenticated;

create policy hero_maths_grades_read on public.hero_maths_grades for select to authenticated
  using (child_id = (select auth.uid()) or public.is_household_parent(household_id));

create policy hero_maths_attempts_read on public.hero_maths_attempts for select to authenticated
  using (child_id = (select auth.uid()) or public.is_household_parent(household_id));

create function public.set_hero_maths_grade(p_household_id uuid, p_child_id uuid, p_grade integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_household_parent(p_household_id) or not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_child_id and role = 'child'
  ) then
    raise exception 'Only a Party Leader can set a Hero’s grade' using errcode = '42501';
  end if;

  if p_grade is null then
    delete from public.hero_maths_grades where household_id = p_household_id and child_id = p_child_id;
  else
    insert into public.hero_maths_grades(household_id, child_id, school_grade)
    values (p_household_id, p_child_id, p_grade)
    on conflict (household_id, child_id) do update set school_grade = excluded.school_grade;
  end if;
end;
$$;

create function public.get_hero_maths_day(p_household_id uuid, p_start boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  hero uuid := auth.uid();
  today date;
  school_grade integer;
  set_count integer;
  attempt public.hero_maths_attempts;
begin
  select (now() at time zone h.timezone)::date into today
  from public.households h
  join public.household_members m on m.household_id = h.id
  where h.id = p_household_id and m.user_id = hero and m.role = 'child';
  if today is null then
    raise exception 'Daily Maths is available to Heroes in their own household' using errcode = '42501';
  end if;

  select g.school_grade into school_grade
  from public.hero_maths_grades g
  where g.household_id = p_household_id and g.child_id = hero;
  set_count := case school_grade when 4 then 8 when 5 then 9 when 6 then 7 when 7 then 8 end;

  if p_start and set_count is not null then
    insert into public.hero_maths_attempts(household_id, child_id, quest_date, grade, set_index, bank_version)
    values (p_household_id, hero, today, school_grade,
      mod(mod(today - date '1970-01-01', set_count) + set_count, set_count), 1)
    on conflict do nothing;
  end if;

  select * into attempt from public.hero_maths_attempts
  where household_id = p_household_id and child_id = hero and quest_date = today;
  return jsonb_build_object('day', today, 'grade', school_grade, 'attempt',
    case when attempt.child_id is not null then jsonb_build_object(
      'day', attempt.quest_date, 'grade', attempt.grade, 'setIndex', attempt.set_index,
      'bankVersion', attempt.bank_version, 'results', attempt.results
    ) end);
end;
$$;

create function public.record_hero_maths_result(
  p_household_id uuid, p_day date, p_index integer, p_result text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  hero uuid := auth.uid();
  current_day jsonb;
  attempt public.hero_maths_attempts;
begin
  current_day := public.get_hero_maths_day(p_household_id);
  if p_day is distinct from (current_day->>'day')::date then
    raise exception 'A new Daily Maths quest is available. Reopen the quest to continue.';
  end if;
  if p_index is null or p_index not between 0 and 4 or p_result is null
    or p_result not in ('correct', 'with_hint', 'worked') then
    raise exception 'Invalid Daily Maths result';
  end if;

  select * into attempt from public.hero_maths_attempts
  where household_id = p_household_id and child_id = hero and quest_date = p_day
  for update;
  if not found or p_index > cardinality(attempt.results) then
    raise exception 'Start the quest and work through its questions in order';
  end if;

  if p_index = cardinality(attempt.results) then
    update public.hero_maths_attempts
    set results = array_append(results, p_result),
        completed_at = case when p_index = 4 then now() end
    where household_id = p_household_id and child_id = hero and quest_date = p_day;
    if p_index = 4 then
      insert into public.point_ledger(household_id, child_id, currency, amount, reason, reference_key, metadata)
      values (p_household_id, hero, 'xp', 1, 'quest_reward', 'daily_maths:' || p_day,
        jsonb_build_object('grade', attempt.grade, 'setIndex', attempt.set_index, 'bankVersion', attempt.bank_version))
      on conflict (child_id, currency, reference_key) do nothing;
    end if;
  end if;

  return public.get_hero_maths_day(p_household_id);
end;
$$;

revoke all on function public.set_hero_maths_grade(uuid, uuid, integer),
  public.get_hero_maths_day(uuid, boolean), public.record_hero_maths_result(uuid, date, integer, text)
  from public, anon;
grant execute on function public.set_hero_maths_grade(uuid, uuid, integer),
  public.get_hero_maths_day(uuid, boolean), public.record_hero_maths_result(uuid, date, integer, text)
  to authenticated;

alter publication supabase_realtime add table public.hero_maths_grades;
