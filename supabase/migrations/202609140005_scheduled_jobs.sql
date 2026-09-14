create extension if not exists pg_cron;

select cron.schedule(
  'homehero-generate-quest-instances',
  '*/15 * * * *',
  $$select public.generate_daily_quest_instances();$$
);

select cron.schedule(
  'homehero-expire-overdue-quests',
  '*/5 * * * *',
  $$select public.expire_overdue_quests();$$
);

select cron.schedule(
  'homehero-weekly-streaks',
  '15 0 * * 1',
  $$select public.award_weekly_streaks((current_date - 7)::date);$$
);
