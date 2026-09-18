-- Allow Party Leaders to add catalog or custom quests before a Hero joins.
-- Catalog provenance is stored in the same transaction as the template.

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
  p_schedule_label text default null,
  p_minimum_age smallint default null,
  p_maximum_age smallint default null,
  p_catalog_quest_id uuid default null
)
returns public.quest_templates
language plpgsql security definer set search_path = public
as $$
declare
  template public.quest_templates;
  template_kind public.quest_kind;
  assignment_id uuid;
  child_age integer;
begin
  if not public.is_household_parent(p_household_id) then raise exception 'Only a Party Leader can manage quests'; end if;
  if p_child_id is not null and not exists(
    select 1 from household_members where household_id=p_household_id and user_id=p_child_id and role='child'
  ) then raise exception 'Child is not in this household'; end if;
  if p_catalog_quest_id is not null and not exists(
    select 1 from quest_catalog where id=p_catalog_quest_id and is_active
  ) then raise exception 'Catalog quest is unavailable'; end if;
  if p_cadence not in ('daily','weekly','guild') then raise exception 'Invalid quest cadence'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Quest title is required'; end if;
  if p_star_reward not between 0 and 100 or p_xp_reward not between 0 and 100 then raise exception 'Rewards must be between 0 and 100'; end if;
  if exists(select 1 from unnest(p_days_of_week) day where day not between 1 and 7) then raise exception 'Invalid day of week'; end if;
  if (p_minimum_age is not null and p_minimum_age not between 3 and 18)
    or (p_maximum_age is not null and p_maximum_age not between 3 and 18)
    or (p_minimum_age is not null and p_maximum_age is not null and p_minimum_age > p_maximum_age)
  then raise exception 'Invalid quest age range'; end if;

  if p_child_id is not null then
    select extract(year from age(current_date, date_of_birth))::integer into child_age from profiles where id=p_child_id;
    if child_age is not null and ((p_minimum_age is not null and child_age < p_minimum_age) or (p_maximum_age is not null and child_age > p_maximum_age))
    then raise exception 'Quest is not appropriate for this Hero age'; end if;
  end if;

  template_kind := case when p_cadence='guild' then 'guild'::quest_kind when p_timer_seconds is not null then 'timer'::quest_kind else 'daily'::quest_kind end;

  if p_template_id is null then
    insert into quest_templates(
      household_id,created_by,catalog_quest_id,title,description,icon_key,kind,cadence,
      schedule_label,star_reward,xp_reward,timer_seconds,parent_approval_required,minimum_age,maximum_age
    ) values(
      p_household_id,auth.uid(),p_catalog_quest_id,trim(p_title),nullif(trim(p_description),''),
      coalesce(nullif(trim(p_icon_key),''),'sparkles'),template_kind,p_cadence,p_schedule_label,
      p_star_reward,p_xp_reward,p_timer_seconds,p_cadence='guild',p_minimum_age,p_maximum_age
    ) returning * into template;
  else
    update quest_templates set
      catalog_quest_id=coalesce(p_catalog_quest_id,catalog_quest_id),
      title=trim(p_title), description=nullif(trim(p_description),''), icon_key=coalesce(nullif(trim(p_icon_key),''),'sparkles'),
      kind=template_kind, cadence=p_cadence, schedule_label=p_schedule_label,
      star_reward=p_star_reward, xp_reward=p_xp_reward, timer_seconds=p_timer_seconds,
      parent_approval_required=(p_cadence='guild'), minimum_age=p_minimum_age, maximum_age=p_maximum_age,
      is_active=true, archived_at=null
    where id=p_template_id and household_id=p_household_id
    returning * into template;
    if template.id is null then raise exception 'Quest not found'; end if;
  end if;

  if p_child_id is not null then
    select id into assignment_id from quest_assignments where quest_template_id=template.id and child_id=p_child_id order by created_at desc limit 1;
    if assignment_id is null then
      insert into quest_assignments(quest_template_id,child_id,starts_on,days_of_week,local_cutoff)
      values(template.id,p_child_id,(now() at time zone (select timezone from households where id=p_household_id))::date,p_days_of_week,p_local_cutoff);
    else
      update quest_assignments set days_of_week=p_days_of_week,local_cutoff=p_local_cutoff,active=true,ends_on=null where id=assignment_id;
    end if;
  end if;

  return template;
end $$;

grant execute on function public.upsert_quest_admin(uuid,uuid,uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,smallint,smallint,uuid) to authenticated;
