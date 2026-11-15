import { isTermWeekday, questSchoolSchedule, showScheduledQuest } from '../schoolCalendar';

test.each([
  ['2026-01-05', true], ['2026-02-24', true], ['2026-02-25', false],
  ['2026-06-26', false], ['2026-06-29', true], ['2026-10-23', true],
  ['2026-11-16', false], ['2027-01-04', true], ['2027-02-19', false],
  ['2027-03-01', true], ['2027-03-06', false], ['2027-06-09', false],
  ['2027-06-21', true], ['2027-08-30', true], ['2027-11-05', true],
  ['2027-11-08', false], ['2028-02-07', true], ['2028-02-12', false],
])('checks term weekday availability for %s', (day, expected) => {
  expect(isTermWeekday(day)).toBe(expected);
});

test('defaults Homework Focus to term weekdays and respects a Party Leader’s choice', () => {
  expect(questSchoolSchedule({ id: 'homework' })).toBe('term_weekdays');
  expect(questSchoolSchedule({ id: 'custom', catalogQuestId: 'catalog-homework' })).toBe('term_weekdays');
  expect(questSchoolSchedule({ id: 'homework', schoolSchedule: 'year_round' })).toBe('year_round');
  expect(questSchoolSchedule({ id: 'read' })).toBe('year_round');
});

test('hides only unscheduled work and preserves active or completed quests', () => {
  const holiday = '2026-11-16';
  expect(showScheduledQuest('term_weekdays', 'available', holiday)).toBe(false);
  expect(showScheduledQuest('term_weekdays', 'expired', holiday)).toBe(false);
  expect(showScheduledQuest('year_round', 'available', holiday)).toBe(true);
  for (const status of ['in_progress', 'pending_approval', 'rewarded']) {
    expect(showScheduledQuest('term_weekdays', status, holiday)).toBe(true);
  }
});
