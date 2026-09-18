import { Quest, Reward } from './types';

export const initialQuests: Quest[] = [
  { id: 'bed', title: 'Make bed & tidy room', description: 'Start the day with a clear space', emoji: '🛏️', kind: 'daily', cadence: 'daily', scheduleLabel: 'Every day', status: 'rewarded', stars: 1, xp: 1 },
  { id: 'homework', title: 'Homework focus', description: 'Finish today’s schoolwork', emoji: '📚', kind: 'daily', cadence: 'daily', scheduleLabel: 'Mon–Fri', status: 'available', stars: 1, xp: 1, minimumAge: 8, maximumAge: 15 },
  { id: 'read', title: 'Reading adventure', description: 'Read without distractions', emoji: '📖', kind: 'timer', cadence: 'daily', scheduleLabel: 'Every day', status: 'available', stars: 1, xp: 1, timerMinutes: 20 },
  { id: 'outside', title: 'Outdoor explorer', description: 'Move, play, and get fresh air', emoji: '🌳', kind: 'timer', cadence: 'weekly', scheduleLabel: '3 times a week', status: 'available', stars: 2, xp: 2, timerMinutes: 30 },
  { id: 'cook', title: 'Help with dinner', description: 'A family co-op quest', emoji: '🍳', kind: 'guild', cadence: 'guild', scheduleLabel: 'Saturday', status: 'available', stars: 3, xp: 3, minimumAge: 10, maximumAge: 15 },
  { id: 'night', title: 'Night-time reset', description: 'Teeth, clothes, bag, and lights out', emoji: '🌙', kind: 'bedtime', cadence: 'daily', scheduleLabel: 'Every day · 8:30 PM', status: 'available', stars: 1, xp: 1, cutoffLabel: '8:30 PM' },
];

export const questCatalog: Quest[] = [
  ...initialQuests.map(quest => ({ ...quest, id: `catalog-${quest.id}`, catalogQuestId: `catalog-${quest.id}`, status: 'available' as const })),
  { id: 'catalog-laundry', catalogQuestId: 'catalog-laundry', title: 'Laundry helper', description: 'Sort, fold, and put away clean clothes', emoji: '🧺', kind: 'daily', cadence: 'weekly', scheduleLabel: 'Once a week', status: 'available', stars: 2, xp: 2, minimumAge: 8 },
  { id: 'catalog-dishes', catalogQuestId: 'catalog-dishes', title: 'Dish duty', description: 'Load or unload the dishwasher', emoji: '🍽️', kind: 'daily', cadence: 'daily', scheduleLabel: 'Every day', status: 'available', stars: 1, xp: 1, minimumAge: 8 },
  { id: 'catalog-pet', catalogQuestId: 'catalog-pet', title: 'Pet care', description: 'Feed, water, or tidy up after a pet', emoji: '🐾', kind: 'daily', cadence: 'daily', scheduleLabel: 'Every day', status: 'available', stars: 1, xp: 1, minimumAge: 7 },
];

export const rewards: Reward[] = [
  { id: 'screen', title: 'Extra screen time', emoji: '🎮', cost: 25, subtitle: '+1 hour this weekend' },
  { id: 'dessert', title: 'Special dessert', emoji: '🍦', cost: 35, subtitle: 'Choose the family treat' },
  { id: 'activity', title: 'Family activity', emoji: '⚽', cost: 40, subtitle: 'You pick the adventure' },
  { id: 'book', title: 'New book or game', emoji: '🎁', cost: 60, subtitle: 'Pick something special' },
];

export const rewardCatalog: Reward[] = [
  { id: 'catalog-screen-30', catalogRewardId: 'catalog-screen-30', title: 'Extra screen time', emoji: '🎮', cost: 20, subtitle: '30 bonus minutes after responsibilities are done' },
  { id: 'catalog-dessert', catalogRewardId: 'catalog-dessert', title: 'Choose dessert', emoji: '🍦', cost: 25, subtitle: 'Pick the family treat' },
  { id: 'catalog-movie', catalogRewardId: 'catalog-movie', title: 'Pick family movie', emoji: '🎬', cost: 30, subtitle: 'Choose the next family movie night' },
  { id: 'catalog-bedtime', catalogRewardId: 'catalog-bedtime', title: 'Stay up 30 minutes later', emoji: '🌙', cost: 35, subtitle: 'A special weekend bedtime extension' },
  { id: 'catalog-activity', catalogRewardId: 'catalog-activity', title: 'Choose a family activity', emoji: '⚽', cost: 40, subtitle: 'You pick the next family adventure' },
  { id: 'catalog-friend', catalogRewardId: 'catalog-friend', title: 'Invite a friend over', emoji: '🧑‍🤝‍🧑', cost: 50, subtitle: 'Plan a parent-approved visit' },
  { id: 'catalog-book', catalogRewardId: 'catalog-book', title: 'New book or small game', emoji: '📚', cost: 60, subtitle: 'Choose something special within the family budget' },
  { id: 'catalog-weekend', catalogRewardId: 'catalog-weekend', title: 'Weekend privilege', emoji: '🎟️', cost: 75, subtitle: 'Choose an agreed special weekend privilege' },
  { id: 'catalog-outing', catalogRewardId: 'catalog-outing', title: 'Special outing', emoji: '🗺️', cost: 100, subtitle: 'Plan one-on-one time with a parent' },
];

export const heroBadges = [
  { id: 'on-fire', emoji: '🔥', name: 'On Fire', earned: true },
  { id: 'team-player', emoji: '🤝', name: 'Team Player', earned: true },
  { id: 'bookworm', emoji: '📚', name: 'Bookworm', earned: true },
  { id: 'perfect-day', emoji: '🌟', name: 'Perfect Day', earned: true },
];

export const week = [
  { day: 'Mon', stars: 5, done: true }, { day: 'Tue', stars: 4, done: true },
  { day: 'Wed', stars: 5, done: true }, { day: 'Thu', stars: 3, done: true },
  { day: 'Fri', stars: 2, done: false }, { day: 'Sat', stars: 0, done: false },
  { day: 'Sun', stars: 0, done: false },
];
