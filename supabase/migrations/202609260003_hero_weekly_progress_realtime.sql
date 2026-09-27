-- Keep the Hero's weekly trail, stars, and streak awards current when a Party
-- Leader approves activity on another device. RLS still limits every client to
-- rows it can read.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='quest_instances'
  ) then
    alter publication supabase_realtime add table public.quest_instances;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='streak_awards'
  ) then
    alter publication supabase_realtime add table public.streak_awards;
  end if;
end $$;
