import type { Quest, SchoolSchedule } from './types';

// Inclusive classroom periods from the 2026 and 2027 Kenyan basic education
// calendars. The 2027 dates use the primary and junior school calendar.
// 2026: https://roseve.ac.ke/term-dates.php
// 2027: Ministry of Education circular MOE.HQS/3/13/3/VOL III, 19 October 2026.
// https://www.pulse.co.ke/story/2027-school-calendar-out-key-term-dates-half-terms-and-exam-periods-released-2026110407012929506
const terms: Record<string, readonly (readonly [string, string])[]> = {
  '2026': [
    ['2026-01-05', '2026-02-24'],
    ['2026-03-02', '2026-04-02'],
    ['2026-04-27', '2026-06-23'],
    ['2026-06-29', '2026-07-31'],
    ['2026-08-24', '2026-10-23'],
  ],
  '2027': [
    ['2027-01-04', '2027-02-18'],
    ['2027-03-01', '2027-04-09'],
    ['2027-05-03', '2027-06-08'],
    ['2027-06-21', '2027-07-30'],
    ['2027-08-30', '2027-11-05'],
  ],
};

export function isTermWeekday(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  if (!(weekday >= 1 && weekday <= 5)) return false;
  const periods = terms[day.slice(0, 4)];
  return !periods || periods.some(([start, end]) => day >= start && day <= end);
}

export function questSchoolSchedule(quest: Pick<Quest, 'schoolSchedule' | 'id' | 'templateId' | 'catalogQuestId'>): SchoolSchedule {
  return quest.schoolSchedule ?? (
    (quest.templateId ?? quest.id) === 'homework' || quest.catalogQuestId === 'catalog-homework' ? 'term_weekdays' : 'year_round'
  );
}

export function respectsSchoolSchedule(schedule: SchoolSchedule | null | undefined, day: string) {
  return schedule !== 'term_weekdays' || isTermWeekday(day);
}

export function showScheduledQuest(schedule: SchoolSchedule | null | undefined, status: string, day: string) {
  return ['in_progress', 'pending_approval', 'rewarded'].includes(status) || respectsSchoolSchedule(schedule, day);
}
