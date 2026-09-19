-- Save the template and its (possibly empty) Hero assignment list in one
-- transaction so age-specific unassigned quests cannot be partially saved.

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
declare saved public.quest_templates;
begin
  select * into saved from public.upsert_quest_admin(
    p_household_id,null,p_template_id,p_title,p_description,p_icon_key,p_cadence,
    p_star_reward,p_xp_reward,p_timer_seconds,p_days_of_week,p_local_cutoff,p_schedule_label,
    p_minimum_age,p_maximum_age,p_catalog_quest_id
  );
  perform public.set_quest_assignments(
    saved.id,coalesce(p_child_ids,'{}'::uuid[]),p_days_of_week,p_local_cutoff
  );
  return saved;
end $$;

revoke all on function public.save_quest_admin(
  uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid
) from public,anon;
grant execute on function public.save_quest_admin(
  uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid
) to authenticated;

-- Exercise the same atomic request used by the app. The test row is removed
-- before this migration transaction completes.
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
  select * into test_quest from public.save_quest_admin(
    test_household,'{}'::uuid[],null,'__atomic_age_range_validation__',
    'Temporary atomic validation','🧪','daily',1,1,null,
    '{1,2,3,4,5,6,7}'::smallint[],null,'Every day',12,15,null
  );
  if test_quest.minimum_age<>12 or test_quest.maximum_age<>15 then
    raise exception 'Atomic age-range quest validation failed';
  end if;
  if exists(select 1 from quest_assignments where quest_template_id=test_quest.id and active) then
    raise exception 'Unassigned age-range quest unexpectedly has an active assignment';
  end if;
  delete from quest_templates where id=test_quest.id;
end $$;

