import questionBank from './mathsBank.json';

export const mathsGrades = [4, 5, 6, 7] as const;
export type MathsGrade = typeof mathsGrades[number];
export type MathsResult = 'correct' | 'with_hint' | 'worked';
export const MATHS_XP = 1;
export const QUESTIONS_PER_QUEST = 5;
export const MATHS_BANK_VERSION = 1;

export type MathsAttempt = {
  day: string;
  grade: MathsGrade;
  setIndex: number;
  bankVersion: number;
  results: MathsResult[];
};

type MathsQuestion = {
  id: string;
  topic: string;
  prompt: string;
  context?: string;
  hint: string;
  solution: string;
  answers: string[];
  options?: string[];
  answerPrompt?: string;
};
const bank: Record<MathsGrade, { title: string; questions: MathsQuestion[] }[]> = questionBank;

export type MathsDay = { day: string; grade: number | null; attempt: MathsAttempt | null };

export function isMathsGrade(grade: number | null): grade is MathsGrade {
  return mathsGrades.some(supported => supported === grade);
}

export function mathsDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function newMathsAttempt(day: string, grade: MathsGrade): MathsAttempt {
  const elapsedDays = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const count = bank[grade].length;
  return { day, grade, setIndex: ((elapsedDays % count) + count) % count, bankVersion: MATHS_BANK_VERSION, results: [] };
}

export function mathsSet(attempt: MathsAttempt) {
  return attempt.bankVersion === MATHS_BANK_VERSION ? bank[attempt.grade]?.[attempt.setIndex] : undefined;
}

export function mathsComplete(attempt: MathsAttempt | null | undefined) {
  return attempt?.results.length === QUESTIONS_PER_QUEST;
}

export function appendMathsResult(attempt: MathsAttempt, index: number, result: MathsResult): MathsAttempt {
  if (index !== attempt.results.length || mathsComplete(attempt)) return attempt;
  return { ...attempt, results: [...attempt.results, result] };
}

function numericAnswer(input: string) {
  const trimmed = input.trim().replace(/\s*\/\s*/g, '/');
  const value = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, '') : trimmed;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const fraction = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(value);
  if (!fraction || Number(fraction[3]) === 0) return NaN;
  return Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]);
}

export function matchesMathsAnswer(input: string, answers: string[], options?: string[]) {
  const value = input.trim();
  if (options || answers.some(answer => answer.includes(':'))) {
    return answers.includes(value.replace(/^(\d):/, '0$1:'));
  }
  const number = numericAnswer(value);
  return Number.isFinite(number) && answers.some(answer => Math.abs(number - numericAnswer(answer)) < 1e-10);
}
