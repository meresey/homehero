-- Long-term progression: 50 quadratic XP levels, bounded quest XP, and a
-- platform-owned badge catalogue with server-calculated progress.

insert into public.level_definitions(level,minimum_xp,title,characteristics,badge_key)
select level,
  25 * level * (level - 1),
  case ((level - 1) / 5)
    when 0 then 'Rookie Hero' when 1 then 'Rising Hero'
    when 2 then 'Home Hero' when 3 then 'Quest Keeper'
    when 4 then 'Trailblazer' when 5 then 'Hero Champion'
    when 6 then 'Household Guardian' when 7 then 'Hero Master'
    when 8 then 'Legendary Leader' else 'Ultimate Hero'
  end,
  case ((level - 1) / 5)
    when 0 then array['Ready','Brave','Learning']
    when 1 then array['Helpful','Focused','Growing']
    when 2 then array['Dependable','Curious','Kind']
    when 3 then array['Steady','Resourceful','Caring']
    when 4 then array['Bold','Creative','Capable']
    when 5 then array['Committed','Skilled','Positive']
    when 6 then array['Reliable','Thoughtful','Prepared']
    when 7 then array['Wise','Resilient','Generous']
    when 8 then array['Responsible','Supportive','Confident']
    else array['Inspiring','Consistent','Trusted']
  end,
  'shield-' || (((level - 1) / 5) + 1)::text
from generate_series(1,50) level
on conflict (level) do update set
  minimum_xp=excluded.minimum_xp,
  title=excluded.title,
  characteristics=excluded.characteristics,
  badge_key=excluded.badge_key;

-- Party Leaders may choose Stars, but XP remains inside a narrow, predictable
-- range so a household cannot accidentally collapse the lifetime level curve.
update public.quest_templates set xp_reward=greatest(1,least(10,xp_reward));
update public.quest_catalog set xp_reward=greatest(1,least(10,xp_reward));
alter table public.quest_templates drop constraint if exists quest_templates_xp_reward_check;
alter table public.quest_templates add constraint quest_templates_xp_reward_check check (xp_reward between 1 and 10);
alter table public.quest_catalog drop constraint if exists quest_catalog_xp_reward_check;
alter table public.quest_catalog add constraint quest_catalog_xp_reward_check check (xp_reward between 1 and 10);

alter table public.badge_definitions add column if not exists category text not null default 'achievement';
alter table public.badge_definitions add column if not exists tier text;
alter table public.badge_definitions add column if not exists metric_key text not null default 'total_quests';
alter table public.badge_definitions add column if not exists target_value integer not null default 1 check (target_value > 0);

insert into public.badge_definitions(key,name,description,icon_key,sort_order,category,tier,metric_key,target_value)
values
  ('first-step','First Step','Complete your first approved quest.','🌱',10,'quests','Seed','total_quests',1),
  ('getting-started','Getting Started','Complete five approved quests.','✨',11,'quests','Starter','total_quests',5),
  ('reliable-hero','Reliable Hero','Complete 10 approved quests.','🛡️',12,'quests','Bronze','total_quests',10),
  ('quest-builder','Quest Builder','Complete 25 approved quests.','🔨',13,'quests','Silver','total_quests',25),
  ('quest-champion','Quest Champion','Complete 50 approved quests.','🏆',14,'quests','Gold','total_quests',50),
  ('century-hero','Century Hero','Complete 100 approved quests.','💯',15,'quests','Platinum','total_quests',100),
  ('steadfast-hero','Steadfast Hero','Complete 250 approved quests.','🗿',16,'quests','Diamond','total_quests',250),
  ('epic-hero','Epic Hero','Complete 500 approved quests.','⚡',17,'quests','Epic','total_quests',500),
  ('thousand-quest-legend','Thousand Quest Legend','Complete 1,000 approved quests.','👑',18,'quests','Legendary','total_quests',1000),
  ('lifetime-legend','Lifetime Legend','Complete 2,500 approved quests.','🌠',19,'quests','Mythic','total_quests',2500),

  ('bookworm','Bookworm','Complete five approved reading quests.','📚',30,'reading','Bronze','reading_quests',5),
  ('page-turner','Page Turner','Complete 25 approved reading quests.','📖',31,'reading','Silver','reading_quests',25),
  ('reading-star','Reading Star','Complete 100 approved reading quests.','🌟',32,'reading','Gold','reading_quests',100),
  ('library-legend','Library Legend','Complete 250 approved reading quests.','🏛️',33,'reading','Platinum','reading_quests',250),
  ('story-sage','Story Sage','Complete 500 approved reading quests.','🦉',34,'reading','Diamond','reading_quests',500),

  ('timer-tamer','Timer Tamer','Complete five approved timer quests.','⏱️',40,'focus','Bronze','timer_quests',5),
  ('focus-builder','Focus Builder','Complete 25 approved timer quests.','🎯',41,'focus','Silver','timer_quests',25),
  ('focus-champion','Focus Champion','Complete 100 approved timer quests.','🧠',42,'focus','Gold','timer_quests',100),
  ('time-master','Time Master','Complete 250 approved timer quests.','⌛',43,'focus','Diamond','timer_quests',250),

  ('team-player','Team Player','Complete your first approved Guild Quest.','🤝',50,'teamwork','Starter','guild_quests',1),
  ('helping-hand','Helping Hand','Complete five approved Guild Quests.','🙌',51,'teamwork','Bronze','guild_quests',5),
  ('team-builder','Team Builder','Complete 10 approved Guild Quests.','🧩',52,'teamwork','Silver','guild_quests',10),
  ('guild-champion','Guild Champion','Complete 50 approved Guild Quests.','🏅',53,'teamwork','Gold','guild_quests',50),
  ('family-legend','Family Legend','Complete 100 approved Guild Quests.','🏠',54,'teamwork','Platinum','guild_quests',100),
  ('community-hero','Community Hero','Complete 250 approved Guild Quests.','🌍',55,'teamwork','Diamond','guild_quests',250),

  ('safe-zone-sentinel','Safe Zone Sentinel','Submit five bedtime quests before their cutoff.','🌙',60,'bedtime','Bronze','bedtime_on_time',5),
  ('moonlight-guardian','Moonlight Guardian','Submit 25 bedtime quests before their cutoff.','🦉',61,'bedtime','Silver','bedtime_on_time',25),
  ('bedtime-champion','Bedtime Champion','Submit 100 bedtime quests before their cutoff.','🌌',62,'bedtime','Gold','bedtime_on_time',100),
  ('safe-zone-legend','Safe Zone Legend','Submit 250 bedtime quests before their cutoff.','🛌',63,'bedtime','Diamond','bedtime_on_time',250),

  ('goal-getter','Goal Getter','Reach a weekly Star goal.','🎯',70,'weekly-goals','Starter','weekly_goals',1),
  ('goal-starter','Goal Starter','Reach four weekly Star goals.','✅',71,'weekly-goals','Bronze','weekly_goals',4),
  ('goal-builder','Goal Builder','Reach 12 weekly Star goals.','📈',72,'weekly-goals','Silver','weekly_goals',12),
  ('goal-champion','Goal Champion','Reach 26 weekly Star goals.','🥇',73,'weekly-goals','Gold','weekly_goals',26),
  ('year-of-goals','Year of Goals','Reach 52 weekly Star goals.','🗓️',74,'weekly-goals','Platinum','weekly_goals',52),
  ('goal-legend','Goal Legend','Reach 100 weekly Star goals.','🏔️',75,'weekly-goals','Diamond','weekly_goals',100),

  ('perfect-day','Perfect Day','Complete every scheduled quest on one day.','🌟',80,'perfect-days','Starter','perfect_days',1),
  ('perfect-ten','Perfect Ten','Complete 10 perfect days.','🔟',81,'perfect-days','Bronze','perfect_days',10),
  ('perfect-fifty','Perfect Fifty','Complete 50 perfect days.','💫',82,'perfect-days','Silver','perfect_days',50),
  ('perfect-century','Perfect Century','Complete 100 perfect days.','🏆',83,'perfect-days','Gold','perfect_days',100),
  ('everyday-hero','Everyday Hero','Complete 250 perfect days.','🌞',84,'perfect-days','Diamond','perfect_days',250),

  ('on-fire','On Fire','Complete approved quests on three consecutive days.','🔥',90,'consistency','Bronze','longest_streak',3),
  ('seven-day-hero','Seven-Day Hero','Complete approved quests on seven consecutive days.','🔄',91,'consistency','Silver','longest_streak',7),
  ('habit-builder','Habit Builder','Be active on 30 different days.','🧱',92,'consistency','Bronze','active_days',30),
  ('steady-star','Steady Star','Be active on 60 different days.','⭐',93,'consistency','Silver','active_days',60),
  ('hundred-day-hero','Hundred Day Hero','Be active on 100 different days.','💯',94,'consistency','Gold','active_days',100),
  ('year-of-action','Year of Action','Be active on 365 different days.','🗓️',95,'consistency','Diamond','active_days',365),

  ('quest-explorer','Quest Explorer','Complete five different quests.','🧭',100,'exploration','Bronze','distinct_quests',5),
  ('curious-hero','Curious Hero','Complete 10 different quests.','🔎',101,'exploration','Silver','distinct_quests',10),
  ('adventure-seeker','Adventure Seeker','Complete 20 different quests.','🗺️',102,'exploration','Gold','distinct_quests',20),
  ('master-explorer','Master Explorer','Complete 40 different quests.','🚀',103,'exploration','Diamond','distinct_quests',40),

  ('first-reward','First Reward','Have your first Star Store request approved.','🎁',110,'rewards','Starter','approved_rewards',1),
  ('reward-planner','Reward Planner','Have five Star Store requests approved.','🛍️',111,'rewards','Bronze','approved_rewards',5),
  ('star-shopper','Star Shopper','Have 25 Star Store requests approved.','⭐',112,'rewards','Gold','approved_rewards',25),
  ('reward-master','Reward Master','Have 100 Star Store requests approved.','🎊',113,'rewards','Diamond','approved_rewards',100)
on conflict (key) do update set
  name=excluded.name, description=excluded.description, icon_key=excluded.icon_key,
  sort_order=excluded.sort_order, category=excluded.category, tier=excluded.tier,
  metric_key=excluded.metric_key, target_value=excluded.target_value, active=true;

create or replace function public.hero_badge_metric(
  p_child_id uuid,
  p_household_id uuid,
  p_metric_key text
)
returns integer
language plpgsql stable security definer set search_path=public
as $$
declare result integer := 0;
begin
  case p_metric_key
    when 'total_quests' then
      select count(*) into result from quest_instances where child_id=p_child_id and household_id=p_household_id and status='rewarded';
    when 'reading_quests' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded'
        and (lower(qt.title) like '%read%' or qt.icon_key in ('📖','📚'));
    when 'timer_quests' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded' and qt.kind='timer';
    when 'guild_quests' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded' and qt.kind='guild';
    when 'bedtime_on_time' then
      select count(*) into result from quest_instances qi join quest_templates qt on qt.id=qi.quest_template_id
      where qi.child_id=p_child_id and qi.household_id=p_household_id and qi.status='rewarded' and qt.kind='bedtime'
        and qi.cutoff_at is not null and qi.submitted_at is not null and qi.submitted_at <= qi.cutoff_at;
    when 'weekly_goals' then
      select count(*) into result from weekly_goals wg
      where wg.child_id=p_child_id and wg.household_id=p_household_id and (
        select coalesce(sum(qi.star_reward_snapshot),0) from quest_instances qi
        where qi.child_id=wg.child_id and qi.household_id=wg.household_id and qi.status='rewarded'
          and qi.occurrence_date between wg.week_start and wg.week_start+6
      ) >= wg.target_stars;
    when 'perfect_days' then
      select count(*) into result from (
        select occurrence_date from quest_instances
        where child_id=p_child_id and household_id=p_household_id
        group by occurrence_date having count(*) > 0 and bool_and(status='rewarded')
      ) perfect;
    when 'active_days' then
      select count(distinct occurrence_date) into result from quest_instances
      where child_id=p_child_id and household_id=p_household_id and status='rewarded';
    when 'longest_streak' then
      select coalesce(max(streak_days),0) into result from (
        select count(*)::integer streak_days from (
          select active_date, active_date - row_number() over(order by active_date)::integer streak_group
          from (select distinct occurrence_date active_date from quest_instances
            where child_id=p_child_id and household_id=p_household_id and status='rewarded') dates
        ) grouped_dates group by streak_group
      ) streaks;
    when 'distinct_quests' then
      select count(distinct quest_template_id) into result from quest_instances
      where child_id=p_child_id and household_id=p_household_id and status='rewarded';
    when 'approved_rewards' then
      select count(*) into result from reward_redemptions rr join rewards r on r.id=rr.reward_id
      where rr.child_id=p_child_id and r.household_id=p_household_id and rr.status in ('approved','fulfilled');
    else result := 0;
  end case;
  return coalesce(result,0);
end $$;

revoke all on function public.hero_badge_metric(uuid,uuid,text) from public,anon;

create or replace function public.hero_badge_metrics(p_child_id uuid,p_household_id uuid)
returns jsonb
language sql stable security definer set search_path=public
as $$
  select jsonb_build_object(
    'total_quests',public.hero_badge_metric(p_child_id,p_household_id,'total_quests'),
    'reading_quests',public.hero_badge_metric(p_child_id,p_household_id,'reading_quests'),
    'timer_quests',public.hero_badge_metric(p_child_id,p_household_id,'timer_quests'),
    'guild_quests',public.hero_badge_metric(p_child_id,p_household_id,'guild_quests'),
    'bedtime_on_time',public.hero_badge_metric(p_child_id,p_household_id,'bedtime_on_time'),
    'weekly_goals',public.hero_badge_metric(p_child_id,p_household_id,'weekly_goals'),
    'perfect_days',public.hero_badge_metric(p_child_id,p_household_id,'perfect_days'),
    'active_days',public.hero_badge_metric(p_child_id,p_household_id,'active_days'),
    'longest_streak',public.hero_badge_metric(p_child_id,p_household_id,'longest_streak'),
    'distinct_quests',public.hero_badge_metric(p_child_id,p_household_id,'distinct_quests'),
    'approved_rewards',public.hero_badge_metric(p_child_id,p_household_id,'approved_rewards')
  )
$$;

revoke all on function public.hero_badge_metrics(uuid,uuid) from public,anon;

create or replace function public.evaluate_hero_badges(p_child_id uuid,p_household_id uuid)
returns integer
language plpgsql security definer set search_path=public
as $$
declare achievement record; metrics jsonb; awarded integer := 0; inserted integer := 0;
begin
  if not exists(select 1 from household_members where household_id=p_household_id and user_id=p_child_id and role='child') then
    raise exception 'Hero is not in this household';
  end if;
  metrics := public.hero_badge_metrics(p_child_id,p_household_id);
  for achievement in select key,metric_key,target_value from badge_definitions where active order by sort_order,key loop
    if coalesce((metrics ->> achievement.metric_key)::integer,0) >= achievement.target_value then
      insert into hero_badges(household_id,child_id,badge_key)
      values(p_household_id,p_child_id,achievement.key) on conflict do nothing;
      get diagnostics inserted=row_count; awarded := awarded + inserted;
    end if;
  end loop;
  return awarded;
end $$;

create or replace function public.evaluate_additional_hero_badges(p_child_id uuid,p_household_id uuid)
returns integer language sql security definer set search_path=public
as $$ select public.evaluate_hero_badges(p_child_id,p_household_id) $$;

revoke all on function public.evaluate_hero_badges(uuid,uuid) from public,anon,authenticated;
revoke all on function public.evaluate_additional_hero_badges(uuid,uuid) from public,anon,authenticated;

create or replace function public.evaluate_badges_after_quest_reward()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.status='rewarded' and old.status is distinct from 'rewarded' then
    perform public.evaluate_hero_badges(new.child_id,new.household_id);
  end if;
  return new;
end $$;

create or replace function public.evaluate_badges_after_reward_approval()
returns trigger language plpgsql security definer set search_path=public
as $$
declare target_household uuid;
begin
  if new.status in ('approved','fulfilled') and old.status is distinct from new.status then
    select household_id into target_household from rewards where id=new.reward_id;
    if target_household is not null then perform public.evaluate_hero_badges(new.child_id,target_household); end if;
  end if;
  return new;
end $$;

create or replace function public.get_my_badge_progress()
returns table(
  badge_key text, name text, description text, icon_key text, category text,
  tier text, current_value integer, target_value integer, earned_at timestamptz
)
language sql stable security definer set search_path=public
as $$
  with member_metrics as materialized (
    select member.user_id,member.household_id,
      public.hero_badge_metrics(member.user_id,member.household_id) value
    from household_members member
    where member.user_id=auth.uid() and member.role='child'
  )
  select definition.key,definition.name,definition.description,definition.icon_key,
    definition.category,definition.tier,least(coalesce((metrics.value ->> definition.metric_key)::integer,0),definition.target_value),
    definition.target_value,earned.earned_at
  from member_metrics metrics
  join badge_definitions definition on definition.active
  left join hero_badges earned on earned.child_id=metrics.user_id and earned.badge_key=definition.key
  order by (earned.earned_at is not null) desc,definition.sort_order,definition.key
$$;

revoke all on function public.get_my_badge_progress() from public,anon;
grant execute on function public.get_my_badge_progress() to authenticated;

-- Apply newly introduced milestones to existing history without fabricating
-- progress for new Heroes.
do $$
declare hero record;
begin
  for hero in select household_id,user_id child_id from household_members where role='child' loop
    perform public.evaluate_hero_badges(hero.child_id,hero.household_id);
  end loop;
end $$;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hero_badges') then
    alter publication supabase_realtime add table public.hero_badges;
  end if;
end $$;

create or replace function public.save_quest_admin(
  p_household_id uuid,p_child_ids uuid[],p_template_id uuid,p_title text,p_description text,
  p_icon_key text,p_cadence text,p_star_reward integer,p_xp_reward integer,p_timer_seconds integer,
  p_days_of_week smallint[],p_local_cutoff time,p_schedule_label text,p_minimum_age integer,
  p_maximum_age integer,p_catalog_quest_id uuid
)
returns public.quest_templates
language plpgsql security definer set search_path=public
as $$
declare saved public.quest_templates; previous_days smallint[];
begin
  if p_xp_reward not between 1 and 10 then raise exception 'XP must be between 1 and 10'; end if;
  if p_star_reward not between 0 and 100 then raise exception 'Stars must be between 0 and 100'; end if;
  if p_cadence='guild' and cardinality(p_days_of_week) not in (1,7) then
    raise exception 'A Guild Quest must use one weekday or any day this week';
  end if;
  if p_template_id is not null then
    select assignment.days_of_week into previous_days from quest_assignments assignment
    where assignment.quest_template_id=p_template_id and assignment.active order by assignment.created_at desc limit 1;
  end if;
  select * into saved from public.upsert_quest_admin(
    p_household_id,null,p_template_id,p_title,p_description,p_icon_key,p_cadence,
    p_star_reward,p_xp_reward,case when p_cadence='guild' then null else p_timer_seconds end,
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
