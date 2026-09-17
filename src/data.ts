import { Quest, Reward } from './types';

export const initialQuests: Quest[] = [
  { id: 'bed', title: 'Make bed & tidy room', description: 'Start the day with a clear space', emoji: '🛏️', kind: 'daily', cadence: 'daily', scheduleLabel: 'Every day', status: 'rewarded', stars: 1, xp: 1 },
  { id: 'homework', title: 'Homework focus', description: 'Finish today’s schoolwork', emoji: '📚', kind: 'daily', cadence: 'daily', scheduleLabel: 'Mon–Fri', status: 'available', stars: 1, xp: 1, minimumAge: 8, maximumAge: 15 },
  { id: 'read', title: 'Reading adventure', description: 'Read without distractions', emoji: '📖', kind: 'timer', cadence: 'daily', scheduleLabel: 'Every day', status: 'available', stars: 1, xp: 1, timerMinutes: 20 },
  { id: 'outside', title: 'Outdoor explorer', description: 'Move, play, and get fresh air', emoji: '🌳', kind: 'timer', cadence: 'weekly', scheduleLabel: '3 times a week', status: 'available', stars: 2, xp: 2, timerMinutes: 30 },
  { id: 'cook', title: 'Help with dinner', description: 'A family co-op quest', emoji: '🍳', kind: 'guild', cadence: 'guild', scheduleLabel: 'Saturday', status: 'available', stars: 3, xp: 3, minimumAge: 10, maximumAge: 15 },
  { id: 'night', title: 'Night-time reset', description: 'Teeth, clothes, bag, and lights out', emoji: '🌙', kind: 'bedtime', cadence: 'daily', scheduleLabel: 'Every day · 8:30 PM', status: 'available', stars: 1, xp: 1, cutoffLabel: '8:30 PM' },
];

export const rewards: Reward[] = [
  { id: 'screen', title: 'Extra screen time', emoji: '🎮', cost: 25, subtitle: '+1 hour this weekend' },
  { id: 'dessert', title: 'Special dessert', emoji: '🍦', cost: 35, subtitle: 'Choose the family treat' },
  { id: 'activity', title: 'Family activity', emoji: '⚽', cost: 40, subtitle: 'You pick the adventure' },
  { id: 'book', title: 'New book or game', emoji: '🎁', cost: 60, subtitle: 'Pick something special' },
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
