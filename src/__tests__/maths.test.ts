import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { appendMathsResult, isMathsGrade, mathsComplete, mathsDate, mathsGrades, mathsSet, matchesMathsAnswer, newMathsAttempt } from '../maths';

test('ships the current question bank with every curriculum sub-strand and valid marking keys', () => {
  execFileSync(process.execPath, [resolve(__dirname, '../../scripts/generate-maths-bank.cjs'), '--check']);
  const expected = [[8, 7, 3, 1], [8, 7, 3, 1], [6, 6, 3, 1], [5, 3, 7, 2, 1]];
  const setsPerGrade = [8, 9, 7, 8];
  const questionIds = new Set();
  mathsGrades.forEach((grade, gradeIndex) => {
    const topics = new Map<string, number>();
    const sets = new Set<number>();
    const count = setsPerGrade[gradeIndex];
    for (let day = 1; day <= count; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const attempt = newMathsAttempt(date, grade);
      const set = mathsSet(attempt)!;
      sets.add(attempt.setIndex);
      expect(set.questions).toHaveLength(5);
      for (const question of set.questions) {
        expect(questionIds.has(question.id)).toBe(false);
        expect(question.id.startsWith(`G${grade}-`)).toBe(true);
        questionIds.add(question.id);
        const code = question.topic.split(' ')[0];
        topics.set(code, (topics.get(code) ?? 0) + 1);
        for (const answer of question.answers) {
          expect(matchesMathsAnswer(answer, question.answers, question.options)).toBe(true);
          if (question.options) expect(question.options).toContain(answer);
        }
        for (const choice of question.options ?? []) {
          expect(matchesMathsAnswer(choice, question.answers, question.options)).toBe(question.answers.includes(choice));
        }
      }
    }
    const codes = expected[gradeIndex].flatMap((length, index) => Array.from({ length }, (_, topic) => `${index + 1}.${topic + 1}`));
    expect([...topics.keys()].sort()).toEqual(codes.sort());
    expect(Math.min(...topics.values())).toBeGreaterThanOrEqual(2);
    expect(sets.size).toBe(count);
  });
  expect(questionIds.size).toBe(160);
});

test('normalizes mixed fractions, equivalent forms, decimal places, thousands and times', () => {
  expect(matchesMathsAnswer('17 / 4', ['4 1/4'])).toBe(true);
  expect(matchesMathsAnswer('7.500', ['7.5'])).toBe(true);
  expect(matchesMathsAnswer('1,200', ['1200'])).toBe(true);
  expect(matchesMathsAnswer('8:30', ['08:30'])).toBe(true);
  expect(matchesMathsAnswer('1/0', ['1'])).toBe(false);
  expect(matchesMathsAnswer('1,20', ['120'])).toBe(false);
  expect(matchesMathsAnswer('12,34,567', ['1234567'])).toBe(false);
  expect(matchesMathsAnswer('abc', ['0'])).toBe(false);
});

test('uses the household calendar and keeps the original grade and bank version with a saved attempt', () => {
  expect(mathsDate(new Date('2026-11-14T21:00:00Z'), 'Africa/Nairobi')).toBe('2026-11-15');
  expect(mathsDate(new Date('2026-11-14T21:00:00Z'), 'America/New_York')).toBe('2026-11-14');
  expect(isMathsGrade(null)).toBe(false);
  expect(isMathsGrade(8)).toBe(false);
  let attempt = newMathsAttempt('2026-11-14', 4);
  expect(appendMathsResult(attempt, 1, 'worked')).toBe(attempt);
  attempt = appendMathsResult(attempt, 0, 'with_hint');
  expect(appendMathsResult(attempt, 0, 'correct')).toBe(attempt);
  for (let index = 1; index < 5; index += 1) attempt = appendMathsResult(attempt, index, 'correct');
  expect(mathsComplete(attempt)).toBe(true);
  expect(appendMathsResult(attempt, 5, 'worked')).toBe(attempt);
  expect(attempt).toMatchObject({ grade: 4, bankVersion: 1, results: ['with_hint', 'correct', 'correct', 'correct', 'correct'] });
});
