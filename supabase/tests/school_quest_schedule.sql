-- Run after migrations. The household and quest fixtures are rolled back.
begin;

do $$
begin
  assert public.is_kenya_term_weekday(date '2026-02-24');
  assert not public.is_kenya_term_weekday(date '2026-02-25');
  assert not public.is_kenya_term_weekday(date '2026-06-26');
  assert public.is_kenya_term_weekday(date '2026-06-29');
  assert not public.is_kenya_term_weekday(date '2026-11-16');
  assert public.is_kenya_term_weekday(date '2027-01-04');
  assert not public.is_kenya_term_weekday(date '2027-02-19');
  assert public.is_kenya_term_weekday(date '2027-03-01');
  assert not public.is_kenya_term_weekday(date '2027-03-06');
  assert not public.is_kenya_term_weekday(date '2027-06-09');
  assert public.is_kenya_term_weekday(date '2027-06-21');
  assert public.is_kenya_term_weekday(date '2027-11-05');
  assert not public.is_kenya_term_weekday(date '2027-11-08');
  assert public.is_kenya_term_weekday(date '2028-02-07');
  assert not public.is_kenya_term_weekday(date '2028-02-12');
  assert (select school_schedule from public.quest_catalog where slug = 'homework') = 'term_weekdays';
  assert (select school_schedule from public.quest_catalog where slug = 'reading') = 'year_round';
end;
$$;

do $$
declare
  leader uuid := gen_random_uuid();
  hero uuid := gen_random_uuid();
  home uuid := gen_random_uuid();
  school_quest public.quest_templates;
  regular_quest public.quest_templates;
  assignment uuid;
  instance uuid;
  today date := (now() at time zone 'Africa/Nairobi')::date;
  in_school boolean := public.is_kenya_term_weekday(today);
begin
  insert into auth.users(id, email) values (leader, 'school-test-leader@example.invalid'), (hero, 'school-test-hero@example.invalid');
  insert into public.households(id, name, timezone) values (home, 'School schedule test', 'Africa/Nairobi');
  insert into public.household_members(household_id, user_id, role)
  values (home, leader, 'parent'), (home, hero, 'child');

  perform set_config('request.jwt.claim.sub', leader::text, true);
  school_quest := public.save_quest_admin(home, array[hero], null, 'School quest', '', '📚', 'daily',
    1, 1, null, array[1,2,3,4,5,6,7]::smallint[], null, null, null, null, null, 'term_weekdays');
  regular_quest := public.save_quest_admin(home, array[hero], null, 'Regular quest', '', '📚', 'daily',
    1, 1, null, array[1,2,3,4,5,6,7]::smallint[], null, null, null, null, null, 'year_round');
  assert school_quest.school_schedule = 'term_weekdays';
  assert exists (select 1 from public.quest_instances where quest_template_id = regular_quest.id and occurrence_date = today);
  assert exists (select 1 from public.quest_instances where quest_template_id = school_quest.id and occurrence_date = today) = in_school;

  select id into assignment from public.quest_assignments where quest_template_id = school_quest.id;
  if not in_school then
    -- Simulate an open instance generated before its template was reclassified.
    insert into public.quest_instances(assignment_id, quest_template_id, household_id, child_id, occurrence_date,
      available_at, expires_at, star_reward_snapshot, xp_reward_snapshot)
    values (assignment, school_quest.id, home, hero, today, now(), now() + interval '1 day', 1, 1);
  end if;
  select id into instance from public.quest_instances where quest_template_id = school_quest.id and occurrence_date = today;
  perform set_config('request.jwt.claim.sub', hero::text, true);
  if in_school then
    assert (public.complete_quest(instance)).status = 'pending_approval';
  else
    begin
      perform public.complete_quest(instance);
      raise exception 'A cached school quest bypassed the schedule';
    exception when raise_exception then
      if sqlerrm <> 'This quest is available on school term weekdays' then raise; end if;
    end;
    perform set_config('request.jwt.claim.sub', leader::text, true);
    school_quest := public.save_quest_admin(home, array[hero], school_quest.id, 'School quest', '', '📚', 'daily',
      1, 1, null, array[1,2,3,4,5,6,7]::smallint[], null, null, null, null, null, 'year_round');
    perform set_config('request.jwt.claim.sub', hero::text, true);
    assert (public.complete_quest(instance)).status = 'pending_approval';
  end if;

  perform set_config('request.jwt.claim.sub', leader::text, true);
  update public.quest_templates set school_schedule = 'term_weekdays' where id = school_quest.id;
  assert (public.review_quest(instance, true)).status = 'rewarded', 'Pending approvals survive a school calendar change';
end;
$$;

rollback;
