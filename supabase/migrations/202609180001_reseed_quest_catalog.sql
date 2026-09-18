-- Restore the built-in Quest Library if catalog data is missing.
-- Updating on conflict also keeps existing installations aligned with defaults.

insert into public.quest_catalog(
  slug,title,description,icon_key,kind,cadence,schedule_label,
  star_reward,xp_reward,timer_seconds,minimum_age,maximum_age,is_active
)
values
  ('make-bed','Make bed & tidy room','Start the day with a clear space','🛏️','daily','daily','Every day',1,1,null,null,null,true),
  ('homework','Homework focus','Finish today''s schoolwork','📚','daily','daily','Mon–Fri',1,1,null,8,15,true),
  ('reading','Reading adventure','Read without distractions','📖','timer','daily','Every day',1,1,1200,null,null,true),
  ('outside','Outdoor explorer','Move, play, and get fresh air','🌳','timer','weekly','3 times a week',2,2,1800,null,null,true),
  ('dinner','Help with dinner','A family co-op quest','🍳','guild','guild','Saturday',3,3,null,10,15,true),
  ('laundry','Laundry helper','Sort, fold, and put away clean clothes','🧺','daily','weekly','Once a week',2,2,null,8,null,true),
  ('dishes','Dish duty','Load or unload the dishwasher','🍽️','daily','daily','Every day',1,1,null,8,null,true),
  ('pet-care','Pet care','Feed, water, or tidy up after a pet','🐾','daily','daily','Every day',1,1,null,7,null,true)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  icon_key = excluded.icon_key,
  kind = excluded.kind,
  cadence = excluded.cadence,
  schedule_label = excluded.schedule_label,
  star_reward = excluded.star_reward,
  xp_reward = excluded.xp_reward,
  timer_seconds = excluded.timer_seconds,
  minimum_age = excluded.minimum_age,
  maximum_age = excluded.maximum_age,
  is_active = true;
