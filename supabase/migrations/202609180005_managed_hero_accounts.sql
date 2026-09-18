-- Party Leaders create child accounts; Heroes sign in with a username and PIN.
-- The username maps to a non-deliverable internal email in Supabase Auth.

create table public.managed_hero_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index managed_hero_accounts_household on public.managed_hero_accounts(household_id);

alter table public.managed_hero_accounts enable row level security;

create policy managed_hero_accounts_read on public.managed_hero_accounts
for select using (user_id = (select auth.uid()) or public.is_household_parent(household_id));

create or replace function public.finalize_managed_hero(
  p_user_id uuid,
  p_household_id uuid,
  p_created_by uuid,
  p_display_name text,
  p_username text,
  p_date_of_birth date
)
returns void
language plpgsql security definer set search_path = public
as $$
declare hero_age integer;
begin
  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 60 then raise exception 'A valid Hero name is required'; end if;
  if p_username is null or p_username !~ '^[a-z][a-z0-9_]{2,19}$' then raise exception 'Invalid Hero username'; end if;
  if p_date_of_birth is null or p_date_of_birth > current_date then raise exception 'A valid birth date is required'; end if;
  hero_age := extract(year from age(current_date, p_date_of_birth))::integer;
  if hero_age not between 3 and 18 then raise exception 'Heroes must be between 3 and 18 years old'; end if;
  if not exists(select 1 from household_members where household_id=p_household_id and user_id=p_created_by and role='parent') then raise exception 'Only a Party Leader can enroll a Hero'; end if;

  insert into profiles(id,display_name,date_of_birth)
  values(p_user_id,trim(p_display_name),p_date_of_birth)
  on conflict(id) do update set display_name=excluded.display_name,date_of_birth=excluded.date_of_birth;

  insert into household_members(household_id,user_id,role) values(p_household_id,p_user_id,'child');
  insert into managed_hero_accounts(user_id,household_id,username,created_by) values(p_user_id,p_household_id,p_username,p_created_by);
  insert into parent_child_links(household_id,parent_id,child_id)
  select p_household_id,user_id,p_user_id from household_members where household_id=p_household_id and role='parent' on conflict do nothing;
end $$;

revoke all on function public.finalize_managed_hero(uuid,uuid,uuid,text,text,date) from public, anon, authenticated;
grant execute on function public.finalize_managed_hero(uuid,uuid,uuid,text,text,date) to service_role;
