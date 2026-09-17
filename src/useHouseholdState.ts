import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialHouseholdState } from './householdData';
import { HeroBalance, HeroProfile, HeroSummary, HouseholdState, Quest } from './types';
import { isQuestAgeAppropriate } from './ageEligibility';

const HOUSEHOLD_STORAGE_KEY = 'home-hero.household.v2';

export function useHouseholdState() {
  const [state, setState] = useState<HouseholdState>(initialHouseholdState);
  const [hydrated, setHydrated] = useState(false);
  const selectedHeroId = state.selectedHero.heroId ?? state.heroes[0]?.id;
  const selectedHero = state.heroes.find(hero => hero.id === selectedHeroId) ?? state.heroes[0];
  const selectedBalance = state.balances.find(balance => balance.heroId === selectedHero?.id) ?? emptyBalance(selectedHero?.id);
  const selectedAllQuests = state.heroQuests[selectedHero?.id] ?? [];
  const selectedQuests = selectedAllQuests.filter(quest => {
    const templateId = quest.templateId ?? quest.id;
    return state.questAssignments.some(assignment => assignment.heroId === selectedHero?.id && assignment.questId === templateId && assignment.active)
      && isQuestAgeAppropriate(quest, selectedHero?.dateOfBirth ?? '');
  });
  const selectedBadges = state.heroBadges
    .filter(earned => earned.heroId === selectedHero?.id)
    .map(earned => state.badgeDefinitions.find(badge => badge.id === earned.badgeId))
    .filter((badge): badge is NonNullable<typeof badge> => Boolean(badge));

  const setSelectedHero = (heroId: string) => setState(current => ({ ...current, selectedHero: { scope: 'hero', heroId } }));
  const setSelectedHeroQuests: Dispatch<SetStateAction<Quest[]>> = update => setState(current => {
    const heroId = current.selectedHero.heroId ?? current.heroes[0]?.id;
    const previous = current.heroQuests[heroId] ?? [];
    const next = typeof update === 'function' ? update(previous) : update;
    return { ...current, heroQuests: { ...current.heroQuests, [heroId]: next } };
  });
  const updateSelectedBalance = (field: 'stars' | 'lifetimeXp', update: SetStateAction<number>) => setState(current => {
    const heroId = current.selectedHero.heroId ?? current.heroes[0]?.id;
    return { ...current, balances: current.balances.map(balance => balance.heroId === heroId ? { ...balance, [field]: typeof update === 'function' ? update(balance[field]) : update } : balance) };
  });
  const startTimerQuest = (quest: Quest, startedAt: string, endsAt: string) => setState(current => {
    const heroId = current.selectedHero.heroId ?? current.heroes[0]?.id;
    return { ...current, heroQuests: { ...current.heroQuests, [heroId]: (current.heroQuests[heroId] ?? []).map(item => item.id === quest.id ? { ...item, status: 'in_progress', timerStartedAt: startedAt, timerEndsAt: endsAt, timerCompletedAt: undefined } : item) } };
  });
  const awardQuest = (quest: Quest) => setState(current => {
    const heroId = current.selectedHero.heroId ?? current.heroes[0]?.id;
    const storedQuest = (current.heroQuests[heroId] ?? []).find(item => item.id === quest.id);
    if (!storedQuest || storedQuest.status === 'rewarded') return current;
    const completedAt = new Date().toISOString();
    const questId = storedQuest.templateId ?? storedQuest.id;
    return {
      ...current,
      heroQuests: { ...current.heroQuests, [heroId]: (current.heroQuests[heroId] ?? []).map(item => item.id === quest.id ? { ...item, status: 'rewarded', completedAt, timerEndsAt: undefined } : item) },
      balances: current.balances.map(item => item.heroId === heroId ? { ...item, stars: item.stars + storedQuest.stars, lifetimeXp: item.lifetimeXp + storedQuest.xp } : item),
      completionHistory: current.completionHistory.some(item => item.heroId === heroId && item.questId === questId && localDate(item.completedAt) === localDate(completedAt)) ? current.completionHistory : [...current.completionHistory, { id: `completion-${heroId}-${questId}-${Date.now()}`, heroId, questId, questTitle: storedQuest.title, questEmoji: storedQuest.emoji, questKind: storedQuest.kind, stars: storedQuest.stars, xp: storedQuest.xp, completedAt }],
    };
  });
  const submitGuildQuest = (quest: Quest) => setState(current => {
    const heroId = current.selectedHero.heroId ?? current.heroes[0]?.id;
    const templateId = quest.templateId ?? quest.id;
    const alreadyPending = current.guildApprovals.some(item => item.heroId === heroId && item.questId === templateId && item.status === 'pending');
    return {
      ...current,
      heroQuests: { ...current.heroQuests, [heroId]: (current.heroQuests[heroId] ?? []).map(item => item.id === quest.id ? { ...item, status: 'pending_approval' } : item) },
      guildApprovals: alreadyPending ? current.guildApprovals : [...current.guildApprovals, { id: `approval-${heroId}-${templateId}-${Date.now()}`, householdId: current.household.id, heroId, questId: templateId, submittedAt: new Date().toISOString(), status: 'pending', kind: 'guild' }],
    };
  });
  const finishTimerQuest = (quest: Quest) => setState(current => submitFinishedTimer(current, current.selectedHero.heroId ?? current.heroes[0]?.id, quest.id, new Date()));
  const requestReward = (rewardId: string, starCost: number) => setState(current => {
    const heroId = current.selectedHero.heroId ?? current.heroes[0]?.id;
    if (current.rewardRequests.some(item => item.heroId === heroId && item.rewardId === rewardId && item.status === 'pending')) return current;
    return { ...current, rewardRequests: [...current.rewardRequests, { id: `request-${heroId}-${rewardId}-${Date.now()}`, householdId: current.household.id, heroId, rewardId, starCost, requestedAt: new Date().toISOString(), status: 'pending' }] };
  });
  const reviewRewardRequest = (requestId: string, approve: boolean) => {
    const request = state.rewardRequests.find(item => item.id === requestId && item.status === 'pending');
    if (!request) return 'missing' as const;
    const balance = state.balances.find(item => item.heroId === request.heroId);
    if (approve && (!balance || balance.stars < request.starCost)) return 'insufficient' as const;
    setState(current => ({
      ...current,
      balances: approve ? current.balances.map(item => item.heroId === request.heroId ? { ...item, stars: item.stars - request.starCost } : item) : current.balances,
      rewardRequests: current.rewardRequests.map(item => item.id === requestId ? { ...item, status: approve ? 'approved' : 'declined' } : item),
    }));
    return approve ? 'approved' as const : 'declined' as const;
  };
  const reviewGuildApproval = (approvalId: string, approve: boolean) => {
    const approval = state.guildApprovals.find(item => item.id === approvalId && item.status === 'pending');
    if (!approval) return false;
    const quest = (state.heroQuests[approval.heroId] ?? []).find(item => (item.templateId ?? item.id) === approval.questId);
    if (approve && quest?.kind === 'timer' && (!quest.timerCompletedAt || !quest.timerEndsAt || new Date(quest.timerEndsAt).getTime() > Date.now())) return false;
    setState(current => {
      const completedAt = new Date().toISOString();
      return {
        ...current,
        guildApprovals: current.guildApprovals.map(item => item.id === approvalId ? { ...item, status: approve ? 'approved' : 'rejected' } : item),
        heroQuests: { ...current.heroQuests, [approval.heroId]: (current.heroQuests[approval.heroId] ?? []).map(item => (item.templateId ?? item.id) === approval.questId ? { ...item, status: approve ? 'rewarded' : 'available', completedAt: approve ? completedAt : undefined, timerStartedAt: approve ? item.timerStartedAt : undefined, timerEndsAt: approve ? item.timerEndsAt : undefined, timerCompletedAt: approve ? item.timerCompletedAt : undefined } : item) },
        balances: approve && quest ? current.balances.map(item => item.heroId === approval.heroId ? { ...item, stars: item.stars + quest.stars, lifetimeXp: item.lifetimeXp + quest.xp } : item) : current.balances,
        completionHistory: approve && quest ? [...current.completionHistory, { id: `completion-${approval.heroId}-${approval.questId}-${Date.now()}`, heroId: approval.heroId, questId: approval.questId, questTitle: quest.title, questEmoji: quest.emoji, questKind: quest.kind, stars: quest.stars, xp: quest.xp, completedAt }] : current.completionHistory,
      };
    });
    return true;
  };
  const saveHouseholdQuest = (quest: Quest, heroIds: string[]) => setState(current => {
    const templateId = quest.templateId ?? quest.id;
    const template: Quest = { ...quest, id: templateId, templateId: undefined, instanceId: undefined, householdId: current.household.id, visibility: 'household', status: 'available', timerStartedAt: undefined, timerEndsAt: undefined, timerCompletedAt: undefined, completedAt: undefined, expiredAt: undefined };
    const eligibleIds = new Set(current.heroes.filter(hero => heroIds.includes(hero.id) && isQuestAgeAppropriate(template, hero.dateOfBirth)).map(hero => hero.id));
    const now = new Date().toISOString();
    const questTemplates = current.questTemplates.some(item => item.id === templateId)
      ? current.questTemplates.map(item => item.id === templateId ? template : item)
      : [template, ...current.questTemplates];
    const questAssignments = [
      ...current.questAssignments.filter(item => item.questId !== templateId),
      ...[...eligibleIds].map(heroId => ({ id: `assignment-${heroId}-${templateId}`, householdId: current.household.id, questId: templateId, heroId, assignedAt: now, active: true })),
    ];
    const heroQuests = Object.fromEntries(current.heroes.map(hero => {
      const existing = (current.heroQuests[hero.id] ?? []).find(item => (item.templateId ?? item.id) === templateId);
      const other = (current.heroQuests[hero.id] ?? []).filter(item => (item.templateId ?? item.id) !== templateId);
      if (!eligibleIds.has(hero.id)) return [hero.id, other];
      const instance: Quest = { ...template, ...(existing ? { status: existing.status, timerStartedAt: existing.timerStartedAt, timerEndsAt: existing.timerEndsAt, timerCompletedAt: existing.timerCompletedAt, completedAt: existing.completedAt, expiredAt: existing.expiredAt } : {}), id: existing?.id ?? `${hero.id}-${templateId}`, templateId };
      return [hero.id, [instance, ...other]];
    }));
    const guildApprovals = current.guildApprovals.filter(item => item.questId !== templateId || item.status !== 'pending' || eligibleIds.has(item.heroId));
    return { ...current, questTemplates, questAssignments, heroQuests, guildApprovals };
  });
  const removeHouseholdQuest = (questId: string) => setState(current => ({
    ...current,
    questTemplates: current.questTemplates.filter(item => item.id !== questId),
    questAssignments: current.questAssignments.filter(item => item.questId !== questId),
    guildApprovals: current.guildApprovals.filter(item => item.questId !== questId || item.status !== 'pending'),
    heroQuests: Object.fromEntries(Object.entries(current.heroQuests).map(([heroId, quests]) => [heroId, quests.filter(item => (item.templateId ?? item.id) !== questId)])),
  }));

  useEffect(() => {
    AsyncStorage.getItem(HOUSEHOLD_STORAGE_KEY)
      .then(saved => { if (saved) { const parsed = JSON.parse(saved) as Partial<HouseholdState>; setState(normalizeHouseholdState({ ...initialHouseholdState, ...parsed } as HouseholdState, !parsed.questTemplates)); } })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(HOUSEHOLD_STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    const processDeadlines = () => setState(current => { const now = new Date(); return completeFinishedTimers(expireBedtimeQuests(rolloverDailyQuests(current, now), now), now); });
    processDeadlines();
    const interval = setInterval(processDeadlines, 1_000);
    return () => clearInterval(interval);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setState(current => awardCompletedStreaks(current));
  }, [hydrated, state.completionHistory]);

  const summaries = useMemo(() => state.heroes.map(hero => buildSummary(state, hero)), [state]);

  return {
    state,
    hydrated,
    selectedHero,
    selectedBalance,
    selectedAllQuests,
    selectedQuests,
    selectedBadges,
    summaries,
    questTemplates: state.questTemplates,
    setSelectedHero,
    setSelectedHeroQuests,
    startTimerQuest,
    finishTimerQuest,
    awardQuest,
    submitGuildQuest,
    requestReward,
    reviewRewardRequest,
    reviewGuildApproval,
    saveHouseholdQuest,
    removeHouseholdQuest,
    setSelectedStars: (update: SetStateAction<number>) => updateSelectedBalance('stars', update),
    setSelectedXp: (update: SetStateAction<number>) => updateSelectedBalance('lifetimeXp', update),
  };
}

function localDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function cutoffFor(date: Date, label: string) {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  const cutoff = new Date(date);
  cutoff.setHours(hour, minute, 0, 0);
  return cutoff;
}

function expireBedtimeQuests(state: HouseholdState, now: Date) {
  let changed = false;
  const heroQuests = Object.fromEntries(Object.entries(state.heroQuests).map(([heroId, quests]) => [heroId, quests.map(quest => {
    if (quest.kind !== 'bedtime' || !['available', 'in_progress'].includes(quest.status) || !quest.cutoffLabel) return quest;
    const cutoff = cutoffFor(now, quest.cutoffLabel);
    if (!cutoff || now < cutoff) return quest;
    changed = true;
    return { ...quest, status: 'expired' as const, expiredAt: now.toISOString(), timerEndsAt: undefined, timerCompletedAt: undefined };
  })]));
  return changed ? { ...state, heroQuests } : state;
}

function rolloverDailyQuests(state: HouseholdState, now: Date) {
  const today = localDate(now);
  if (state.questDate === today) return state;
  const heroQuests = Object.fromEntries(Object.entries(state.heroQuests).map(([heroId, quests]) => [heroId, quests.map(quest => {
    if (quest.status === 'pending_approval' || (quest.cadence !== 'daily' && quest.kind !== 'bedtime')) return quest;
    return { ...quest, status: 'available' as const, completedAt: undefined, expiredAt: undefined, timerStartedAt: undefined, timerEndsAt: undefined, timerCompletedAt: undefined };
  })]));
  return { ...state, questDate: today, heroQuests };
}

function completeFinishedTimers(state: HouseholdState, now: Date) {
  let changed = false;
  let next = state;
  Object.entries(state.heroQuests).forEach(([heroId, quests]) => quests.forEach(quest => {
    if (quest.kind === 'timer' && quest.status === 'in_progress' && quest.timerEndsAt && new Date(quest.timerEndsAt) <= now) {
      next = submitFinishedTimer(next, heroId, quest.id, now);
      changed = true;
    }
  }));
  return changed ? next : state;
}

function submitFinishedTimer(state: HouseholdState, heroId: string, questInstanceId: string, now: Date): HouseholdState {
  const quest = (state.heroQuests[heroId] ?? []).find(item => item.id === questInstanceId);
  if (!quest || quest.kind !== 'timer' || quest.status === 'pending_approval' || quest.status === 'rewarded' || !quest.timerEndsAt || new Date(quest.timerEndsAt) > now) return state;
  const questId = quest.templateId ?? quest.id;
  const alreadyPending = state.guildApprovals.some(item => item.heroId === heroId && item.questId === questId && item.status === 'pending');
  return {
    ...state,
    heroQuests: { ...state.heroQuests, [heroId]: (state.heroQuests[heroId] ?? []).map(item => item.id === questInstanceId ? { ...item, status: 'pending_approval' as const, timerCompletedAt: now.toISOString() } : item) },
    guildApprovals: alreadyPending ? state.guildApprovals : [...state.guildApprovals, { id: `approval-${heroId}-${questId}-${now.getTime()}`, householdId: state.household.id, heroId, questId, submittedAt: now.toISOString(), status: 'pending' as const, kind: 'timer' as const }],
  };
}

function awardCompletedStreaks(state: HouseholdState) {
  const groups = new Map<string, Set<string>>();
  state.completionHistory.filter(item => item.questKind !== 'guild').forEach(item => {
    const completed = new Date(item.completedAt);
    const day = completed.getDay() || 7;
    const monday = new Date(completed);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(completed.getDate() - day + 1);
    const weekStart = localDate(monday);
    const key = `${item.heroId}|${item.questId}|${weekStart}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)?.add(localDate(completed));
  });
  const eligible = [...groups.entries()].filter(([, dates]) => dates.size === 7).filter(([key]) => {
    const [heroId, questId, weekStart] = key.split('|');
    return !state.streakAwards.some(item => item.heroId === heroId && item.questId === questId && item.weekStart === weekStart);
  });
  if (!eligible.length) return state;
  const now = new Date().toISOString();
  const awards = eligible.map(([key]) => { const [heroId, questId, weekStart] = key.split('|'); return { id: `streak-${heroId}-${questId}-${weekStart}`, heroId, questId, weekStart, xpAwarded: 5, awardedAt: now }; });
  return { ...state, streakAwards: [...state.streakAwards, ...awards], balances: state.balances.map(balance => ({ ...balance, lifetimeXp: balance.lifetimeXp + awards.filter(item => item.heroId === balance.heroId).reduce((sum, item) => sum + item.xpAwarded, 0) })) };
}

function emptyBalance(heroId = ''): HeroBalance { return { heroId, stars: 0, lifetimeXp: 0 }; }

function buildSummary(state: HouseholdState, hero: HeroProfile): HeroSummary {
  const balance = state.balances.find(item => item.heroId === hero.id) ?? emptyBalance(hero.id);
  const quests = (state.heroQuests[hero.id] ?? []).filter(quest => state.questAssignments.some(assignment => assignment.heroId === hero.id && assignment.questId === (quest.templateId ?? quest.id) && assignment.active) && isQuestAgeAppropriate(quest, hero.dateOfBirth));
  return {
    heroId: hero.id,
    displayName: hero.displayName,
    avatarEmoji: hero.avatarEmoji,
    stars: balance.stars,
    lifetimeXp: balance.lifetimeXp,
    earnedBadgeCount: state.heroBadges.filter(item => item.heroId === hero.id).length,
    completedToday: quests.filter(quest => quest.status === 'rewarded').length,
    totalToday: quests.length,
    pendingApprovals: quests.filter(quest => quest.status === 'pending_approval').length,
    pendingRewardRequests: state.rewardRequests.filter(request => request.heroId === hero.id && request.status === 'pending').length,
    bedtimeQuestsDue: quests.filter(quest => quest.kind === 'bedtime' && ['available', 'in_progress'].includes(quest.status)).length,
  };
}

function normalizeHouseholdState(state: HouseholdState, legacy = false): HouseholdState {
  const questTemplates = state.questTemplates?.length ? state.questTemplates : initialHouseholdState.questTemplates;
  const questAssignments = legacy ? state.heroes.flatMap(hero => questTemplates.filter(quest => isQuestAgeAppropriate(quest, hero.dateOfBirth)).map(quest => ({ id: `assignment-${hero.id}-${quest.id}`, householdId: state.household.id, questId: quest.id, heroId: hero.id, assignedAt: new Date().toISOString(), active: true }))) : state.questAssignments;
  return { ...state, questTemplates, questAssignments };
}
