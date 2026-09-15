export type HeroLevel = {
  level: number;
  minimumXp: number;
  title: string;
};

export const heroLevels: HeroLevel[] = [
  { level: 1, minimumXp: 0, title: 'Rookie Hero' },
  { level: 2, minimumXp: 100, title: 'Rising Hero' },
  { level: 3, minimumXp: 200, title: 'Home Hero' },
  { level: 4, minimumXp: 300, title: 'Legendary Leader' },
  { level: 5, minimumXp: 400, title: 'Ultimate Hero' },
];

export function getHeroLevelProgress(lifetimeXp: number) {
  const safeXp = Math.max(0, lifetimeXp);
  const currentIndex = heroLevels.findLastIndex(level => safeXp >= level.minimumXp);
  const current = heroLevels[Math.max(0, currentIndex)];
  const next = heroLevels[currentIndex + 1] ?? null;
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
