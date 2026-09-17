-- Household quest library and multi-Hero assignments.
-- Apply this migration when Supabase is re-enabled.

create table if not exists public.quest_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 100),
  description text,
  icon_key text not null default '✨',
  kind public.quest_kind not null,
  cadence text not null check (cadence in ('daily','weekly','guild')),
  schedule_label text,
  star_reward integer not null default 1 check (star_reward between 0 and 100),
  xp_reward integer not null default 1 check (xp_reward between 0 and 100),
  timer_seconds integer check (timer_seconds between 60 and 10800),
  minimum_age smallint,
  maximum_age smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((minimum_age is null or minimum_age between 3 and 18)
    and (maximum_age is null or maximum_age between 3 and 18)
    and (minimum_age is null or maximum_age is null or minimum_age <= maximum_age))
);

alter table public.quest_templates
  add column if not exists catalog_quest_id uuid references public.quest_catalog(id),
  add column if not exists visibility text not null default 'household' check (visibility = 'household');

alter table public.quest_catalog enable row level security;
drop policy if exists catalog_read on public.quest_catalog;
create policy catalog_read on public.quest_catalog for select to authenticated using (is_active);

grant select on public.quest_catalog to authenticated;

insert into public.quest_catalog(slug,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,minimum_age,maximum_age)
values
  ('make-bed','Make bed & tidy room','Start the day with a clear space','🛏️','daily','daily','Every day',1,1,null,null,null),
  ('homework','Homework focus','Finish today''s schoolwork','📚','daily','daily','Mon–Fri',1,1,null,8,15),
  ('reading','Reading adventure','Read without distractions','📖','timer','daily','Every day',1,1,1200,null,null),
  ('outside','Outdoor explorer','Move, play, and get fresh air','🌳','timer','weekly','3 times a week',2,2,1800,null,null),
  ('dinner','Help with dinner','A family co-op quest','🍳','guild','guild','Saturday',3,3,null,10,15),
  ('laundry','Laundry helper','Sort, fold, and put away clean clothes','🧺','daily','weekly','Once a week',2,2,null,8,null),
  ('dishes','Dish duty','Load or unload the dishwasher','🍽️','daily','daily','Every day',1,1,null,8,null),
  ('pet-care','Pet care','Feed, water, or tidy up after a pet','🐾','daily','daily','Every day',1,1,null,7,null)
on conflict (slug) do nothing;

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
  if coalesce(array_length(p_child_ids,1),0)=0 then raise exception 'Choose at least one Hero'; end if;
  if exists(select 1 from unnest(p_days_of_week) day where day not between 1 and 7) then raise exception 'Invalid day of week'; end if;
  if exists(
    select 1 from unnest(p_child_ids) selected(id)
    left join household_members hm on hm.user_id=selected.id and hm.household_id=target.household_id and hm.role='child'
    left join profiles p on p.id=selected.id
    where hm.user_id is null
      or (p.date_of_birth is not null and target.minimum_age is not null and extract(year from age(current_date,p.date_of_birth)) < target.minimum_age)
      or (p.date_of_birth is not null and target.maximum_age is not null and extract(year from age(current_date,p.date_of_birth)) > target.maximum_age)
  ) then raise exception 'One or more Heroes are not eligible for this quest'; end if;

  local_start := (now() at time zone (select timezone from households where id=target.household_id))::date;
  update quest_assignments set active=false, ends_on=coalesce(ends_on,local_start)
  where quest_template_id=p_template_id and not (child_id=any(p_child_ids));

  foreach loop_child_id in array p_child_ids loop
    update quest_assignments set active=true, starts_on=least(starts_on,local_start), ends_on=null, days_of_week=p_days_of_week, local_cutoff=p_local_cutoff
    where id=(select id from quest_assignments where quest_template_id=p_template_id and quest_assignments.child_id=loop_child_id order by created_at desc limit 1);
    if not found then
      insert into quest_assignments(quest_template_id,child_id,starts_on,days_of_week,local_cutoff)
      values(p_template_id,loop_child_id,local_start,p_days_of_week,p_local_cutoff);
    end if;
    changed := changed + 1;
  end loop;
  return changed;
end $$;

grant execute on function public.set_quest_assignments(uuid,uuid[],smallint[],time) to authenticated;
