-- Keep already-initialized projects aligned with the client progression.
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
