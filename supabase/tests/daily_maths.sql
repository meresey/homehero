-- Run after the migrations. All fixtures and XP changes roll back.
begin;

insert into auth.users(id,email) values
  ('ee560000-0000-4000-8000-000000000001','maths-regression-leader@example.invalid'),
  ('ee560000-0000-4000-8000-000000000002','maths-regression-hero@example.invalid'),
  ('ee560000-0000-4000-8000-000000000003','maths-regression-sibling@example.invalid'),
  ('ee560000-0000-4000-8000-000000000004','maths-regression-outsider@example.invalid');

insert into public.households(id,name,timezone) values
  ('ee560000-0000-4000-8000-000000000010','Maths regression','Africa/Nairobi'),
  ('ee560000-0000-4000-8000-000000000020','Other household','Africa/Nairobi');

insert into public.household_members(household_id,user_id,role) values
  ('ee560000-0000-4000-8000-000000000010','ee560000-0000-4000-8000-000000000001','parent'),
  ('ee560000-0000-4000-8000-000000000010','ee560000-0000-4000-8000-000000000002','child'),
  ('ee560000-0000-4000-8000-000000000010','ee560000-0000-4000-8000-000000000003','child'),
  ('ee560000-0000-4000-8000-000000000020','ee560000-0000-4000-8000-000000000004','parent');


insert into public.quest_templates(id,household_id,created_by,title,kind,star_reward)
values ('ee560000-0000-4000-8000-000000000100','ee560000-0000-4000-8000-000000000010','ee560000-0000-4000-8000-000000000001','Regression quest','daily',4);

insert into public.quest_assignments(id,quest_template_id,child_id,starts_on)
values ('ee560000-0000-4000-8000-000000000101','ee560000-0000-4000-8000-000000000100','ee560000-0000-4000-8000-000000000002',current_date);

insert into public.quest_instances(id,assignment_id,quest_template_id,household_id,child_id,occurrence_date,available_at,expires_at,star_reward_snapshot,xp_reward_snapshot)
values ('ee560000-0000-4000-8000-000000000102','ee560000-0000-4000-8000-000000000101','ee560000-0000-4000-8000-000000000100',
  'ee560000-0000-4000-8000-000000000010','ee560000-0000-4000-8000-000000000002',current_date,now(),now() + interval '1 day',4,1);

insert into public.rewards(id,household_id,created_by,title,star_cost)
values ('ee560000-0000-4000-8000-000000000103','ee560000-0000-4000-8000-000000000010','ee560000-0000-4000-8000-000000000001','Regression reward',2);

set local role authenticated;

do $$
declare
  household constant uuid := 'ee560000-0000-4000-8000-000000000010';
  other_household constant uuid := 'ee560000-0000-4000-8000-000000000020';
  leader constant uuid := 'ee560000-0000-4000-8000-000000000001';
  hero constant uuid := 'ee560000-0000-4000-8000-000000000002';
  sibling constant uuid := 'ee560000-0000-4000-8000-000000000003';
  outsider constant uuid := 'ee560000-0000-4000-8000-000000000004';
  today constant date := (now() at time zone 'Africa/Nairobi')::date;
  existing_quest constant uuid := 'ee560000-0000-4000-8000-000000000102';
  reward constant uuid := 'ee560000-0000-4000-8000-000000000103';
  redemption public.reward_redemptions;
  result jsonb;
begin
  perform set_config('request.jwt.claim.sub', hero::text, true);
  result := public.get_hero_maths_day(household, true);
  assert result->'grade' = 'null'::jsonb and result->'attempt' = 'null'::jsonb, 'Legacy Hero has no assigned grade';
  begin
    perform public.set_hero_maths_grade(household, hero, 4);
    raise exception 'Hero changed their own grade';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', outsider::text, true);
  begin
    perform public.set_hero_maths_grade(household, hero, 4);
    raise exception 'Outsider assigned a grade';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', leader::text, true);
  perform public.set_hero_maths_grade(household, hero, 4);
  perform public.set_hero_maths_grade(household, sibling, 6);
  assert (select count(*) from public.hero_maths_grades where household_id = household) = 2, 'Leader sees both grade assignments';

  perform set_config('request.jwt.claim.sub', hero::text, true);
  assert (select count(*) from public.hero_maths_grades) = 1, 'Sibling grade must be private';
  result := public.get_hero_maths_day(household, true);
  assert result->>'day' = today::text and result#>>'{attempt,grade}' = '4', 'Quest uses the Hero’s grade and household day';
  assert (result#>>'{attempt,setIndex}')::int = mod(today - date '1970-01-01', 8);
  assert jsonb_array_length(result#>'{attempt,results}') = 0;
  begin
    perform public.get_hero_maths_day(other_household, true);
    raise exception 'Hero started a quest in another household';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_hero_maths_result(household, today, 4, 'correct');
    raise exception 'Skipped questions accepted';
  exception when raise_exception then
    if sqlerrm not like 'Start the quest%' then raise; end if;
  end;
  begin
    perform public.record_hero_maths_result(household, today - 1, 0, 'correct');
    raise exception 'Expired date accepted';
  exception when raise_exception then
    if sqlerrm not like 'A new Daily Maths quest%' then raise; end if;
  end;
  perform public.record_hero_maths_result(household, today, 0, 'with_hint');

  perform set_config('request.jwt.claim.sub', leader::text, true);
  perform public.set_hero_maths_grade(household, hero, 7);
  assert (select grade from public.hero_maths_attempts where child_id = hero) = 4, 'History keeps the assigned grade';

  perform set_config('request.jwt.claim.sub', sibling::text, true);
  result := public.get_hero_maths_day(household, true);
  assert result#>>'{attempt,grade}' = '6', 'Sibling gets their own grade';
  assert (select count(*) from public.hero_maths_attempts) = 1, 'Sibling attempt must be private';
  perform set_config('request.jwt.claim.sub', hero::text, true);
  result := public.get_hero_maths_day(household, true);
  assert result->>'grade' = '7' and result#>>'{attempt,grade}' = '4', 'A grade change preserves the in-progress set';
  assert result#>'{attempt,results}' = '["with_hint"]'::jsonb, 'Server resumes the current attempt';
  perform public.record_hero_maths_result(household, today, 0, 'correct');
  perform public.record_hero_maths_result(household, today, 1, 'worked');
  perform public.record_hero_maths_result(household, today, 2, 'correct');
  perform public.record_hero_maths_result(household, today, 3, 'correct');
  assert not exists (select 1 from public.point_ledger where child_id = hero and reference_key like 'daily_maths:%');
  perform public.record_hero_maths_result(household, today, 4, 'worked');
  result := public.record_hero_maths_result(household, today, 4, 'correct');
  assert result#>'{attempt,results}' = '["with_hint","worked","correct","correct","worked"]'::jsonb;
  assert (select count(*) from public.point_ledger where child_id = hero and reference_key like 'daily_maths:%') = 1;
  assert (select amount from public.point_ledger where child_id = hero and currency = 'xp' and reference_key = 'daily_maths:' || today) = 1;
  assert (select xp from public.child_balances where child_id = hero) = 1;
  assert (select stars from public.child_balances where child_id = hero) = 0;

  perform set_config('request.jwt.claim.sub', leader::text, true);
  perform public.set_hero_maths_grade(household, sibling, 8);
  perform public.set_hero_maths_grade(household, hero, null);
  assert not exists (select 1 from public.hero_maths_grades where child_id = hero);
  assert exists (select 1 from public.hero_maths_attempts where child_id = hero and completed_at is not null);

  perform set_config('request.jwt.claim.sub', hero::text, true);
  assert (public.complete_quest(existing_quest)).status = 'pending_approval', 'Chore still requires approval';
  perform set_config('request.jwt.claim.sub', leader::text, true);
  assert (public.review_quest(existing_quest, true)).status = 'rewarded';
  perform set_config('request.jwt.claim.sub', hero::text, true);
  assert (select xp from public.child_balances where child_id = hero) = 2, 'Chore and Maths XP combine';
  assert (select stars from public.child_balances where child_id = hero) = 4;
  redemption := public.redeem_reward(reward, 'maths-regression-redemption');
  assert redemption.status = 'requested';
  perform set_config('request.jwt.claim.sub', leader::text, true);
  assert (public.review_reward_redemption(redemption.id, true)).status = 'approved';
  perform set_config('request.jwt.claim.sub', hero::text, true);
  assert (public.claim_reward_redemption(redemption.id)).status = 'claimed';
  assert (select stars from public.child_balances where child_id = hero) = 2;
  perform set_config('request.jwt.claim.sub', leader::text, true);
  assert (public.fulfill_reward_redemption(redemption.id)).status = 'fulfilled';
end $$;

rollback;
