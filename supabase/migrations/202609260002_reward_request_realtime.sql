-- Party Leaders need to receive new reward approval requests without manually
-- reloading the application. Row-level security continues to ensure each
-- authenticated user receives only redemptions they are allowed to read.

do $$
begin
  alter publication supabase_realtime add table public.reward_redemptions;
exception
  when duplicate_object then null;
end $$;
