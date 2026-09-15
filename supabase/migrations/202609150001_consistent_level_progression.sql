-- Keep already-initialized projects aligned with the client progression.
alter table public.level_definitions add column if not exists characteristics text[] not null default '{}';

update public.level_definitions set minimum_xp = minimum_xp + 10000;

update public.level_definitions
set minimum_xp = case level
  when 1 then 0
  when 2 then 100
  when 3 then 200
  when 4 then 300
  when 5 then 400
end
where level between 1 and 5;

update public.level_definitions set characteristics = case level
  when 1 then array['Ready','Brave','Learning']
  when 2 then array['Helpful','Focused','Growing']
  when 3 then array['Dependable','Curious','Kind']
  when 4 then array['Responsible','Supportive','Confident']
  when 5 then array['Inspiring','Consistent','Trusted']
end
where level between 1 and 5;
