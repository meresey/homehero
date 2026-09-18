-- Restore PostgREST privileges after rebuilding the public schema.
-- Row Level Security remains the authority for which records users can access.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant usage, select, update
  on all sequences in schema public
  to authenticated;

grant all privileges
  on all tables in schema public
  to service_role;

grant all privileges
  on all sequences in schema public
  to service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges for role postgres in schema public
  grant usage, select, update on sequences to authenticated;

alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;

alter default privileges for role postgres in schema public
  grant all privileges on sequences to service_role;
