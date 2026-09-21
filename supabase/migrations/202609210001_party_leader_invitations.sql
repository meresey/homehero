-- Adults join through an email-bound, one-time invitation. The existing family
-- join code remains for child accounts and cannot grant Party Leader access.
alter table public.household_members add column is_owner boolean not null default false;

update public.household_members member
set is_owner = true
from (
  select distinct on (household_id) household_id, user_id
  from public.household_members
  where role = 'parent'
  order by household_id, joined_at, user_id
) first_parent
where member.household_id = first_parent.household_id
  and member.user_id = first_parent.user_id;

create unique index household_one_owner on public.household_members(household_id) where is_owner;
create unique index household_one_membership_per_user on public.household_members(user_id);
alter table public.household_members add constraint owner_must_be_parent check (not is_owner or role = 'parent');

create table public.parent_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  token_hash bytea not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  check (expires_at > created_at)
);

create index parent_invitations_household on public.parent_invitations(household_id, status);
create unique index parent_invitations_one_pending_email
  on public.parent_invitations(household_id, invited_email) where status = 'pending';
alter table public.parent_invitations enable row level security;
revoke all on public.parent_invitations from public, anon, authenticated;

create or replace function public.create_parent_household(p_name text, p_timezone text default 'Africa/Nairobi')
returns public.households language plpgsql security definer set search_path = ''
as $$
declare created public.households;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Account already belongs to a household';
  end if;
  insert into public.households(name, timezone)
    values (coalesce(nullif(trim(p_name), ''), 'Our Hero Home'), p_timezone)
    returning * into created;
  insert into public.household_members(household_id, user_id, role, is_owner)
    values (created.id, auth.uid(), 'parent', true);
  return created;
end $$;

create function public.list_household_party_leaders(p_household_id uuid)
returns table(user_id uuid, display_name text, email text, is_owner boolean, joined_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_household_parent(p_household_id) then raise exception 'Party Leader access required'; end if;
  return query
    select m.user_id, p.display_name, u.email::text, m.is_owner, m.joined_at
    from public.household_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.household_id = p_household_id and m.role = 'parent'
    order by m.is_owner desc, m.joined_at, m.user_id;
end $$;

create function public.list_parent_invitations(p_household_id uuid)
returns table(id uuid, invited_email text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = auth.uid() and m.is_owner) then
    raise exception 'Only the household owner can manage Party Leader invitations';
  end if;
  return query
    select i.id, i.invited_email, i.created_at, i.expires_at
    from public.parent_invitations i
    where i.household_id = p_household_id and i.status = 'pending' and i.expires_at > now()
    order by i.created_at desc;
end $$;

create function public.create_parent_invitation(p_household_id uuid, p_email text)
returns text language plpgsql security definer set search_path = ''
as $$
declare normalized_email text := lower(trim(p_email)); code text;
begin
  if not exists(select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = auth.uid() and m.is_owner) then
    raise exception 'Only the household owner can invite Party Leaders';
  end if;
  if normalized_email is null or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if exists(
    select 1 from public.household_members m join auth.users u on u.id = m.user_id
    where m.household_id = p_household_id and lower(u.email) = normalized_email
  ) then raise exception 'This account is already in your household'; end if;

  update public.parent_invitations i set status = 'revoked'
    where i.household_id = p_household_id and i.invited_email = normalized_email and i.status = 'pending';
  code := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  insert into public.parent_invitations(household_id, invited_email, token_hash, invited_by, expires_at)
    values (p_household_id, normalized_email, sha256(convert_to(code, 'UTF8')), auth.uid(), now() + interval '7 days');
  return code;
end $$;

create function public.accept_parent_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare invite public.parent_invitations; signed_in_email text; normalized_code text := upper(regexp_replace(coalesce(p_token, ''), '[[:space:]-]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Sign in to accept your invitation'; end if;
  if normalized_code !~ '^[0-9A-F]{32}$' then raise exception 'Enter a valid Party Leader invitation code'; end if;
  select lower(u.email) into signed_in_email from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null;
  if signed_in_email is null then raise exception 'Confirm your email address before joining the household'; end if;
  select * into invite from public.parent_invitations i
    where i.token_hash = sha256(convert_to(normalized_code, 'UTF8')) and i.status = 'pending'
    for update;
  if invite.id is null or invite.expires_at <= now() then raise exception 'This invitation is invalid or has expired'; end if;
  if signed_in_email <> invite.invited_email then raise exception 'Sign in with the email address this invitation was issued to'; end if;
  if exists(select 1 from public.household_members m where m.user_id = auth.uid()) then
    raise exception 'This account already belongs to a household';
  end if;

  insert into public.household_members(household_id, user_id, role, is_owner)
    values (invite.household_id, auth.uid(), 'parent', false);
  insert into public.parent_child_links(household_id, parent_id, child_id)
    select invite.household_id, auth.uid(), m.user_id
    from public.household_members m
    where m.household_id = invite.household_id and m.role = 'child'
    on conflict do nothing;
  update public.parent_invitations i
    set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
    where i.id = invite.id;
  return invite.household_id;
end $$;

create function public.revoke_parent_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.parent_invitations i set status = 'revoked'
  where i.id = p_invitation_id and i.status = 'pending'
    and exists(select 1 from public.household_members m where m.household_id = i.household_id and m.user_id = auth.uid() and m.is_owner);
  if not found then raise exception 'Invitation not found or you cannot revoke it'; end if;
end $$;

create function public.remove_household_party_leader(p_household_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = auth.uid() and m.is_owner) then
    raise exception 'Only the household owner can remove a Party Leader';
  end if;
  if p_user_id = auth.uid() then raise exception 'The household owner cannot remove themselves'; end if;
  if not exists(select 1 from public.household_members m where m.household_id = p_household_id and m.user_id = p_user_id and m.role = 'parent' and not m.is_owner) then
    raise exception 'Party Leader not found';
  end if;
  delete from public.parent_child_links l where l.household_id = p_household_id and l.parent_id = p_user_id;
  delete from public.household_members m where m.household_id = p_household_id and m.user_id = p_user_id and m.role = 'parent' and not m.is_owner;
end $$;

revoke execute on function public.list_household_party_leaders(uuid), public.list_parent_invitations(uuid),
  public.create_parent_invitation(uuid,text), public.accept_parent_invitation(text),
  public.revoke_parent_invitation(uuid), public.remove_household_party_leader(uuid,uuid)
  from public, anon;
grant execute on function public.list_household_party_leaders(uuid), public.list_parent_invitations(uuid),
  public.create_parent_invitation(uuid,text), public.accept_parent_invitation(text),
  public.revoke_parent_invitation(uuid), public.remove_household_party_leader(uuid,uuid)
  to authenticated;
