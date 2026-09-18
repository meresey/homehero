-- Seeded Reward Library plus parent-authorized household reward administration.

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 100),
  description text,
  icon_key text not null default '🎁',
  star_cost integer not null check (star_cost between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.rewards
  add column if not exists catalog_reward_id uuid references public.reward_catalog(id);

create unique index if not exists rewards_household_catalog_unique
  on public.rewards(household_id, catalog_reward_id)
  where catalog_reward_id is not null;

alter table public.reward_catalog enable row level security;
drop policy if exists reward_catalog_read on public.reward_catalog;
create policy reward_catalog_read on public.reward_catalog for select to authenticated using (is_active);
grant select on public.reward_catalog to authenticated;

insert into public.reward_catalog(slug,title,description,icon_key,star_cost)
values
  ('screen-time-30','Extra screen time','30 bonus minutes after responsibilities are done','🎮',20),
  ('choose-dessert','Choose dessert','Pick the family treat','🍦',25),
  ('family-movie','Pick family movie','Choose the next family movie night','🎬',30),
  ('later-bedtime','Stay up 30 minutes later','A special weekend bedtime extension','🌙',35),
  ('family-activity','Choose a family activity','You pick the next family adventure','⚽',40),
  ('friend-visit','Invite a friend over','Plan a parent-approved visit','🧑‍🤝‍🧑',50),
  ('book-or-game','New book or small game','Choose something special within the family budget','📚',60),
  ('weekend-privilege','Weekend privilege','Choose an agreed special weekend privilege','🎟️',75),
  ('special-outing','Special outing','Plan one-on-one time with a parent','🗺️',100)
on conflict (slug) do update set
  title=excluded.title,
  description=excluded.description,
  icon_key=excluded.icon_key,
  star_cost=excluded.star_cost,
  is_active=true;

create or replace function public.upsert_reward_admin(
  p_household_id uuid,
  p_reward_id uuid,
  p_catalog_reward_id uuid,
  p_title text,
  p_description text,
  p_icon_key text,
  p_star_cost integer
)
returns public.rewards
language plpgsql security definer set search_path = public
as $$
declare saved public.rewards;
begin
  if not public.is_household_parent(p_household_id) then raise exception 'Only a Party Leader can manage rewards'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Reward title is required'; end if;
  if p_star_cost not between 1 and 10000 then raise exception 'Star cost must be between 1 and 10,000'; end if;
  if p_catalog_reward_id is not null and not exists(select 1 from reward_catalog where id=p_catalog_reward_id and is_active)
    then raise exception 'Catalog reward is unavailable'; end if;

  if p_reward_id is not null then
    update rewards set
      catalog_reward_id=coalesce(p_catalog_reward_id,catalog_reward_id),
      title=trim(p_title), description=nullif(trim(p_description),''),
      icon_key=coalesce(nullif(trim(p_icon_key),''),'🎁'), star_cost=p_star_cost,
      requires_parent_approval=true, active=true
    where id=p_reward_id and household_id=p_household_id
    returning * into saved;
    if saved.id is null then raise exception 'Reward not found'; end if;
  elsif p_catalog_reward_id is not null then
    insert into rewards(household_id,created_by,catalog_reward_id,title,description,icon_key,star_cost,requires_parent_approval,active)
    values(p_household_id,auth.uid(),p_catalog_reward_id,trim(p_title),nullif(trim(p_description),''),coalesce(nullif(trim(p_icon_key),''),'🎁'),p_star_cost,true,true)
    on conflict (household_id,catalog_reward_id) where catalog_reward_id is not null do update set
      title=excluded.title, description=excluded.description, icon_key=excluded.icon_key,
      star_cost=excluded.star_cost, requires_parent_approval=true, active=true
    returning * into saved;
  else
    insert into rewards(household_id,created_by,title,description,icon_key,star_cost,requires_parent_approval,active)
    values(p_household_id,auth.uid(),trim(p_title),nullif(trim(p_description),''),coalesce(nullif(trim(p_icon_key),''),'🎁'),p_star_cost,true,true)
    returning * into saved;
  end if;
  return saved;
end $$;

create or replace function public.archive_reward_admin(p_reward_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  select household_id into target_household from rewards where id=p_reward_id;
  if target_household is null or not public.is_household_parent(target_household) then raise exception 'Only a Party Leader can remove rewards'; end if;
  update rewards set active=false where id=p_reward_id;
  return true;
end $$;

grant execute on function public.upsert_reward_admin(uuid,uuid,uuid,text,text,text,integer) to authenticated;
grant execute on function public.archive_reward_admin(uuid) to authenticated;

-- A purchase is a request. Stars and limited inventory change only after approval.
create or replace function public.redeem_reward(p_reward_id uuid, p_idempotency_key text)
returns public.reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare r public.rewards; result public.reward_redemptions; balance integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into r from rewards where id=p_reward_id and active for update;
  if r.id is null or not public.is_household_member(r.household_id) or coalesce(r.inventory,1) <= 0 then raise exception 'Reward unavailable'; end if;
  select coalesce(sum(amount),0) into balance from point_ledger where child_id=auth.uid() and currency='star';
  if balance < r.star_cost then raise exception 'Not enough stars'; end if;
  select rr.* into result from reward_redemptions rr where rr.reward_id=r.id and rr.child_id=auth.uid() and rr.status='requested' order by rr.requested_at desc limit 1;
  if result.id is not null then return result; end if;
  insert into reward_redemptions(reward_id,child_id,star_cost_snapshot,status,idempotency_key)
  values(r.id,auth.uid(),r.star_cost,'requested',p_idempotency_key)
  on conflict(child_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into result;
  return result;
end $$;

create or replace function public.review_reward_redemption(p_redemption_id uuid, p_approve boolean)
returns public.reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare request public.reward_redemptions; reward public.rewards; balance integer;
begin
  select * into request from reward_redemptions where id=p_redemption_id for update;
  if request.id is null then raise exception 'Reward request not found'; end if;
  select * into reward from rewards where id=request.reward_id for update;
  if reward.id is null or not public.is_household_parent(reward.household_id) then raise exception 'Only a Party Leader can review this reward'; end if;
  if request.status <> 'requested' then raise exception 'Reward request has already been reviewed'; end if;
  if not p_approve then
    update reward_redemptions set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=request.id returning * into request;
    return request;
  end if;
  select coalesce(sum(amount),0) into balance from point_ledger where child_id=request.child_id and currency='star';
  if balance < request.star_cost_snapshot then raise exception 'Not enough stars to approve this reward'; end if;
  if reward.inventory is not null and reward.inventory <= 0 then raise exception 'Reward unavailable'; end if;
  insert into point_ledger(household_id,child_id,currency,amount,reason,reference_key,metadata)
  values(reward.household_id,request.child_id,'star',-request.star_cost_snapshot,'redemption','redemption:'||request.id,jsonb_build_object('reward_id',reward.id))
  on conflict do nothing;
  if reward.inventory is not null then update rewards set inventory=inventory-1 where id=reward.id and inventory>0; end if;
  update reward_redemptions set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=request.id returning * into request;
  return request;
end $$;

grant execute on function public.redeem_reward(uuid,text) to authenticated;
grant execute on function public.review_reward_redemption(uuid,boolean) to authenticated;
