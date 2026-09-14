alter table public.households
  add column invite_code text unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email,'Hero'),'@',1)))
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles(id,display_name)
select id,coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(coalesce(email,'Hero'),'@',1))
from auth.users on conflict(id) do nothing;

create or replace function public.create_parent_household(p_name text, p_timezone text default 'Africa/Nairobi')
returns public.households language plpgsql security definer set search_path = public
as $$ declare created public.households;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from household_members where user_id=auth.uid()) then raise exception 'Account already belongs to a household'; end if;
  insert into households(name,timezone) values(coalesce(nullif(trim(p_name),''),'Our Hero Home'),p_timezone) returning * into created;
  insert into household_members(household_id,user_id,role) values(created.id,auth.uid(),'parent');
  return created;
end $$;

create or replace function public.join_household_as_child(p_invite_code text)
returns public.households language plpgsql security definer set search_path = public
as $$ declare target public.households;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from household_members where user_id=auth.uid()) then raise exception 'Account already belongs to a household'; end if;
  select * into target from households where invite_code=upper(trim(p_invite_code));
  if target.id is null then raise exception 'Invalid family code'; end if;
  insert into household_members(household_id,user_id,role) values(target.id,auth.uid(),'child');
  insert into parent_child_links(household_id,parent_id,child_id)
  select target.id,user_id,auth.uid() from household_members where household_id=target.id and role='parent' on conflict do nothing;
  return target;
end $$;

grant execute on function public.create_parent_household(text,text), public.join_household_as_child(text) to authenticated;
