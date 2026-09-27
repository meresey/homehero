-- Present the spendable quest currency as Coins and the reward marketplace as
-- the Hero Shop. Badge keys and progress records stay unchanged so existing
-- achievements and balances are preserved.

update public.badge_definitions
set description = case key
  when 'goal-getter' then 'Reach a weekly coin goal.'
  when 'goal-starter' then 'Reach four weekly coin goals.'
  when 'goal-builder' then 'Reach 12 weekly coin goals.'
  when 'goal-champion' then 'Reach 26 weekly coin goals.'
  when 'year-of-goals' then 'Reach 52 weekly coin goals.'
  when 'goal-legend' then 'Reach 100 weekly coin goals.'
  when 'first-reward' then 'Have your first Hero Shop request approved.'
  when 'reward-planner' then 'Have five Hero Shop requests approved.'
  when 'star-shopper' then 'Have 25 Hero Shop requests approved.'
  when 'reward-master' then 'Have 100 Hero Shop requests approved.'
  else description
end,
name = case key
  when 'star-shopper' then 'Coin Shopper'
  else name
end,
icon_key = case key
  when 'star-shopper' then '🪙'
  else icon_key
end
where key in (
  'goal-getter',
  'goal-starter',
  'goal-builder',
  'goal-champion',
  'year-of-goals',
  'goal-legend',
  'first-reward',
  'reward-planner',
  'star-shopper',
  'reward-master'
);
