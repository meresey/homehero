export type QuestKind = 'daily' | 'timer' | 'guild' | 'bedtime';
export type QuestStatus = 'available' | 'in_progress' | 'pending_approval' | 'rewarded' | 'expired';

export type Quest = {
  id: string;
  templateId?: string;
  instanceId?: string;
  title: string;
  description: string;
  emoji: string;
  kind: QuestKind;
  status: QuestStatus;
  stars: number;
  xp: number;
  timerMinutes?: number;
  cutoffLabel?: string;
  cadence?: 'daily' | 'weekly' | 'guild';
  scheduleLabel?: string;
  minimumAge?: number;
  maximumAge?: number;
  timerStartedAt?: string;
  timerEndsAt?: string;
  timerCompletedAt?: string;
  completedAt?: string;
  expiredAt?: string;
  householdId?: string;
  catalogQuestId?: string;
  visibility?: 'household';
};

export type QuestCatalogItem = Quest & { catalogQuestId: string };

export type Reward = { id: string; title: string; emoji: string; cost: number; subtitle: string };

export type Household = {
  id: string;
  name: string;
  timezone: string;
  heroIds: string[];
};

export type HeroProfile = {
  id: string;
  householdId: string;
  displayName: string;
  avatarEmoji: string;
  dateOfBirth: string;
  status: 'active' | 'paused';
  joinedAt: string;
};

export type HeroBalance = {
  heroId: string;
  stars: number;
  lifetimeXp: number;
};

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  emoji: string;
};

export type HeroBadge = {
  heroId: string;
  badgeId: string;
  earnedAt: string;
};

export type QuestAssignment = {
  id: string;
  householdId: string;
  questId: string;
  heroId: string;
  assignedAt: string;
  active: boolean;
};

export type GuildApproval = {
  id: string;
  householdId: string;
  heroId: string;
  questId: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  kind?: 'guild' | 'timer';
  note?: string;
};

export type RewardRequest = {
  id: string;
  householdId: string;
  heroId: string;
  rewardId: string;
  starCost: number;
  requestedAt: string;
  status: 'pending' | 'approved' | 'declined' | 'fulfilled';
};

export type QuestCompletion = {
  id: string;
  heroId: string;
  questId: string;
  questTitle: string;
  questEmoji: string;
  questKind: QuestKind;
  stars: number;
  xp: number;
  completedAt: string;
};

export type StreakAward = {
  id: string;
  heroId: string;
  questId: string;
  weekStart: string;
  xpAwarded: number;
  awardedAt: string;
};

export type HeroSummary = {
  heroId: string;
  displayName: string;
  avatarEmoji: string;
  stars: number;
  lifetimeXp: number;
  earnedBadgeCount: number;
  completedToday: number;
  totalToday: number;
  pendingApprovals: number;
  pendingRewardRequests: number;
  bedtimeQuestsDue: number;
};

export type HeroSelection = {
  scope: 'all' | 'hero';
  heroId: string | null;
};

export type HouseholdState = {
  questDate: string;
  household: Household;
  heroes: HeroProfile[];
  balances: HeroBalance[];
  badgeDefinitions: BadgeDefinition[];
  heroBadges: HeroBadge[];
  questAssignments: QuestAssignment[];
  guildApprovals: GuildApproval[];
  rewardRequests: RewardRequest[];
  completionHistory: QuestCompletion[];
  streakAwards: StreakAward[];
  questTemplates: Quest[];
  heroQuests: Record<string, Quest[]>;
  selectedHero: HeroSelection;
};
