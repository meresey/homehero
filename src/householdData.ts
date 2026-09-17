import {
  BadgeDefinition,
  GuildApproval,
  HeroBadge,
  HeroBalance,
  HeroProfile,
  HeroSummary,
  Household,
  HouseholdState,
  QuestAssignment,
  RewardRequest,
} from './types';
import { initialQuests } from './data';

export const demoHousehold: Household = {
  id: 'household-kamau',
  name: 'Kamau Family',
  timezone: 'Africa/Nairobi',
  heroIds: ['hero-alex', 'hero-sam', 'hero-jamie'],
};

export const demoHeroes: HeroProfile[] = [
  { id: 'hero-alex', householdId: demoHousehold.id, displayName: 'Alex', avatarEmoji: '🦸', dateOfBirth: '2014-06-18', status: 'active', joinedAt: '2026-01-08T09:00:00.000Z' },
  { id: 'hero-sam', householdId: demoHousehold.id, displayName: 'Sam', avatarEmoji: '🧑‍🚀', dateOfBirth: '2016-02-12', status: 'active', joinedAt: '2026-02-12T09:00:00.000Z' },
  { id: 'hero-jamie', householdId: demoHousehold.id, displayName: 'Jamie', avatarEmoji: '🧙', dateOfBirth: '2018-03-03', status: 'active', joinedAt: '2026-03-03T09:00:00.000Z' },
];

export const demoHeroBalances: HeroBalance[] = [
  { heroId: 'hero-alex', stars: 19, lifetimeXp: 324 },
  { heroId: 'hero-sam', stars: 42, lifetimeXp: 218 },
  { heroId: 'hero-jamie', stars: 11, lifetimeXp: 86 },
];

export const demoBadgeDefinitions: BadgeDefinition[] = [
  { id: 'badge-on-fire', name: 'On Fire', description: 'Complete quests three days in a row.', emoji: '🔥' },
  { id: 'badge-team-player', name: 'Team Player', description: 'Complete a Guild Quest.', emoji: '🤝' },
  { id: 'badge-bookworm', name: 'Bookworm', description: 'Finish five reading quests.', emoji: '📚' },
  { id: 'badge-perfect-day', name: 'Perfect Day', description: 'Complete every daily quest.', emoji: '🌟' },
  { id: 'badge-early-bird', name: 'Early Bird', description: 'Finish a morning quest before 8 AM.', emoji: '🌅' },
];

export const demoHeroBadges: HeroBadge[] = [
  { heroId: 'hero-alex', badgeId: 'badge-on-fire', earnedAt: '2026-09-03T16:00:00.000Z' },
  { heroId: 'hero-alex', badgeId: 'badge-team-player', earnedAt: '2026-09-05T16:00:00.000Z' },
  { heroId: 'hero-alex', badgeId: 'badge-bookworm', earnedAt: '2026-09-08T16:00:00.000Z' },
  { heroId: 'hero-alex', badgeId: 'badge-perfect-day', earnedAt: '2026-09-10T16:00:00.000Z' },
  { heroId: 'hero-sam', badgeId: 'badge-team-player', earnedAt: '2026-09-06T16:00:00.000Z' },
  { heroId: 'hero-sam', badgeId: 'badge-early-bird', earnedAt: '2026-09-11T05:30:00.000Z' },
  { heroId: 'hero-jamie', badgeId: 'badge-bookworm', earnedAt: '2026-09-12T16:00:00.000Z' },
];

export const demoQuestAssignments: QuestAssignment[] = [
  { id: 'assignment-alex-bed', householdId: demoHousehold.id, questId: 'bed', heroId: 'hero-alex', assignedAt: '2026-09-01T06:00:00.000Z', active: true },
  { id: 'assignment-alex-read', householdId: demoHousehold.id, questId: 'read', heroId: 'hero-alex', assignedAt: '2026-09-01T06:00:00.000Z', active: true },
  { id: 'assignment-sam-homework', householdId: demoHousehold.id, questId: 'homework', heroId: 'hero-sam', assignedAt: '2026-09-01T06:00:00.000Z', active: true },
  { id: 'assignment-sam-cook', householdId: demoHousehold.id, questId: 'cook', heroId: 'hero-sam', assignedAt: '2026-09-01T06:00:00.000Z', active: true },
  { id: 'assignment-jamie-outside', householdId: demoHousehold.id, questId: 'outside', heroId: 'hero-jamie', assignedAt: '2026-09-01T06:00:00.000Z', active: true },
  { id: 'assignment-jamie-night', householdId: demoHousehold.id, questId: 'night', heroId: 'hero-jamie', assignedAt: '2026-09-01T06:00:00.000Z', active: true },
];

export const demoGuildApprovals: GuildApproval[] = [
  { id: 'approval-alex-cook', householdId: demoHousehold.id, heroId: 'hero-alex', questId: 'cook', submittedAt: '2026-09-15T15:42:00.000Z', status: 'pending', kind: 'guild' },
  { id: 'approval-sam-cook', householdId: demoHousehold.id, heroId: 'hero-sam', questId: 'cook', submittedAt: '2026-09-15T14:20:00.000Z', status: 'pending', kind: 'guild' },
];

export const demoRewardRequests: RewardRequest[] = [
  { id: 'request-jamie-dessert', householdId: demoHousehold.id, heroId: 'hero-jamie', rewardId: 'dessert', starCost: 35, requestedAt: '2026-09-15T13:30:00.000Z', status: 'pending' },
];

export const demoHeroSummaries: HeroSummary[] = [
  { heroId: 'hero-alex', displayName: 'Alex', avatarEmoji: '🦸', stars: 19, lifetimeXp: 324, earnedBadgeCount: 4, completedToday: 6, totalToday: 8, pendingApprovals: 1, pendingRewardRequests: 0, bedtimeQuestsDue: 0 },
  { heroId: 'hero-sam', displayName: 'Sam', avatarEmoji: '🧑‍🚀', stars: 42, lifetimeXp: 218, earnedBadgeCount: 2, completedToday: 5, totalToday: 7, pendingApprovals: 1, pendingRewardRequests: 0, bedtimeQuestsDue: 2 },
  { heroId: 'hero-jamie', displayName: 'Jamie', avatarEmoji: '🧙', stars: 11, lifetimeXp: 86, earnedBadgeCount: 1, completedToday: 3, totalToday: 5, pendingApprovals: 0, pendingRewardRequests: 1, bedtimeQuestsDue: 1 },
];

export const initialHouseholdState: HouseholdState = {
  questDate: new Date().toLocaleDateString('en-CA'),
  household: demoHousehold,
  heroes: demoHeroes,
  balances: demoHeroBalances,
  badgeDefinitions: demoBadgeDefinitions,
  heroBadges: demoHeroBadges,
  questAssignments: demoQuestAssignments,
  guildApprovals: demoGuildApprovals,
  rewardRequests: demoRewardRequests,
  completionHistory: [
    { id: 'completion-alex-bed-today', heroId: 'hero-alex', questId: 'bed', questTitle: 'Make bed & tidy room', questEmoji: '🛏️', questKind: 'daily', stars: 1, xp: 1, completedAt: new Date().toISOString() },
    { id: 'completion-sam-bed-today', heroId: 'hero-sam', questId: 'bed', questTitle: 'Make bed & tidy room', questEmoji: '🛏️', questKind: 'daily', stars: 1, xp: 1, completedAt: new Date().toISOString() },
    { id: 'completion-sam-homework-today', heroId: 'hero-sam', questId: 'homework', questTitle: 'Homework focus', questEmoji: '📚', questKind: 'daily', stars: 1, xp: 1, completedAt: new Date().toISOString() },
    { id: 'completion-jamie-bed-today', heroId: 'hero-jamie', questId: 'bed', questTitle: 'Make bed & tidy room', questEmoji: '🛏️', questKind: 'daily', stars: 1, xp: 1, completedAt: new Date().toISOString() },
  ],
  streakAwards: [],
  heroQuests: {
    'hero-alex': initialQuests.map(quest => ({ ...quest, id: `hero-alex-${quest.id}`, templateId: quest.id })),
    'hero-sam': initialQuests.map((quest, index) => ({ ...quest, id: `hero-sam-${quest.id}`, templateId: quest.id, status: index < 2 ? 'rewarded' : quest.id === 'cook' ? 'pending_approval' : 'available' })),
    'hero-jamie': initialQuests.map(quest => ({ ...quest, id: `hero-jamie-${quest.id}`, templateId: quest.id, status: quest.id === 'bed' ? 'rewarded' : 'available' })),
  },
  selectedHero: { scope: 'hero', heroId: 'hero-alex' },
};
