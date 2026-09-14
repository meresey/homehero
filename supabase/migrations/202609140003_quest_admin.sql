alter table public.quest_templates
  add column cadence text not null default 'daily'
    check (cadence in ('daily', 'weekly', 'guild')),
  add column schedule_label text,
  add column archived_at timestamptz;

create or replace function public.upsert_quest_admin(
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
  p_schedule_label text default null
)
returns public.quest_templates
language plpgsql security definer set search_path = public
as $$
declare
  template public.quest_templates;
  template_kind public.quest_kind;
  assignment_id uuid;
begin
  if not public.is_household_parent(p_household_id) then raise exception 'Only a Party Leader can manage quests'; end if;
  if not exists(select 1 from household_members where household_id=p_household_id and user_id=p_child_id and role='child') then raise exception 'Child is not in this household'; end if;
  if p_cadence not in ('daily','weekly','guild') then raise exception 'Invalid quest cadence'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Quest title is required'; end if;
  if p_star_reward not between 0 and 100 or p_xp_reward not between 0 and 100 then raise exception 'Rewards must be between 0 and 100'; end if;
  if exists(select 1 from unnest(p_days_of_week) day where day not between 1 and 7) then raise exception 'Invalid day of week'; end if;

  template_kind := case when p_cadence='guild' then 'guild'::quest_kind when p_timer_seconds is not null then 'timer'::quest_kind else 'daily'::quest_kind end;

  if p_template_id is null then
    insert into quest_templates(household_id,created_by,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,parent_approval_required)
    values(p_household_id,auth.uid(),trim(p_title),nullif(trim(p_description),''),coalesce(nullif(trim(p_icon_key),''),'sparkles'),template_kind,p_cadence,p_schedule_label,p_star_reward,p_xp_reward,p_timer_seconds,p_cadence='guild')
    returning * into template;
  else
    update quest_templates set
      title=trim(p_title), description=nullif(trim(p_description),''), icon_key=coalesce(nullif(trim(p_icon_key),''),'sparkles'),
      kind=template_kind, cadence=p_cadence, schedule_label=p_schedule_label,
      star_reward=p_star_reward, xp_reward=p_xp_reward, timer_seconds=p_timer_seconds,
      parent_approval_required=(p_cadence='guild'), is_active=true, archived_at=null
    where id=p_template_id and household_id=p_household_id
    returning * into template;
    if template.id is null then raise exception 'Quest not found'; end if;
  end if;

  select id into assignment_id from quest_assignments where quest_template_id=template.id and child_id=p_child_id order by created_at desc limit 1;
  if assignment_id is null then
    insert into quest_assignments(quest_template_id,child_id,starts_on,days_of_week,local_cutoff)
    values(template.id,p_child_id,(now() at time zone (select timezone from households where id=p_household_id))::date,p_days_of_week,p_local_cutoff);
  else
    update quest_assignments set days_of_week=p_days_of_week,local_cutoff=p_local_cutoff,active=true,ends_on=null where id=assignment_id;
  end if;
  return template;
end $$;

create or replace function public.archive_quest_admin(p_template_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  select household_id into target_household from quest_templates where id=p_template_id;
  if target_household is null or not public.is_household_parent(target_household) then raise exception 'Only a Party Leader can remove this quest'; end if;
  update quest_templates set is_active=false,archived_at=now() where id=p_template_id;
  update quest_assignments set active=false,ends_on=coalesce(ends_on,current_date) where quest_template_id=p_template_id;
  return true;
end $$;

grant execute on function public.upsert_quest_admin(uuid,uuid,uuid,text,text,text,text,integer,integer,integer,smallint[],time,text) to authenticated;
grant execute on function public.archive_quest_admin(uuid) to authenticated;
