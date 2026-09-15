export type HeroLevel = {
  level: number;
  minimumXp: number;
  title: string;
  characteristics: string[];
};

export const heroLevels: HeroLevel[] = [
  { level: 1, minimumXp: 0, title: 'Rookie Hero', characteristics: ['Ready', 'Brave', 'Learning'] },
  { level: 2, minimumXp: 100, title: 'Rising Hero', characteristics: ['Helpful', 'Focused', 'Growing'] },
  { level: 3, minimumXp: 200, title: 'Home Hero', characteristics: ['Dependable', 'Curious', 'Kind'] },
  { level: 4, minimumXp: 300, title: 'Legendary Leader', characteristics: ['Responsible', 'Supportive', 'Confident'] },
  { level: 5, minimumXp: 400, title: 'Ultimate Hero', characteristics: ['Inspiring', 'Consistent', 'Trusted'] },
];

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
