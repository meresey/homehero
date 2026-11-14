import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { appendMathsResult, isMathsGrade, mathsComplete, mathsDate, newMathsAttempt } from './maths';
import type { MathsAttempt, MathsDay, MathsResult } from './maths';
import { usePersistentState } from './usePersistentState';

type LocalMaths = {
  grades: Record<string, number | null>;
  attempts: Record<string, MathsAttempt>;
};

const initialMaths: LocalMaths = { grades: {}, attempts: {} };

async function mathsRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function useDailyMaths({
  householdId, heroId, timeZone,
}: { householdId: string | null; heroId: string | null; timeZone: string }) {
  const [local, setLocal, hydrated] = usePersistentState('home-hero.maths.v1', initialMaths);
  const [remote, setRemote] = useState<{ scope: string; day: MathsDay } | null>(null);
  const [error, setError] = useState<{ scope: string; text: string } | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const today = mathsDate(clock, timeZone);
  const scope = householdId && heroId ? `${householdId}:${heroId}` : '';
  const localDay = heroId && hydrated ? {
    day: today, grade: local.grades[heroId] ?? null, attempt: local.attempts[`${heroId}:${today}`] ?? null,
  } : null;

  const storeRemoteDay = useCallback((day: MathsDay) => {
    setRemote(current => {
      if (current?.scope !== scope) return { scope, day };
      if (current.day.day > day.day) return current;
      const previous = current.day.attempt;
      if (previous?.day === day.day && previous.results.length > (day.attempt?.results.length ?? -1)) {
        return { scope, day: { ...day, attempt: previous } };
      }
      return { scope, day };
    });
  }, [scope]);

  const refresh = useCallback(async () => {
    if (!supabase || !householdId || !scope) return;
    try {
      const day = await mathsRpc<MathsDay>('get_hero_maths_day', { p_household_id: householdId });
      storeRemoteDay(day);
      setError(null);
    } catch (cause) {
      setError({ scope, text: cause instanceof Error ? cause.message : 'Daily Maths could not load.' });
    }
  }, [householdId, scope, storeRemoteDay]);

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { void refresh(); }, [refresh, today]);
  useEffect(() => {
    if (!supabase || !scope) return;
    const interval = setInterval(() => { void refresh(); }, 60_000);
    return () => clearInterval(interval);
  }, [refresh, scope]);

  useEffect(() => {
    if (!supabase || !scope || !heroId) return;
    const client = supabase;
    const channel = client.channel(`daily-maths-${scope}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'hero_maths_grades', filter: `child_id=eq.${heroId}`,
      }, () => { void refresh(); })
      .subscribe(state => { if (state === 'SUBSCRIBED') void refresh(); });
    return () => { void client.removeChannel(channel); };
  }, [heroId, refresh, scope]);

  async function setGrade(childId: string, grade: number | null) {
    if (supabase) {
      await mathsRpc('set_hero_maths_grade', { p_household_id: householdId, p_child_id: childId, p_grade: grade });
    } else {
      setLocal(current => ({ ...current, grades: { ...current.grades, [childId]: grade } }));
    }
  }

  async function start() {
    if (supabase) {
      const day = await mathsRpc<MathsDay>('get_hero_maths_day', { p_household_id: householdId, p_start: true });
      storeRemoteDay(day);
      setError(null);
      if (!day.attempt) throw new Error('Ask your Party Leader to set a grade from 4 to 7.');
      return day.attempt;
    }
    if (!heroId || !localDay) throw new Error('Daily Maths is still loading.');
    const day = mathsDate(new Date(), timeZone);
    const key = `${heroId}:${day}`;
    const existing = local.attempts[key];
    if (existing) return existing;
    if (!isMathsGrade(localDay.grade)) throw new Error('Ask your Party Leader to set a grade from 4 to 7.');
    const attempt = newMathsAttempt(day, localDay.grade);
    setLocal(current => current.attempts[key] ? current : {
      ...current, attempts: { ...current.attempts, [key]: attempt },
    });
    return attempt;
  }

  async function record(attempt: MathsAttempt, index: number, result: MathsResult) {
    if (supabase) {
      const day = await mathsRpc<MathsDay>('record_hero_maths_result', {
        p_household_id: householdId, p_day: attempt.day, p_index: index, p_result: result,
      });
      storeRemoteDay(day);
      setError(null);
      if (!day.attempt) throw new Error('Daily Maths could not save your progress.');
      return day.attempt;
    }
    if (attempt.day !== mathsDate(new Date(), timeZone)) {
      setClock(new Date());
      throw new Error('A new Daily Maths quest is available. Reopen the quest to continue.');
    }
    const key = `${heroId}:${attempt.day}`;
    setLocal(current => {
      const previous = current.attempts[key];
      if (!previous) return current;
      return { ...current, attempts: { ...current.attempts, [key]: appendMathsResult(previous, index, result) } };
    });
    return appendMathsResult(attempt, index, result);
  }

  return {
    day: supabase ? (remote?.scope === scope ? remote.day : null) : localDay,
    error: error?.scope === scope ? error.text : null,
    localGrades: local.grades,
    localCompletedCount: Object.entries(local.attempts)
      .filter(([key, attempt]) => key.startsWith(`${heroId}:`) && mathsComplete(attempt)).length,
    hydrated: Boolean(supabase) || hydrated,
    refresh, start, record, setGrade,
  };
}
