import type { Quest } from './types';

export const questWindowNames = {
  anytime: 'Anytime',
  morning: 'Morning',
  daytime: 'Daytime',
  bedtime: 'Bedtime',
} as const;

export type QuestWindow = keyof typeof questWindowNames;
type ScheduledWindow = Exclude<QuestWindow, 'anytime'>;
export type QuestHours = Record<ScheduledWindow, { start: string; end: string }>;
export const scheduledWindows = ['morning', 'daytime', 'bedtime'] as const;

export const defaultQuestHours: QuestHours = {
  morning: { start: '05:00', end: '09:00' },
  daytime: { start: '09:00', end: '18:00' },
  bedtime: { start: '19:00', end: '21:00' },
};

function secondsOfDay(clock: string) {
  const [hour, minute, second = 0] = clock.split(':').map(Number);
  return hour * 3600 + minute * 60 + second;
}

function legacyCutoffSeconds(label?: string) {
  const match = label?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return Infinity;
  const [, hour, minute, period] = match;
  const hours = period ? Number(hour) % 12 + (period.toUpperCase() === 'PM' ? 12 : 0) : Number(hour);
  return hours * 3600 + Number(minute) * 60;
}

export function validQuestHours(hours: QuestHours) {
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return scheduledWindows.every(window => {
    const { start, end } = hours[window];
    return clock.test(start) && clock.test(end) && start < end;
  });
}

export function questWindowFor(quest: Pick<Quest, 'window' | 'id' | 'templateId' | 'catalogQuestId' | 'kind'>): QuestWindow {
  if (quest.window) return quest.window;
  const key = quest.catalogQuestId ?? quest.templateId ?? quest.id;
  if (quest.kind === 'bedtime') return 'bedtime';
  if (['bed', 'catalog-bed'].includes(key)) return 'morning';
  if (['outside', 'homework', 'catalog-outside', 'catalog-homework'].includes(key)) return 'daytime';
  return 'anytime';
}

function timeLabel(clock: string) {
  const [hour, minute] = clock.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a.m.' : 'p.m.'}`;
}

export function questClock(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
}

export function questWindowState(
  quest: Quest, now: Date, clock: string, hours: QuestHours,
): { kind: 'open' | 'later' | 'closed'; label?: string } {
  if (quest.status === 'pending_approval' || quest.status === 'rewarded') return { kind: 'open' };
  const nowMs = now.getTime();
  const deadline = Math.min(quest.cutoffAt ? Date.parse(quest.cutoffAt) : Infinity, quest.expiresAt ? Date.parse(quest.expiresAt) : Infinity);
  const seconds = secondsOfDay(clock);
  const legacyCutoff = quest.cutoffAt ? Infinity : legacyCutoffSeconds(quest.cutoffLabel);
  if (quest.status === 'expired' || nowMs >= deadline || seconds >= legacyCutoff) return { kind: 'closed', label: 'Window closed' };
  const window = questWindowFor(quest);
  const duration = quest.kind === 'timer' && quest.status === 'available' ? (quest.timerMinutes ?? 20) * 60 : 0;
  if (window === 'anytime') return duration > 0 && (seconds + duration >= legacyCutoff || nowMs + duration * 1000 >= deadline)
    ? { kind: 'closed', label: 'Too late to start the timer' }
    : { kind: 'open' };

  const { start, end } = hours[window];
  const closing = Math.min(secondsOfDay(end), legacyCutoff);
  if (seconds >= closing) return { kind: 'closed', label: 'Window closed' };
  if (seconds < secondsOfDay(start)) return { kind: 'later', label: `Opens at ${timeLabel(start)}` };
  if (duration > 0 && (seconds + duration >= closing || nowMs + duration * 1000 >= deadline)) {
    return { kind: 'closed', label: 'Too late to start the timer' };
  }
  return { kind: 'open', label: closing < secondsOfDay(end) ? undefined : `Closes at ${timeLabel(end)}` };
}
