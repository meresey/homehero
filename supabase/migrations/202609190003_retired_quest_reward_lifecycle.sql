-- Retire household content without deleting its history, and allow Party Leaders
-- to restore it later.

alter table public.rewards
  add column if not exists archived_at timestamptz;

create or replace function public.sync_reward_archive_timestamp()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.active then
    new.archived_at := null;
  elsif old.active and not new.active then
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  return new;
end $$;

drop trigger if exists sync_reward_archive_timestamp on public.rewards;
create trigger sync_reward_archive_timestamp
before update of active on public.rewards
for each row execute function public.sync_reward_archive_timestamp();

update public.rewards set archived_at=coalesce(archived_at,created_at) where not active;

create or replace function public.restore_quest_admin(p_template_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target public.quest_templates;
begin
  select * into target from quest_templates where id=p_template_id;
  if target.id is null or not public.is_household_parent(target.household_id) then
    raise exception 'Only a Party Leader can restore this quest';
  end if;

  update quest_templates set is_active=true,archived_at=null where id=p_template_id;
  update quest_assignments qa set active=true,ends_on=null
  where qa.quest_template_id=p_template_id
    and exists (
      select 1 from household_members hm
      join profiles p on p.id=hm.user_id
      where hm.household_id=target.household_id and hm.user_id=qa.child_id and hm.role='child'
        and (p.date_of_birth is null or (
          (target.minimum_age is null or extract(year from age(current_date,p.date_of_birth)) >= target.minimum_age)
          and (target.maximum_age is null or extract(year from age(current_date,p.date_of_birth)) <= target.maximum_age)
        ))
    );
  return true;
end $$;

create or replace function public.restore_reward_admin(p_reward_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  select household_id into target_household from rewards where id=p_reward_id;
  if target_household is null or not public.is_household_parent(target_household) then
    raise exception 'Only a Party Leader can restore this reward';
  end if;
  update rewards set active=true,archived_at=null where id=p_reward_id;
  return true;
end $$;

revoke all on function public.restore_quest_admin(uuid) from public,anon;
revoke all on function public.restore_reward_admin(uuid) from public,anon;
grant execute on function public.restore_quest_admin(uuid) to authenticated;
grant execute on function public.restore_reward_admin(uuid) to authenticated;
