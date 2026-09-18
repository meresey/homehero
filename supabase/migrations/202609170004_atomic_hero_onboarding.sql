-- Save the Hero profile and household membership atomically. This avoids a
-- client-side profile update that would be rejected by profile RLS.

drop function if exists public.join_household_as_child(text);

create or replace function public.join_household_as_child(
  p_invite_code text,
  p_date_of_birth date
)
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  target public.households;
  hero_age integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from household_members where user_id=auth.uid()) then
    raise exception 'Account already belongs to a household';
  end if;
  if p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception 'A valid birth date is required';
  end if;
  hero_age := extract(year from age(current_date,p_date_of_birth))::integer;
  if hero_age not between 3 and 18 then
    raise exception 'Heroes must be between 3 and 18 years old';
  end if;

  select * into target from households where invite_code=upper(trim(p_invite_code));
  if target.id is null then raise exception 'Invalid family code'; end if;

  update profiles set date_of_birth=p_date_of_birth where id=auth.uid();
  if not found then raise exception 'Hero profile was not found'; end if;

  insert into household_members(household_id,user_id,role)
  values(target.id,auth.uid(),'child');
  insert into parent_child_links(household_id,parent_id,child_id)
  select target.id,user_id,auth.uid()
  from household_members
  where household_id=target.id and role='parent'
  on conflict do nothing;
  return target;
end $$;

grant execute on function public.join_household_as_child(text,date) to authenticated;
