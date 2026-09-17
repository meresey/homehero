import { Quest } from './types';

export function calculateAge(dateOfBirth: string, today = new Date()) {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
}

export function isQuestAgeAppropriate(quest: Pick<Quest, 'minimumAge' | 'maximumAge'>, dateOfBirth: string) {
  const age = calculateAge(dateOfBirth);
  if (age == null) return true;
  return (quest.minimumAge == null || age >= quest.minimumAge) && (quest.maximumAge == null || age <= quest.maximumAge);
}

export function formatQuestAgeRange(quest: Pick<Quest, 'minimumAge' | 'maximumAge'>) {
  if (quest.minimumAge == null && quest.maximumAge == null) return 'All ages';
  if (quest.minimumAge == null) return `Up to age ${quest.maximumAge}`;
  if (quest.maximumAge == null) return `Age ${quest.minimumAge}+`;
  if (quest.minimumAge === quest.maximumAge) return `Age ${quest.minimumAge}`;
  return `Ages ${quest.minimumAge}–${quest.maximumAge}`;
}
