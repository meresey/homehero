export type HeroLevel = {
  level: number;
  minimumXp: number;
  title: string;
  characteristics: string[];
};

const heroRanks = [
  { title: 'Rookie Hero', characteristics: ['Ready', 'Brave', 'Learning'] },
  { title: 'Rising Hero', characteristics: ['Helpful', 'Focused', 'Growing'] },
  { title: 'Habit Hero', characteristics: ['Dependable', 'Curious', 'Kind'] },
  { title: 'Quest Keeper', characteristics: ['Steady', 'Resourceful', 'Caring'] },
  { title: 'Trailblazer', characteristics: ['Bold', 'Creative', 'Capable'] },
  { title: 'Hero Champion', characteristics: ['Committed', 'Skilled', 'Positive'] },
  { title: 'Household Guardian', characteristics: ['Reliable', 'Thoughtful', 'Prepared'] },
  { title: 'Hero Master', characteristics: ['Wise', 'Resilient', 'Generous'] },
  { title: 'Legendary Leader', characteristics: ['Responsible', 'Supportive', 'Confident'] },
  { title: 'Ultimate Hero', characteristics: ['Inspiring', 'Consistent', 'Trusted'] },
] as const;

export function xpForLevel(level: number) {
  const safeLevel = Math.min(50, Math.max(1, Math.floor(level)));
  return 25 * safeLevel * (safeLevel - 1);
}

export const heroLevels: HeroLevel[] = Array.from({ length: 50 }, (_, index) => {
  const level = index + 1;
  const rank = heroRanks[Math.floor(index / 5)];
  return { level, minimumXp: xpForLevel(level), title: rank.title, characteristics: [...rank.characteristics] };
});

export function getHeroLevelProgress(lifetimeXp: number, levels: HeroLevel[] = heroLevels) {
  const safeXp = Math.max(0, lifetimeXp);
  const orderedLevels = [...levels].sort((a, b) => a.minimumXp - b.minimumXp);
  const currentIndex = orderedLevels.findLastIndex(level => safeXp >= level.minimumXp);
  const current = orderedLevels[Math.max(0, currentIndex)];
  const next = orderedLevels[currentIndex + 1] ?? null;
  const earnedThisLevel = safeXp - current.minimumXp;
  const levelRange = next ? next.minimumXp - current.minimumXp : 1;

  return {
    current,
    next,
    earnedThisLevel: next ? earnedThisLevel : 1,
    levelRange,
    remainingXp: next ? Math.max(0, next.minimumXp - safeXp) : 0,
    lifetimeXp: safeXp,
  };
}
