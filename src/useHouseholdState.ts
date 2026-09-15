import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { initialHouseholdState } from './householdData';
import { HeroBalance, HeroProfile, HeroSummary, HouseholdState, Quest } from './types';

export function useHouseholdState() {
  const [state, setState] = useState<HouseholdState>(initialHouseholdState);
  const selectedHeroId = state.selectedHero.heroId ?? state.heroes[0]?.id;
  const selectedHero = state.heroes.find(hero => hero.id === selectedHeroId) ?? state.heroes[0];
  const selectedBalance = state.balances.find(balance => balance.heroId === selectedHero?.id) ?? emptyBalance(selectedHero?.id);
  const selectedQuests = state.heroQuests[selectedHero?.id] ?? [];
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

  const summaries = useMemo(() => state.heroes.map(hero => buildSummary(state, hero)), [state]);

  return {
    state,
    selectedHero,
    selectedBalance,
    selectedQuests,
    selectedBadges,
    summaries,
    setSelectedHero,
    setSelectedHeroQuests,
    setSelectedStars: (update: SetStateAction<number>) => updateSelectedBalance('stars', update),
    setSelectedXp: (update: SetStateAction<number>) => updateSelectedBalance('lifetimeXp', update),
  };
}

function emptyBalance(heroId = ''): HeroBalance { return { heroId, stars: 0, lifetimeXp: 0 }; }

function buildSummary(state: HouseholdState, hero: HeroProfile): HeroSummary {
  const balance = state.balances.find(item => item.heroId === hero.id) ?? emptyBalance(hero.id);
  const quests = state.heroQuests[hero.id] ?? [];
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
