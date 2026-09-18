import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { initialQuests } from './data';
import { backendEnabled, supabase } from './lib/supabase';
import { Quest, QuestKind, QuestStatus, Reward } from './types';

type FamilyContext = { householdId: string; householdName: string; inviteCode: string; childId: string | null; role: 'parent' | 'child' };

export function useHomeHeroData() {
  const [session, setSession] = useState<Session | null>(null);
  const [family, setFamily] = useState<FamilyContext | null>(null);
  const [quests, setQuests] = useState<Quest[]>(backendEnabled ? [] : initialQuests);
  const [questCatalog, setQuestCatalog] = useState<Quest[]>([]);
  const [pendingQuests, setPendingQuests] = useState<Quest[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [stars, setStars] = useState(backendEnabled ? 0 : 19);
  const [xp, setXp] = useState(backendEnabled ? 0 : 324);
  const [loading, setLoading] = useState(backendEnabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (activeSession?: Session | null) => {
    if (!supabase) return;
    const current = activeSession === undefined ? (await supabase.auth.getSession()).data.session : activeSession;
    setSession(current);
    if (!current) { setFamily(null); setQuests([]); setQuestCatalog([]); setPendingQuests([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data: membership, error: membershipError } = await supabase.from('household_members').select('household_id, role, households(name, invite_code)').eq('user_id', current.user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) { setFamily(null); setQuests([]); return; }
      const household = membership.households as unknown as { name: string; invite_code: string };
      let childId: string | null = current.user.id;
      if (membership.role === 'parent') {
        const { data: link, error: linkError } = await supabase.from('parent_child_links').select('child_id').eq('household_id', membership.household_id).eq('parent_id', current.user.id).limit(1).maybeSingle();
        if (linkError) throw linkError;
        childId = link?.child_id ?? null;
      }
      const nextFamily: FamilyContext = { householdId: membership.household_id, householdName: household.name, inviteCode: household.invite_code, childId, role: membership.role };
      setFamily(nextFamily);
      if (!childId) { setQuests([]); setStars(0); setXp(0); return; }

      if (membership.role === 'parent') {
        const { data: catalogRows, error: catalogError } = await supabase.from('quest_catalog').select('id,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,minimum_age,maximum_age').eq('is_active', true).order('created_at');
        if (catalogError) throw catalogError;
        setQuestCatalog((catalogRows ?? []).map(mapCatalogQuest));
        const { data, error: questError } = await supabase.from('quest_templates').select('id,catalog_quest_id,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,minimum_age,maximum_age').eq('household_id',membership.household_id).eq('is_active',true).order('created_at');
        if (questError) throw questError;
        setQuests((data ?? []).map(mapTemplate));
        const { data: pending, error: pendingError } = await supabase.from('quest_instances').select('id,quest_template_id,status,star_reward_snapshot,xp_reward_snapshot,cutoff_at,quest_templates(title,description,icon_key,kind,cadence,schedule_label,timer_seconds,minimum_age,maximum_age)').eq('household_id', membership.household_id).eq('status', 'pending_approval').order('completed_at', { ascending: false });
        if (pendingError) throw pendingError;
        setPendingQuests((pending ?? []).map(mapInstance));
      } else {
        setQuestCatalog([]);
        const today = new Date().toLocaleDateString('en-CA');
        const { data, error: questError } = await supabase.from('quest_instances').select('id,quest_template_id,status,star_reward_snapshot,xp_reward_snapshot,cutoff_at,quest_templates(title,description,icon_key,kind,cadence,schedule_label,timer_seconds,minimum_age,maximum_age)').eq('child_id',childId).eq('occurrence_date',today).order('available_at');
        if (questError) throw questError;
        setQuests((data ?? []).map(mapInstance));
        setPendingQuests([]);
      }
      const { data: balance, error: balanceError } = await supabase.from('child_balances').select('stars,xp').eq('child_id',childId).maybeSingle();
      if (balanceError) throw balanceError;
      setStars(balance?.stars ?? 0); setXp(balance?.xp ?? 0);
      const { data: rewardRows, error: rewardError } = await supabase.from('rewards').select('id,title,description,icon_key,star_cost').eq('household_id', membership.household_id).eq('is_active', true).order('star_cost');
      if (rewardError) throw rewardError;
      setRewards((rewardRows ?? []).map(row => ({ id: row.id, title: row.title, subtitle: row.description ?? 'Parent-approved reward', emoji: row.icon_key?.length <= 3 ? row.icon_key : '🎁', cost: row.star_cost })));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    refresh();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => refresh(next));
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const rpc = useCallback(async (name: string, args: Record<string, unknown>) => {
    if (!supabase) return;
    const { error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) throw rpcError;
    await refresh();
  }, [refresh]);

  return { backendEnabled, session, family, quests, questCatalog, pendingQuests, rewards, stars, xp, loading, error, refresh,
    setDemoQuests: setQuests, setDemoStars: setStars, setDemoXp: setXp,
    completeQuest: (q: Quest) => rpc(q.kind === 'guild' ? 'submit_guild_quest' : 'complete_quest', { p_instance_id: q.instanceId }),
    startTimer: (q: Quest) => rpc('start_timer', { p_instance_id: q.instanceId }),
    finishTimer: (q: Quest) => rpc('finish_timer', { p_instance_id: q.instanceId }),
    approveGuild: (q: Quest) => rpc('review_guild_quest', { p_instance_id: q.instanceId, p_approve: true, p_note: null }),
    redeemReward: (rewardId: string) => rpc('redeem_reward', { p_reward_id: rewardId, p_idempotency_key: `${rewardId}-${Date.now()}` }),
  };
}

function mapTemplate(row: any): Quest { return { id: row.id, templateId: row.id, catalogQuestId: row.catalog_quest_id ?? undefined, title: row.title, description: row.description ?? '', emoji: row.icon_key?.length <= 3 ? row.icon_key : '✨', kind: row.kind as QuestKind, cadence: row.cadence, scheduleLabel: row.schedule_label ?? 'Every day', status: 'available', stars: row.star_reward, xp: row.xp_reward, timerMinutes: row.timer_seconds ? row.timer_seconds / 60 : undefined, minimumAge: row.minimum_age ?? undefined, maximumAge: row.maximum_age ?? undefined }; }
function mapCatalogQuest(row: any): Quest { return { id: row.id, catalogQuestId: row.id, title: row.title, description: row.description ?? '', emoji: row.icon_key?.length <= 3 ? row.icon_key : '✨', kind: row.kind as QuestKind, cadence: row.cadence, scheduleLabel: row.schedule_label ?? 'Every day', status: 'available', stars: row.star_reward, xp: row.xp_reward, timerMinutes: row.timer_seconds ? row.timer_seconds / 60 : undefined, minimumAge: row.minimum_age ?? undefined, maximumAge: row.maximum_age ?? undefined }; }
function mapInstance(row: any): Quest { const t = row.quest_templates; return { id: row.id, instanceId: row.id, templateId: row.quest_template_id, title: t.title, description: t.description ?? '', emoji: t.icon_key?.length <= 3 ? t.icon_key : '✨', kind: t.kind as QuestKind, cadence: t.cadence, scheduleLabel: t.schedule_label, status: row.status as QuestStatus, stars: row.star_reward_snapshot, xp: row.xp_reward_snapshot, timerMinutes: t.timer_seconds ? t.timer_seconds / 60 : undefined, minimumAge: t.minimum_age ?? undefined, maximumAge: t.maximum_age ?? undefined, cutoffLabel: row.cutoff_at ? new Date(row.cutoff_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : undefined }; }

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') return cause.message;
  return 'Could not load Home Hero';
}
