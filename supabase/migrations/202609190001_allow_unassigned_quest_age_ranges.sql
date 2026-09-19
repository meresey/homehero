-- Age-specific quests may exist without a currently eligible Hero. An empty
-- assignment list means "keep this quest in My quests, assigned to nobody".

-- PostgREST represents JSON age values as integers. Keep the existing
-- smallint implementation private and expose an integer-compatible wrapper so
-- the age-aware overload resolves reliably.
alter function public.upsert_quest_admin(
  uuid,uuid,uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,smallint,smallint,uuid
) rename to upsert_quest_admin_smallint;

revoke all on function public.upsert_quest_admin_smallint(
  uuid,uuid,uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,smallint,smallint,uuid
) from public,anon,authenticated;

create function public.upsert_quest_admin(
  p_household_id uuid,
  p_child_id uuid,
  p_template_id uuid,
  p_title text,
  p_description text,
  p_icon_key text,
  p_cadence text,
  p_star_reward integer,
  p_xp_reward integer,
  p_timer_seconds integer default null,
  p_days_of_week smallint[] default '{1,2,3,4,5,6,7}',
  p_local_cutoff time default null,
  p_schedule_label text default null,
  p_minimum_age integer default null,
  p_maximum_age integer default null,
  p_catalog_quest_id uuid default null
)
returns public.quest_templates
language sql security definer set search_path = public
as $$
  select * from public.upsert_quest_admin_smallint(
    p_household_id,p_child_id,p_template_id,p_title,p_description,p_icon_key,p_cadence,
    p_star_reward,p_xp_reward,p_timer_seconds,p_days_of_week,p_local_cutoff,p_schedule_label,
    p_minimum_age::smallint,p_maximum_age::smallint,p_catalog_quest_id
  );
$$;

grant execute on function public.upsert_quest_admin(
  uuid,uuid,uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid
) to authenticated;

create or replace function public.set_quest_assignments(
  p_template_id uuid,
  p_child_ids uuid[],
  p_days_of_week smallint[] default '{1,2,3,4,5,6,7}',
  p_local_cutoff time default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  target public.quest_templates;
  loop_child_id uuid;
  local_start date;
  changed integer := 0;
begin
  select * into target from quest_templates where id=p_template_id and is_active;
  if target.id is null or not public.is_household_parent(target.household_id) then
    raise exception 'Only a Party Leader can assign this quest';
  end if;
  if exists(select 1 from unnest(p_days_of_week) day where day not between 1 and 7) then
    raise exception 'Invalid day of week';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_child_ids,'{}'::uuid[])) selected(id)
    left join household_members hm on hm.user_id=selected.id and hm.household_id=target.household_id and hm.role='child'
    left join profiles p on p.id=selected.id
    where hm.user_id is null
      or (p.date_of_birth is not null and target.minimum_age is not null and extract(year from age(current_date,p.date_of_birth)) < target.minimum_age)
      or (p.date_of_birth is not null and target.maximum_age is not null and extract(year from age(current_date,p.date_of_birth)) > target.maximum_age)
  ) then raise exception 'One or more Heroes are not eligible for this quest'; end if;

  local_start := (now() at time zone (select timezone from households where id=target.household_id))::date;
  update quest_assignments
  set active=false,ends_on=greatest(starts_on,coalesce(ends_on,local_start))
  where quest_template_id=p_template_id
    and not (child_id=any(coalesce(p_child_ids,'{}'::uuid[])));

  foreach loop_child_id in array coalesce(p_child_ids,'{}'::uuid[]) loop
    update quest_assignments
    set active=true,starts_on=least(starts_on,local_start),ends_on=null,
        days_of_week=p_days_of_week,local_cutoff=p_local_cutoff
    where id=(select id from quest_assignments where quest_template_id=p_template_id and child_id=loop_child_id order by created_at desc limit 1);
    if not found then
      insert into quest_assignments(quest_template_id,child_id,starts_on,days_of_week,local_cutoff)
      values(p_template_id,loop_child_id,local_start,p_days_of_week,p_local_cutoff);
    end if;
    changed := changed+1;
  end loop;
  return changed;
end $$;

grant execute on function public.set_quest_assignments(uuid,uuid[],smallint[],time) to authenticated;

-- Live migration guard: exercise the same unassigned 12–15 creation path and
-- remove the temporary row before the migration transaction completes.
do $$
declare
  test_household uuid;
  test_parent uuid;
  test_quest public.quest_templates;
begin
  select hm.household_id,hm.user_id into test_household,test_parent
  from household_members hm where hm.role='parent' order by hm.joined_at limit 1;
  if test_household is null then return; end if;

  perform set_config('request.jwt.claim.sub',test_parent::text,true);
  select * into test_quest from public.upsert_quest_admin(
    test_household,null,null,'__age_range_validation__','Temporary migration validation','🧪',
    'daily',1,1,null,'{1,2,3,4,5,6,7}'::smallint[],null,'Every day',12,15,null
  );
  if test_quest.minimum_age<>12 or test_quest.maximum_age<>15 then
    raise exception 'Age-range quest validation failed';
  end if;
  perform public.set_quest_assignments(test_quest.id,'{}'::uuid[],'{1,2,3,4,5,6,7}'::smallint[],null);
  delete from quest_templates where id=test_quest.id;
end $$;
