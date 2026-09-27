-- XP is platform progression, not a household currency. Keep Stars flexible
-- for each family while deriving XP exclusively from the quest type.

create or replace function public.system_quest_xp(p_kind public.quest_kind)
returns integer
language sql immutable
as $$
  select case p_kind when 'guild' then 3 when 'timer' then 2 else 1 end
$$;

revoke all on function public.system_quest_xp(public.quest_kind) from public,anon;
grant execute on function public.system_quest_xp(public.quest_kind) to authenticated;

create or replace function public.enforce_system_quest_xp()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  new.xp_reward := public.system_quest_xp(new.kind);
  return new;
end $$;

drop trigger if exists system_xp_quest_templates on public.quest_templates;
create trigger system_xp_quest_templates
before insert or update of kind,xp_reward on public.quest_templates
for each row execute function public.enforce_system_quest_xp();

drop trigger if exists system_xp_quest_catalog on public.quest_catalog;
create trigger system_xp_quest_catalog
before insert or update of kind,xp_reward on public.quest_catalog
for each row execute function public.enforce_system_quest_xp();

update public.quest_templates set xp_reward=public.system_quest_xp(kind);
update public.quest_catalog set xp_reward=public.system_quest_xp(kind);

-- Preserve rewarded history, but make every unawarded instance use the new
-- system value when it is eventually approved.
update public.quest_instances instance
set xp_reward_snapshot=public.system_quest_xp(template.kind)
from public.quest_templates template
where template.id=instance.quest_template_id
  and instance.status in ('available','in_progress','pending_approval');

create or replace function public.save_quest_admin(
  p_household_id uuid,p_child_ids uuid[],p_template_id uuid,p_title text,p_description text,
  p_icon_key text,p_cadence text,p_star_reward integer,p_xp_reward integer,p_timer_seconds integer,
  p_days_of_week smallint[],p_local_cutoff time,p_schedule_label text,p_minimum_age integer,
  p_maximum_age integer,p_catalog_quest_id uuid
)
returns public.quest_templates
language plpgsql security definer set search_path=public
as $$
declare saved public.quest_templates; previous_days smallint[]; calculated_xp integer;
begin
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

revoke all on function public.save_quest_admin(uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid) from public,anon;
grant execute on function public.save_quest_admin(uuid,uuid[],uuid,text,text,text,text,integer,integer,integer,smallint[],time,text,integer,integer,uuid) to authenticated;
