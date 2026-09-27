import { QuestKind } from './types';

export const QUEST_XP_BY_KIND: Record<QuestKind, number> = {
  daily: 1,
  bedtime: 1,
  timer: 2,
  guild: 3,
};

export function questXpForKind(kind: QuestKind) {
  return QUEST_XP_BY_KIND[kind];
}
