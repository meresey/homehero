begin;

do $$
declare
  leader uuid := gen_random_uuid();
  hero uuid := gen_random_uuid();
  home uuid := gen_random_uuid();
  template public.quest_templates;
  instance uuid;
  zone text;
  local_time timestamp;
  hours jsonb;
  soon jsonb;
begin
  select candidate into zone from unnest(array['UTC','Pacific/Honolulu','Asia/Tokyo']) candidate
  where extract(hour from now() at time zone candidate) between 3 and 20 limit 1;
  local_time := now() at time zone zone;

  insert into auth.users(id,email) values (leader,'windows-leader@example.invalid'), (hero,'windows-hero@example.invalid');
  insert into public.households(id,name,timezone) values (home,'Quest window test',zone);
  insert into public.household_members(household_id,user_id,role)
  values (home,leader,'parent'), (home,hero,'child');

  select quest_hours into hours from public.households where id = home;
  assert not public.valid_quest_hours(hours - 'daytime');
  assert not public.valid_quest_hours(jsonb_set(hours,'{morning,end}','"04:00"'));
  hours := jsonb_set(hours,'{morning}',jsonb_build_object(
    'start',to_char(local_time + interval '1 hour','HH24:MI'),
    'end',to_char(local_time + interval '2 hours','HH24:MI')
  ));
  perform set_config('request.jwt.claim.sub',hero::text,true);
  begin
    perform public.set_household_quest_hours(home,hours);
    raise exception 'Hero changed the household schedule';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',leader::text,true);
  perform public.set_household_quest_hours(home,hours);
  template := public.save_quest_admin(home,array[hero],null,'Timed window','','📚','daily',
    1,2,3600,array[1,2,3,4,5,6,7]::smallint[],null,null,null,null,null,'year_round','morning');
  assert template.time_window = 'morning';
  select id into instance from public.quest_instances where quest_template_id = template.id;
  assert instance is not null;

  perform set_config('request.jwt.claim.sub',hero::text,true);
  begin
    perform public.start_timer(instance);
    raise exception 'Early start accepted';
  exception when raise_exception then
    if sqlerrm <> 'This quest has not opened yet' then raise; end if;
  end;

  soon := jsonb_set(hours,'{morning}',jsonb_build_object(
    'start',to_char(local_time - interval '1 hour','HH24:MI'),
    'end',to_char(local_time + interval '30 minutes','HH24:MI')
  ));
  perform set_config('request.jwt.claim.sub',leader::text,true);
  perform public.set_household_quest_hours(home,soon);
  perform set_config('request.jwt.claim.sub',hero::text,true);
  begin
    perform public.start_timer(instance);
    raise exception 'Timer that cannot fit was accepted';
  exception when raise_exception then
    if sqlerrm <> 'There is not enough time to finish this quest before it closes' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',leader::text,true);
  perform public.set_household_quest_hours(home,jsonb_set(soon,'{morning,end}',to_jsonb(to_char(local_time + interval '2 hours','HH24:MI'))));
  perform set_config('request.jwt.claim.sub',hero::text,true);
  assert (public.start_timer(instance)).status = 'in_progress';
  update public.quest_instances set timer_expected_end_at = now() - interval '1 second' where id=instance;
  perform set_config('request.jwt.claim.sub',leader::text,true);
  perform public.set_household_quest_hours(home,jsonb_set(soon,'{morning,end}',to_jsonb(to_char(local_time - interval '1 minute','HH24:MI'))));
  perform set_config('request.jwt.claim.sub',hero::text,true);
  begin
    perform public.finish_timer(instance);
    raise exception 'Late submission accepted';
  exception when raise_exception then
    if sqlerrm <> 'The quest window has closed' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',leader::text,true);
  perform public.set_household_quest_hours(home,soon);
  perform set_config('request.jwt.claim.sub',hero::text,true);
  assert (public.finish_timer(instance)).status = 'pending_approval';
  perform set_config('request.jwt.claim.sub',leader::text,true);
  perform public.set_household_quest_hours(home,hours);
  assert (public.review_quest(instance,true)).status = 'rewarded', 'Review works after closing';
end;
$$;

rollback;
