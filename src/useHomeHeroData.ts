import { useCallback, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { initialQuests } from './data';
import { backendEnabled, supabase } from './lib/supabase';
import { BadgeDefinition, HeroProfile, Quest, QuestAssignment, QuestKind, QuestStatus, Reward, RewardRedemption } from './types';

type FamilyContext = { householdId: string; householdName: string; inviteCode: string; childId: string | null; role: 'parent' | 'child'; displayName: string };
export type ParentDashboardSummary = {
  leaderName: string;
  heroNames: string[];
  managedHeroes: ManagedHeroAccount[];
  todayProgress: HeroTodayProgress[];
  weeklyProgress: HeroWeeklyProgress[];
  safeZone: { title: string; heroName: string; cutoffAt: string } | null;
};

export type ManagedHeroAccount = { userId: string; displayName: string; username: string };

export type HeroTodayProgress = {
  childId: string;
  heroName: string;
  completedQuests: number;
  totalQuests: number;
};

export type HeroWeeklyProgress = {
  childId: string;
  heroName: string;
  earnedStars: number;
  availableStars: number;
  goalStars: number | null;
};

const emptyParentDashboard: ParentDashboardSummary = { leaderName: 'Party Leader', heroNames: [], managedHeroes: [], todayProgress: [], weeklyProgress: [], safeZone: null };

export function useHomeHeroData() {
  const loadedUserId = useRef<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [family, setFamily] = useState<FamilyContext | null>(null);
  const [quests, setQuests] = useState<Quest[]>(backendEnabled ? [] : initialQuests);
  const [retiredQuests, setRetiredQuests] = useState<Quest[]>([]);
  const [questCatalog, setQuestCatalog] = useState<Quest[]>([]);
  const [heroes, setHeroes] = useState<HeroProfile[]>([]);
  const [questAssignments, setQuestAssignments] = useState<QuestAssignment[]>([]);
  const [pendingQuests, setPendingQuests] = useState<Quest[]>([]);
  const [runningTimers, setRunningTimers] = useState<Quest[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [retiredRewards, setRetiredRewards] = useState<Reward[]>([]);
  const [rewardCatalog, setRewardCatalog] = useState<Reward[]>([]);
  const [pendingRewards, setPendingRewards] = useState<RewardRedemption[]>([]);
  const [pendingRewardIds, setPendingRewardIds] = useState<string[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<BadgeDefinition[]>([]);
  const [stars, setStars] = useState(backendEnabled ? 0 : 19);
  const [xp, setXp] = useState(backendEnabled ? 0 : 324);
  const [parentDashboard, setParentDashboard] = useState<ParentDashboardSummary>(emptyParentDashboard);
  const [loading, setLoading] = useState(backendEnabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (activeSession?: Session | null) => {
    if (!supabase) return;
    const current = activeSession === undefined ? (await supabase.auth.getSession()).data.session : activeSession;
    activeUserId.current = current?.user.id ?? null;
    setSession(current);
    if (!current) { loadedUserId.current = null; setFamily(null); setQuests([]); setRetiredQuests([]); setQuestCatalog([]); setHeroes([]); setQuestAssignments([]); setPendingQuests([]); setRunningTimers([]); setRewards([]); setRetiredRewards([]); setRewardCatalog([]); setPendingRewards([]); setPendingRewardIds([]); setEarnedBadges([]); setParentDashboard(emptyParentDashboard); setLoading(false); return; }
    // Keep the existing screen visible when refreshing data for the same account.
    // A full-screen loader is only needed before we have loaded this account.
    if (loadedUserId.current !== current.user.id) setLoading(true);
    setError(null);
    try {
      const { data: membership, error: membershipError } = await supabase.from('household_members').select('household_id, role, households(name, invite_code, timezone)').eq('user_id', current.user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) { setFamily(null); setQuests([]); setRetiredQuests([]); setQuestCatalog([]); setHeroes([]); setQuestAssignments([]); setPendingQuests([]); setRunningTimers([]); setRewards([]); setRetiredRewards([]); setRewardCatalog([]); setPendingRewards([]); setPendingRewardIds([]); setEarnedBadges([]); setParentDashboard(emptyParentDashboard); return; }
      const household = membership.households as unknown as { name: string; invite_code: string; timezone: string };
      const [profileResult, linksResult] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', current.user.id).single(),
        membership.role === 'parent'
          ? supabase.from('parent_child_links').select('child_id').eq('household_id', membership.household_id).eq('parent_id', current.user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const { data: ownProfile, error: profileError } = profileResult;
      if (profileError) throw profileError;
      let childId: string | null = current.user.id;
      let childIds: string[] = [];
      if (membership.role === 'parent') {
        setEarnedBadges([]);
        const { data: links, error: linkError } = linksResult;
        if (linkError) throw linkError;
        childIds = (links ?? []).map(link => link.child_id);
        childId = childIds[0] ?? null;
      }
      const nextFamily: FamilyContext = { householdId: membership.household_id, householdName: household.name, inviteCode: household.invite_code, childId, role: membership.role, displayName: ownProfile.display_name };
      setFamily(nextFamily);

      if (membership.role === 'parent') {
        const today = dateKey(new Date(), household.timezone);
        const weekStart = startOfWeek(today);
        const weekEnd = addDays(weekStart, 6);
        const [heroesResult, managedResult, todayResult, openGuildResult, weekResult, assignmentsResult, goalsResult] = await Promise.all([
          childIds.length
            ? supabase.from('profiles').select('id,display_name,date_of_birth').in('id', childIds)
            : Promise.resolve({ data: [], error: null }),
          childIds.length
            ? supabase.from('managed_hero_accounts').select('user_id,username').eq('household_id', membership.household_id).in('user_id', childIds).order('created_at')
            : Promise.resolve({ data: [], error: null }),
          supabase.from('quest_instances').select('id,child_id,status,cutoff_at,quest_templates(title,kind)').eq('household_id', membership.household_id).eq('occurrence_date', today),
          supabase.from('quest_instances').select('id,child_id,status,cutoff_at,quest_assignments!inner(days_of_week),quest_templates!inner(title,kind)').eq('household_id', membership.household_id).eq('quest_templates.kind', 'guild').gte('occurrence_date', weekStart).lte('occurrence_date', today).in('status', ['available','pending_approval','rewarded']),
          supabase.from('quest_instances').select('child_id,star_reward_snapshot').eq('household_id', membership.household_id).eq('status', 'rewarded').gte('occurrence_date', weekStart).lte('occurrence_date', weekEnd),
          childIds.length
            ? supabase.from('quest_assignments').select('id,quest_template_id,child_id,created_at,starts_on,ends_on,days_of_week,quest_templates(star_reward,is_active,kind,minimum_age,maximum_age)').in('child_id', childIds).eq('active', true)
            : Promise.resolve({ data: [], error: null }),
          childIds.length
            ? supabase.from('weekly_goals').select('child_id,target_stars').eq('household_id', membership.household_id).eq('week_start', weekStart)
            : Promise.resolve({ data: [], error: null }),
        ]);
        const { data: heroProfiles, error: heroesError } = heroesResult;
        const { data: managedRows, error: managedError } = managedResult;
        const { data: todayRows, error: todayError } = todayResult;
        const { data: openGuildRows, error: openGuildError } = openGuildResult;
        const { data: weekRows, error: weekError } = weekResult;
        const { data: assignmentRows, error: assignmentsError } = assignmentsResult;
        const { data: goals, error: goalsError } = goalsResult;
        if (heroesError) throw heroesError;
        if (managedError) throw managedError;
        if (todayError) throw todayError;
        if (openGuildError) throw openGuildError;
        if (weekError) throw weekError;
        if (assignmentsError) throw assignmentsError;
        if (goalsError) throw goalsError;
        setHeroes((heroProfiles ?? []).map(profile => ({
          id: profile.id,
          householdId: membership.household_id,
          displayName: profile.display_name,
          avatarEmoji: '🦸',
          dateOfBirth: profile.date_of_birth ?? '',
          status: 'active',
          joinedAt: '',
        })));
        const heroNamesById = new Map((heroProfiles ?? []).map(profile => [profile.id, profile.display_name]));
        setQuestAssignments((assignmentRows ?? []).map(assignment => ({
          id: assignment.id,
          householdId: membership.household_id,
          questId: assignment.quest_template_id,
          heroId: assignment.child_id,
          assignedAt: assignment.created_at,
          active: true,
          daysOfWeek: assignment.days_of_week,
        })));
        const activeWeeklyGuildRows = (openGuildRows ?? []).filter(row => ((row.quest_assignments as unknown as { days_of_week: number[] })?.days_of_week ?? []).length === 7);
        const dashboardRows = mergeRowsById(todayRows ?? [], activeWeeklyGuildRows);
        const earnedByHero = new Map<string, number>();
        for (const row of weekRows ?? []) earnedByHero.set(row.child_id, (earnedByHero.get(row.child_id) ?? 0) + row.star_reward_snapshot);
        const goalByHero = new Map((goals ?? []).map(goal => [goal.child_id, goal.target_stars]));
        const weeklyProgress = (heroProfiles ?? []).map(profile => ({
          childId: profile.id,
          heroName: profile.display_name,
          earnedStars: earnedByHero.get(profile.id) ?? 0,
          availableStars: calculateWeeklyAvailability(assignmentRows ?? [], profile.id, profile.date_of_birth, weekStart),
          goalStars: goalByHero.get(profile.id) ?? null,
        }));
        const todayProgress = (heroProfiles ?? []).map(profile => {
          const heroQuests = dashboardRows.filter(row => row.child_id === profile.id);
          return {
            childId: profile.id,
            heroName: profile.display_name,
            completedQuests: heroQuests.filter(row => row.status === 'rewarded').length,
            totalQuests: heroQuests.length,
          };
        });
        const safeZoneRow = dashboardRows.filter(row => {
          const template = row.quest_templates as unknown as { title: string; kind: QuestKind };
          return template?.kind === 'bedtime' && row.cutoff_at && ['available', 'in_progress'].includes(row.status);
        }).sort((a, b) => new Date(a.cutoff_at as string).getTime() - new Date(b.cutoff_at as string).getTime())[0];
        const safeTemplate = safeZoneRow?.quest_templates as unknown as { title: string; kind: QuestKind } | undefined;
        setParentDashboard({
          leaderName: ownProfile.display_name,
          heroNames: (heroProfiles ?? []).map(profile => profile.display_name),
          managedHeroes: (managedRows ?? []).map(account => ({ userId: account.user_id, username: account.username, displayName: heroNamesById.get(account.user_id) ?? 'Hero' })),
          todayProgress,
          weeklyProgress,
          safeZone: safeZoneRow && safeTemplate ? { title: safeTemplate.title, heroName: heroNamesById.get(safeZoneRow.child_id) ?? 'Hero', cutoffAt: safeZoneRow.cutoff_at as string } : null,
        });
        const [catalogResult, rewardCatalogResult, questsResult, retiredQuestsResult, pendingResult, timersResult] = await Promise.all([
          supabase.from('quest_catalog').select('id,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,minimum_age,maximum_age').eq('is_active', true).order('created_at'),
          supabase.from('reward_catalog').select('id,title,description,icon_key,star_cost').eq('is_active', true).order('star_cost'),
          supabase.from('quest_templates').select('id,catalog_quest_id,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,minimum_age,maximum_age').eq('household_id',membership.household_id).eq('is_active',true).order('created_at'),
          supabase.from('quest_templates').select('id,catalog_quest_id,title,description,icon_key,kind,cadence,schedule_label,star_reward,xp_reward,timer_seconds,minimum_age,maximum_age').eq('household_id',membership.household_id).eq('is_active',false).order('archived_at', { ascending: false }),
          supabase.from('quest_instances').select('id,child_id,quest_template_id,status,star_reward_snapshot,xp_reward_snapshot,cutoff_at,timer_started_at,timer_expected_end_at,submitted_at,quest_templates(title,description,icon_key,kind,cadence,schedule_label,timer_seconds,minimum_age,maximum_age)').eq('household_id', membership.household_id).eq('status', 'pending_approval').order('completed_at', { ascending: false }),
          supabase.from('quest_instances').select('id,child_id,quest_template_id,status,star_reward_snapshot,xp_reward_snapshot,cutoff_at,timer_started_at,timer_expected_end_at,submitted_at,quest_templates!inner(title,description,icon_key,kind,cadence,schedule_label,timer_seconds,minimum_age,maximum_age)').eq('household_id', membership.household_id).eq('status', 'in_progress').eq('quest_templates.kind', 'timer').order('timer_expected_end_at'),
        ]);
        const { data: catalogRows, error: catalogError } = catalogResult;
        const { data: rewardCatalogRows, error: rewardCatalogError } = rewardCatalogResult;
        const { data, error: questError } = questsResult;
        const { data: retiredQuestRows, error: retiredQuestError } = retiredQuestsResult;
        const { data: pending, error: pendingError } = pendingResult;
        const { data: runningTimerRows, error: runningTimerError } = timersResult;
        if (catalogError) throw catalogError;
        if (rewardCatalogError) throw rewardCatalogError;
        if (questError) throw questError;
        if (retiredQuestError) throw retiredQuestError;
        if (pendingError) throw pendingError;
        if (runningTimerError) throw runningTimerError;
        setQuestCatalog((catalogRows ?? []).map(mapCatalogQuest));
        setRewardCatalog((rewardCatalogRows ?? []).map(mapCatalogReward));
        setQuests((data ?? []).map(mapTemplate));
        setRetiredQuests((retiredQuestRows ?? []).map(row => ({ ...mapTemplate(row), archived: true })));
        setPendingQuests((pending ?? []).map(row => ({ ...mapInstance(row), childId: row.child_id, heroName: heroNamesById.get(row.child_id) ?? 'Hero' })));
        setRunningTimers((runningTimerRows ?? []).map(row => ({ ...mapInstance(row), childId: row.child_id, heroName: heroNamesById.get(row.child_id) ?? 'Hero' })));
      } else {
        setParentDashboard(emptyParentDashboard);
        setRetiredQuests([]);
        setQuestCatalog([]);
        setRewardCatalog([]);
        setHeroes([]);
        setQuestAssignments([]);
        setRunningTimers([]);
        const { error: syncError } = await supabase.rpc('sync_my_quest_assignments');
        if (syncError) throw syncError;
        const today = dateKey(new Date(), household.timezone);
        const weekStart = startOfWeek(today);
        const [questsResult, weeklyGuildResult, badgesResult] = await Promise.all([
          supabase.from('quest_instances').select('id,quest_template_id,status,star_reward_snapshot,xp_reward_snapshot,cutoff_at,timer_started_at,timer_expected_end_at,submitted_at,quest_templates!inner(title,description,icon_key,kind,cadence,schedule_label,timer_seconds,minimum_age,maximum_age,is_active)').eq('child_id',childId).eq('occurrence_date',today).eq('quest_templates.is_active',true).order('available_at'),
          supabase.from('quest_instances').select('id,quest_template_id,status,star_reward_snapshot,xp_reward_snapshot,cutoff_at,timer_started_at,timer_expected_end_at,submitted_at,quest_assignments!inner(days_of_week),quest_templates!inner(title,description,icon_key,kind,cadence,schedule_label,timer_seconds,minimum_age,maximum_age,is_active)').eq('child_id',childId).eq('quest_templates.kind','guild').eq('quest_templates.is_active',true).gte('occurrence_date',weekStart).lte('occurrence_date',today).in('status',['available','pending_approval','rewarded']).order('available_at'),
          supabase.from('hero_badges').select('badge_key,earned_at').eq('child_id', current.user.id).order('earned_at'),
        ]);
        const { data, error: questError } = questsResult;
        const { data: weeklyGuildRows, error: weeklyGuildError } = weeklyGuildResult;
        const { data: badgeRows, error: badgeError } = badgesResult;
        if (questError) throw questError;
        if (weeklyGuildError) throw weeklyGuildError;
        const activeWeeklyGuildRows = (weeklyGuildRows ?? []).filter(row => ((row.quest_assignments as unknown as { days_of_week: number[] })?.days_of_week ?? []).length === 7);
        setQuests(mergeRowsById(data ?? [], activeWeeklyGuildRows).map(mapInstance));
        setPendingQuests([]);
        if (badgeError) {
          setEarnedBadges([]);
        } else {
          const badgeKeys = (badgeRows ?? []).map(row => row.badge_key);
          if (badgeKeys.length === 0) {
            setEarnedBadges([]);
          } else {
            const { data: definitions, error: definitionsError } = await supabase.from('badge_definitions').select('key,name,description,icon_key').in('key', badgeKeys);
            if (definitionsError) {
              setEarnedBadges([]);
            } else {
              const definitionsByKey = new Map((definitions ?? []).map(badge => [badge.key, badge]));
              setEarnedBadges(badgeKeys.flatMap(key => {
                const badge = definitionsByKey.get(key);
                return badge ? [{ id: badge.key, name: badge.name, description: badge.description, emoji: badge.icon_key }] : [];
              }));
            }
          }
        }
      }
      const [balanceResult, rewardsResult] = await Promise.all([
        childId
          ? supabase.from('child_balances').select('stars,xp').eq('child_id',childId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('rewards').select('id,catalog_reward_id,title,description,icon_key,star_cost').eq('household_id', membership.household_id).eq('active', true).order('star_cost'),
      ]);
      const { data: balance, error: balanceError } = balanceResult;
      const { data: rewardRows, error: rewardError } = rewardsResult;
      if (balanceError) throw balanceError;
      if (rewardError) throw rewardError;
      if (childId) {
        setStars(balance?.stars ?? 0); setXp(balance?.xp ?? 0);
      } else {
        setStars(0); setXp(0);
      }
      setRewards((rewardRows ?? []).map(mapReward));
      if (membership.role === 'parent') {
        const [retiredRewardsResult, redemptionsResult] = await Promise.all([
          supabase.from('rewards').select('id,catalog_reward_id,title,description,icon_key,star_cost').eq('household_id', membership.household_id).eq('active', false).order('archived_at', { ascending: false }),
          supabase.from('reward_redemptions').select('id,reward_id,child_id,star_cost_snapshot,requested_at,rewards!inner(title,description,icon_key,household_id)').eq('rewards.household_id', membership.household_id).eq('status', 'requested').order('requested_at'),
        ]);
        const { data: retiredRewardRows, error: retiredRewardError } = retiredRewardsResult;
        const { data: redemptionRows, error: redemptionError } = redemptionsResult;
        if (retiredRewardError) throw retiredRewardError;
        if (redemptionError) throw redemptionError;
        setRetiredRewards((retiredRewardRows ?? []).map(row => ({ ...mapReward(row), archived: true })));
        const redemptionChildIds = [...new Set((redemptionRows ?? []).map(row => row.child_id))];
        const [redemptionProfilesResult, redemptionBalancesResult] = redemptionChildIds.length
          ? await Promise.all([
            supabase.from('profiles').select('id,display_name').in('id', redemptionChildIds),
            supabase.from('child_balances').select('child_id,stars').in('child_id', redemptionChildIds),
          ])
          : [{ data: [], error: null }, { data: [], error: null }];
        const { data: redemptionProfiles, error: redemptionProfilesError } = redemptionProfilesResult;
        const { data: redemptionBalances, error: redemptionBalancesError } = redemptionBalancesResult;
        if (redemptionProfilesError) throw redemptionProfilesError;
        if (redemptionBalancesError) throw redemptionBalancesError;
        const names = new Map((redemptionProfiles ?? []).map(profile => [profile.id, profile.display_name]));
        const balances = new Map((redemptionBalances ?? []).map(balance => [balance.child_id, balance.stars]));
        setPendingRewards((redemptionRows ?? []).map(row => mapRedemption(row, names.get(row.child_id) ?? 'Hero', balances.get(row.child_id) ?? 0)));
        setPendingRewardIds([]);
      } else {
        setRetiredRewards([]);
        const { data: ownRequests, error: ownRequestsError } = await supabase.from('reward_redemptions').select('reward_id').eq('child_id', current.user.id).eq('status', 'requested');
        if (ownRequestsError) throw ownRequestsError;
        setPendingRewards([]);
        setPendingRewardIds((ownRequests ?? []).map(request => request.reward_id));
      }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { loadedUserId.current = current.user.id; setLoading(false); }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // The explicit startup refresh handles INITIAL_SESSION. Token renewal
      // does not change the data we display, so neither needs another fetch.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      // Supabase also emits SIGNED_IN when an existing browser tab regains
      // focus. Re-fetch only when that event represents a different account.
      if (event === 'SIGNED_IN' && next?.user.id === activeUserId.current) return;
      void refresh(next);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !session?.user.id || family?.role !== 'parent') return;
    const client = supabase;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void refresh(); }, 150);
    };
    const channel = client
      .channel(`reward-requests-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, refreshSoon)
      .subscribe(status => { if (status === 'SUBSCRIBED') refreshSoon(); });
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void client.removeChannel(channel);
    };
  }, [family?.role, refresh, session?.user.id]);

  const rpc = useCallback(async (name: string, args: Record<string, unknown>) => {
    if (!supabase) return;
    const { error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) throw rpcError;
    await refresh();
  }, [refresh]);

  return { backendEnabled, session, family, quests, retiredQuests, questCatalog, heroes, questAssignments, pendingQuests, runningTimers, rewards, retiredRewards, rewardCatalog, pendingRewards, pendingRewardIds, earnedBadges, stars, xp, parentDashboard, loading, error, refresh,
    setDemoQuests: setQuests, setDemoStars: setStars, setDemoXp: setXp,
    completeQuest: (q: Quest) => rpc(q.kind === 'guild' ? 'submit_guild_quest' : 'complete_quest', { p_instance_id: q.instanceId }),
    startTimer: (q: Quest) => rpc('start_timer', { p_instance_id: q.instanceId }),
    finishTimer: (q: Quest) => rpc('finish_timer', { p_instance_id: q.instanceId }),
    reviewQuest: (q: Quest, approve: boolean) => rpc('review_quest', { p_instance_id: q.instanceId, p_approve: approve, p_note: null }),
    redeemReward: (rewardId: string) => rpc('redeem_reward', { p_reward_id: rewardId, p_idempotency_key: `${rewardId}-${Date.now()}` }),
    reviewReward: (redemptionId: string, approve: boolean) => rpc('review_reward_redemption', { p_redemption_id: redemptionId, p_approve: approve }),
  };
}

function dateKey(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function startOfWeek(date: string) { const value = new Date(`${date}T00:00:00Z`); const day = value.getUTCDay() || 7; value.setUTCDate(value.getUTCDate() - day + 1); return value.toISOString().slice(0, 10); }
function addDays(date: string, days: number) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function mergeRowsById<T extends { id: string }>(first: T[], second: T[]) { const rows = new Map<string, T>(); for (const row of [...first,...second]) rows.set(row.id,row); return [...rows.values()]; }

function calculateWeeklyAvailability(rows: any[], childId: string, dateOfBirth: string | null, weekStart: string) {
  let total = 0;
  for (const row of rows.filter(item => item.child_id === childId)) {
    const template = row.quest_templates as { star_reward: number; is_active: boolean; kind: QuestKind; minimum_age: number | null; maximum_age: number | null } | null;
    if (!template?.is_active) continue;
    if (template.kind === 'guild' && (row.days_of_week as number[]).length === 7) {
      const activeDuringWeek = row.starts_on <= addDays(weekStart, 6) && (!row.ends_on || row.ends_on >= weekStart);
      const age = dateOfBirth ? ageOnDate(dateOfBirth, weekStart) : null;
      if (activeDuringWeek && (age === null || template.minimum_age === null || age >= template.minimum_age) && (age === null || template.maximum_age === null || age <= template.maximum_age)) total += template.star_reward;
      continue;
    }
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const occurrenceDate = addDays(weekStart, dayOffset);
      const isoDay = dayOffset + 1;
      if (!(row.days_of_week as number[]).includes(isoDay)) continue;
      if (occurrenceDate < row.starts_on || (row.ends_on && occurrenceDate > row.ends_on)) continue;
      const age = dateOfBirth ? ageOnDate(dateOfBirth, occurrenceDate) : null;
      if (age !== null && template.minimum_age !== null && age < template.minimum_age) continue;
      if (age !== null && template.maximum_age !== null && age > template.maximum_age) continue;
      total += template.star_reward;
    }
  }
  return total;
}

function ageOnDate(dateOfBirth: string, date: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const current = new Date(`${date}T00:00:00Z`);
  let age = current.getUTCFullYear() - birth.getUTCFullYear();
  if (current.getUTCMonth() < birth.getUTCMonth() || (current.getUTCMonth() === birth.getUTCMonth() && current.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function mapTemplate(row: any): Quest { return { id: row.id, templateId: row.id, catalogQuestId: row.catalog_quest_id ?? undefined, title: row.title, description: row.description ?? '', emoji: row.icon_key?.length <= 3 ? row.icon_key : '✨', kind: row.kind as QuestKind, cadence: row.cadence, scheduleLabel: row.schedule_label ?? 'Every day', status: 'available', stars: row.star_reward, xp: row.xp_reward, timerMinutes: row.timer_seconds ? row.timer_seconds / 60 : undefined, minimumAge: row.minimum_age ?? undefined, maximumAge: row.maximum_age ?? undefined }; }
function mapCatalogQuest(row: any): Quest { return { id: row.id, catalogQuestId: row.id, title: row.title, description: row.description ?? '', emoji: row.icon_key?.length <= 3 ? row.icon_key : '✨', kind: row.kind as QuestKind, cadence: row.cadence, scheduleLabel: row.schedule_label ?? 'Every day', status: 'available', stars: row.star_reward, xp: row.xp_reward, timerMinutes: row.timer_seconds ? row.timer_seconds / 60 : undefined, minimumAge: row.minimum_age ?? undefined, maximumAge: row.maximum_age ?? undefined }; }
function mapInstance(row: any): Quest { const t = row.quest_templates; return { id: row.id, instanceId: row.id, templateId: row.quest_template_id, title: t.title, description: t.description ?? '', emoji: t.icon_key?.length <= 3 ? t.icon_key : '✨', kind: t.kind as QuestKind, cadence: t.cadence, scheduleLabel: t.schedule_label, status: row.status as QuestStatus, stars: row.star_reward_snapshot, xp: row.xp_reward_snapshot, timerMinutes: t.timer_seconds ? t.timer_seconds / 60 : undefined, timerStartedAt: row.timer_started_at ?? undefined, timerEndsAt: row.timer_expected_end_at ?? undefined, timerCompletedAt: row.submitted_at ?? undefined, minimumAge: t.minimum_age ?? undefined, maximumAge: t.maximum_age ?? undefined, cutoffLabel: row.cutoff_at ? new Date(row.cutoff_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : undefined }; }
function mapReward(row: any): Reward { return { id: row.id, rewardId: row.id, catalogRewardId: row.catalog_reward_id ?? undefined, title: row.title, subtitle: row.description ?? 'Parent-approved reward', emoji: row.icon_key || '🎁', cost: row.star_cost }; }
function mapCatalogReward(row: any): Reward { return { id: row.id, catalogRewardId: row.id, title: row.title, subtitle: row.description ?? 'Parent-approved reward', emoji: row.icon_key || '🎁', cost: row.star_cost }; }
function mapRedemption(row: any, heroName: string, availableStars: number): RewardRedemption { const reward = row.rewards as { title: string; description?: string; icon_key?: string }; return { id: row.id, rewardId: row.reward_id, childId: row.child_id, heroName, title: reward.title, subtitle: reward.description ?? 'Parent-approved reward', emoji: reward.icon_key || '🎁', cost: row.star_cost_snapshot, availableStars, requestedAt: row.requested_at }; }

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') return cause.message;
  return 'Could not load Home Hero';
}
