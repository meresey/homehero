import { defaultQuestHours, questClock, questWindowFor, questWindowState, validQuestHours } from '../questWindows';
import type { Quest } from '../types';

const quest: Quest = {
  id: 'bed', title: 'Make the bed', description: '', emoji: '🛏️',
  kind: 'daily', status: 'available', stars: 1, xp: 1,
};

function at(time: string, updates: Partial<Quest> = {}) {
  const now = new Date(`2026-11-17T${time}+03:00`);
  return questWindowState({ ...quest, ...updates }, now, questClock(now, 'Africa/Nairobi'), defaultQuestHours);
}

test('opens on the household clock and closes exactly at the cutoff', () => {
  expect(at('04:59:59')).toEqual({ kind: 'later', label: 'Opens at 5:00 a.m.' });
  expect(at('05:00:00').kind).toBe('open');
  expect(at('08:59:59').kind).toBe('open');
  expect(at('09:00:00').kind).toBe('closed');
  expect(at('18:59:59', { window: 'bedtime' }).kind).toBe('later');
});

test('accounts for the full timer and keeps previously submitted quests visible', () => {
  expect(at('08:39:59', { kind: 'timer', timerMinutes: 20 }).kind).toBe('open');
  expect(at('08:40:00', { kind: 'timer', timerMinutes: 20 }).label).toBe('Too late to start the timer');
  expect(at('08:55:00', { kind: 'timer', timerMinutes: 20, status: 'in_progress' }).kind).toBe('open');
  expect(at('09:10:00', { kind: 'timer', status: 'in_progress' }).kind).toBe('closed');
  expect(at('11:00:00', { status: 'pending_approval' }).kind).toBe('open');
  expect(at('21:00:00', { window: 'anytime', cutoffLabel: '8:30 PM' }).kind).toBe('closed');
  expect(at('06:00:00', { cutoffAt: '2026-11-17T02:59:59Z' }).kind).toBe('closed');
});

test('validates same-day household hours and uses explicit quest overrides', () => {
  expect(validQuestHours(defaultQuestHours)).toBe(true);
  expect(validQuestHours({ ...defaultQuestHours, bedtime: { start: '23:00', end: '02:00' } })).toBe(false);
  expect(validQuestHours({ ...defaultQuestHours, morning: { start: '7:00', end: '09:00' } })).toBe(false);
  expect(questWindowFor({ ...quest, window: 'anytime' })).toBe('anytime');
  expect(questWindowFor({ ...quest, id: 'read' })).toBe('anytime');
});
