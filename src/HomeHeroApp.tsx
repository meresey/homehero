import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppFrame, EmptyState, PageHeading, Panel, Pill, ProgressBar, QuestCard } from './components';
import { questCatalog as demoQuestCatalog, rewardCatalog as demoRewardCatalog, rewards } from './data';
import { colors } from './theme';
import { Quest, QuestCompletion, Reward, RewardRedemption, StreakAward } from './types';
import { QuestAdmin } from './QuestAdmin';
import { RewardAdmin } from './RewardAdmin';
import { AuthScreen, OnboardingScreen } from './AuthFlow';
import { PartyLeaders } from './PartyLeaders';
import { useHomeHeroData } from './useHomeHeroData';
import type { HeroTodayProgress, HeroWeeklyProgress, ManagedHeroAccount, ParentDashboardSummary } from './useHomeHeroData';
import { archiveQuest, restoreQuest as restoreQuestInDatabase, saveQuest as saveQuestToDatabase } from './lib/questAdmin';
import { archiveReward, restoreReward as restoreRewardInDatabase, saveReward as saveRewardToDatabase } from './lib/rewardAdmin';
import { getHeroLevelProgress, HeroLevel, heroLevels } from './levels';
import { LevelAdmin } from './LevelAdmin';
import { useHouseholdState } from './useHouseholdState';
import { HouseholdDashboard } from './HouseholdDashboard';
import { HouseholdReview } from './HouseholdReview';
import { usePersistentState } from './usePersistentState';
import { supabase } from './lib/supabase';
import { HeroEnrollmentModal } from './HeroEnrollment';
import { HeroCredentialsModal } from './HeroCredentials';

type Role = 'child' | 'parent';
type ChildTab = 'today' | 'week' | 'store' | 'hero';
type ParentTab = 'home' | 'quests' | 'approvals' | 'rewards' | 'levels';

const showError = (cause: unknown) => Alert.alert('Something went wrong', cause instanceof Error ? cause.message : 'Please try again.');

export function HomeHeroApp() {
  const data = useHomeHeroData();
  const householdData = useHouseholdState();
  const [role, setRole] = useState<Role>('child');
  const [childTab, setChildTab] = useState<ChildTab>('today');
  const [parentTab, setParentTab] = useState<ParentTab>('home');
  const [timerQuest, setTimerQuest] = useState<Quest | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [enrollingHero, setEnrollingHero] = useState(false);
  const [managedHero, setManagedHero] = useState<ManagedHeroAccount | null>(null);
  const [localRewards, setLocalRewards, rewardsHydrated] = usePersistentState<Reward[]>('home-hero.rewards.v1', rewards);
  const [levelDefinitions, setLevelDefinitions, levelsHydrated] = usePersistentState<HeroLevel[]>('home-hero.levels.v1', heroLevels);
  const activeRole = data.backendEnabled && data.family ? data.family.role : role;
  const localActiveQuests = householdData.questTemplates.filter(quest => !quest.archived);
  const localRetiredQuests = householdData.questTemplates.filter(quest => quest.archived);
  const activeLocalRewards = localRewards.filter(reward => !reward.archived);
  const retiredLocalRewards = localRewards.filter(reward => reward.archived);
  const quests = data.backendEnabled ? data.quests : activeRole === 'child' ? householdData.selectedQuests : localActiveQuests;
  const stars = data.backendEnabled ? data.stars : householdData.selectedBalance.stars;
  const xp = data.backendEnabled ? data.xp : householdData.selectedBalance.lifetimeXp;
  const heroName = data.backendEnabled ? data.family?.displayName ?? 'Hero' : householdData.selectedHero.displayName;
  const earnedBadges = data.backendEnabled ? data.earnedBadges : householdData.selectedBadges;
  const currentHeroLevel = getHeroLevelProgress(xp, levelDefinitions).current;
  const earnedBadgeCount = earnedBadges.length;

  const complete = async (quest: Quest) => {
    if (['rewarded', 'pending_approval', 'expired'].includes(quest.status)) return;
    if (quest.kind === 'timer') {
      try {
        const now = new Date();
        const startedAt = quest.timerStartedAt ?? now.toISOString();
        const endsAt = quest.timerEndsAt ?? new Date(now.getTime() + (quest.timerMinutes ?? 20) * 60_000).toISOString();
        if (new Date(endsAt).getTime() <= now.getTime()) {
          if (data.backendEnabled) await data.finishTimer(quest);
          else householdData.finishTimerQuest(quest);
          Alert.alert('Timer complete!', `${quest.title} was sent to your Party Leader for approval.`);
          return;
        }
        if (quest.status !== 'in_progress') {
          if (data.backendEnabled) await data.startTimer(quest);
          else householdData.startTimerQuest(quest, startedAt, endsAt);
        }
        setTimerQuest({ ...quest, status: 'in_progress', timerStartedAt: startedAt, timerEndsAt: endsAt });
      } catch (cause) { showError(cause); }
      return;
    }
    if (data.backendEnabled) {
      try { await data.completeQuest(quest); Alert.alert('Quest submitted!', 'Your Party Leader has been asked to approve it. Stars and XP will be awarded after approval.'); } catch (cause) { showError(cause); }
      return;
    }
    householdData.submitQuestForApproval(quest);
    Alert.alert('Quest submitted!', 'Your Party Leader has been asked to approve it. Stars and XP will be awarded after approval.');
  };

  const reviewQuest = async (selected: Quest, approve: boolean) => {
    if (data.backendEnabled) { try { await data.reviewQuest(selected, approve); Alert.alert(approve ? 'Quest approved' : 'Try again requested', approve ? `${selected.stars} stars and ${selected.xp} XP awarded.` : `${selected.heroName ?? 'The Hero'} can now try this quest again.`); } catch (cause) { showError(cause); } }
  };

  const reviewReward = async (request: RewardRedemption, approve: boolean) => {
    try {
      await data.reviewReward(request.id, approve);
      Alert.alert(approve ? 'Reward approved' : 'Reward declined', approve
        ? `${request.cost} stars were deducted from ${request.heroName}’s balance.`
        : `${request.heroName} was not charged for this request.`);
    } catch (cause) { showError(cause); }
  };

  const redeem = async (cost: number, title: string, rewardId?: string) => {
    if (stars < cost) return Alert.alert('Keep questing!', `You need ${cost - stars} more stars.`);
    if (data.backendEnabled && rewardId) { try { await data.redeemReward(rewardId); Alert.alert('Request sent!', `A Party Leader will approve “${title}”.`); } catch (cause) { showError(cause); } return; }
    if (!rewardId) return;
    const alreadyPending = householdData.state.rewardRequests.some(request => request.heroId === householdData.selectedHero.id && request.rewardId === rewardId && request.status === 'pending');
    if (alreadyPending) return Alert.alert('Already requested', `“${title}” is waiting for your Party Leader to review it.`);
    householdData.requestReward(rewardId, cost);
    Alert.alert('Request sent!', `A Party Leader will approve “${title}”. Your stars will not be charged until then.`);
  };

  const saveQuest = async (quest: Quest, heroIds: string[] = []) => {
    if (data.backendEnabled) {
      if (!data.family) return false;
      try {
        await saveQuestToDatabase({ householdId: data.family.householdId, childIds: heroIds, templateId: quest.templateId, catalogQuestId: quest.catalogQuestId, title: quest.title, description: quest.description, iconKey: quest.emoji, cadence: quest.cadence ?? 'daily', stars: quest.stars, xp: quest.xp, timerMinutes: quest.timerMinutes, daysOfWeek: quest.cadence === 'weekly' ? [1] : [1,2,3,4,5,6,7], scheduleLabel: quest.scheduleLabel, minimumAge: quest.minimumAge, maximumAge: quest.maximumAge });
        await data.refresh(); Alert.alert('Quest saved', `“${quest.title}” is ready.`);
        return true;
      } catch (cause) { throw cause; }
    }
    householdData.saveHouseholdQuest(quest, heroIds);
    const names = householdData.state.heroes.filter(hero => heroIds.includes(hero.id)).map(hero => hero.displayName);
    Alert.alert('Quest saved', `“${quest.title}” is ready for ${names.join(', ')}.`);
    return true;
  };

  const removeQuest = async (id: string) => {
    if (data.backendEnabled) { try { await archiveQuest(id); await data.refresh(); return true; } catch (cause) { showError(cause); return false; } }
    if (householdData.state.guildApprovals.some(item => item.questId === id && item.status === 'pending')) return false;
    householdData.removeHouseholdQuest(id);
    return true;
  };

  const restoreQuest = async (id: string) => {
    if (data.backendEnabled) { try { await restoreQuestInDatabase(id); await data.refresh(); return true; } catch (cause) { showError(cause); return false; } }
    householdData.restoreHouseholdQuest(id);
    return true;
  };

  const saveReward = async (reward: Reward) => {
    if (data.backendEnabled) {
      if (!data.family) return false;
      try {
        await saveRewardToDatabase({ householdId: data.family.householdId, rewardId: reward.rewardId, catalogRewardId: reward.catalogRewardId, title: reward.title, description: reward.subtitle, iconKey: reward.emoji, starCost: reward.cost });
        await data.refresh();
        Alert.alert('Reward saved', `“${reward.title}” is now available in the Star Store.`);
        return true;
      } catch (cause) { showError(cause); return false; }
    }
    setLocalRewards(current => current.some(item => item.id === reward.id)
      ? current.map(item => item.id === reward.id ? { ...reward, archived: false } : item)
      : [...current, { ...reward, archived: false }].sort((a, b) => a.cost - b.cost));
    Alert.alert('Reward saved', `“${reward.title}” is now available in the Star Store.`);
    return true;
  };

  const removeReward = async (id: string) => {
    if (data.backendEnabled) { try { await archiveReward(id); await data.refresh(); return true; } catch (cause) { showError(cause); return false; } }
    if (householdData.state.rewardRequests.some(item => item.rewardId === id && item.status === 'pending')) return false;
    setLocalRewards(current => current.map(item => item.id === id ? { ...item, archived: true } : item));
    return true;
  };

  const restoreReward = async (id: string) => {
    if (data.backendEnabled) { try { await restoreRewardInDatabase(id); await data.refresh(); return true; } catch (cause) { showError(cause); return false; } }
    setLocalRewards(current => current.map(item => item.id === id ? { ...item, archived: false } : item));
    return true;
  };

  const signOut = async () => {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) showError(error);
  };

  if ((data.backendEnabled && data.loading) || (!data.backendEnabled && (!householdData.hydrated || !rewardsHydrated || !levelsHydrated))) return <SafeAreaView style={styles.safe}><AppFrame><View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /><Text style={styles.muted}>Loading your hero party…</Text></View></AppFrame></SafeAreaView>;
  if (data.backendEnabled && !data.session) return <AuthScreen />;
  if (data.backendEnabled && !data.family) return <OnboardingScreen refresh={data.refresh} backendError={data.error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <AppFrame>
      <View style={styles.roleBar}>
        <View style={styles.wordmark}><View style={styles.wordmarkIcon}><Ionicons name="shield-checkmark" size={17} color={colors.white} /></View><Text style={styles.logo}>HOME <Text style={{ color: colors.green }}>HERO</Text></Text></View>
        <View style={styles.headerActions}>
          <View style={styles.switcher}>
            {(data.backendEnabled ? [activeRole] : ['child', 'parent'] as Role[]).map(item => (
              <Pressable key={item} onPress={() => setRole(item)} style={[styles.switchButton, role === item && styles.switchActive]}>
                <Text style={[styles.switchText, role === item && styles.switchTextActive]}>{item === 'child' ? 'Hero' : 'Party Leader'}</Text>
              </Pressable>
            ))}
          </View>
          {data.backendEnabled && <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed, signingOut && styles.signOutDisabled]}><Ionicons name="log-out-outline" size={18} color={colors.navy} /><Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text></Pressable>}
        </View>
      </View>

      {activeRole === 'child' ? (
        <>
          <HeroHeader name={heroName} level={currentHeroLevel} stars={stars} xp={xp} badges={earnedBadgeCount} />
          <View style={styles.screen}>
            {childTab === 'today' && <ChildToday quests={quests} xp={xp} levels={levelDefinitions} onQuest={complete} />}
            {childTab === 'week' && <WeeklyBoard history={data.backendEnabled ? [] : householdData.state.completionHistory.filter(item => item.heroId === householdData.selectedHero.id)} quests={quests} streakAwards={data.backendEnabled ? [] : householdData.state.streakAwards.filter(item => item.heroId === householdData.selectedHero.id)} />}
            {childTab === 'store' && <StarStore rewards={data.backendEnabled ? data.rewards : activeLocalRewards} stars={stars} pendingRewardIds={data.backendEnabled ? data.pendingRewardIds : householdData.state.rewardRequests.filter(item => item.heroId === householdData.selectedHero.id && item.status === 'pending').map(item => item.rewardId)} onRedeem={redeem} />}
            {childTab === 'hero' && <HeroProfile name={heroName} stars={stars} xp={xp} levels={levelDefinitions} badges={earnedBadges} />}
          </View>
          <BottomNav value={childTab} onChange={value => setChildTab(value as ChildTab)} items={[
            ['today', 'map-outline', 'Today'], ['week', 'calendar-outline', 'Week'], ['store', 'star-outline', 'Store'], ['hero', 'shield-outline', 'Hero'],
          ]} />
        </>
      ) : (
        <>
          {parentTab === 'home' && !data.backendEnabled && <HouseholdDashboard household={householdData.state.household} heroes={householdData.summaries} levels={levelDefinitions} guildApprovals={householdData.state.guildApprovals} rewardRequests={householdData.state.rewardRequests} onViewHero={heroId => { householdData.setSelectedHero(heroId); setRole('child'); setChildTab('today'); }} onOpenAttention={heroId => { householdData.setSelectedHero(heroId); setParentTab('approvals'); }} />}
          {parentTab === 'home' && data.backendEnabled && <ParentHome householdName={data.family?.householdName ?? 'Your household'} householdId={data.family!.householdId} currentUserId={data.session!.user.id} dashboard={data.parentDashboard} pendingQuests={data.pendingQuests} pendingRewards={data.pendingRewards} runningTimers={data.runningTimers} onEnrollHero={() => setEnrollingHero(true)} onManageHero={setManagedHero} onOpenReview={() => setParentTab('approvals')} onOpenQuests={() => setParentTab('quests')} onOpenRewards={() => setParentTab('rewards')} />}
          {parentTab === 'quests' && <QuestAdmin quests={quests} retiredQuests={data.backendEnabled ? data.retiredQuests : localRetiredQuests} pendingTemplateIds={data.backendEnabled ? data.pendingQuests.map(item => item.templateId ?? item.id) : householdData.state.guildApprovals.filter(item => item.status === 'pending').map(item => item.questId)} heroes={data.backendEnabled ? data.heroes : householdData.state.heroes} assignments={data.backendEnabled ? data.questAssignments : householdData.state.questAssignments} catalog={data.backendEnabled ? data.questCatalog : demoQuestCatalog} onSave={saveQuest} onRemove={removeQuest} onRestore={restoreQuest} />}
          {parentTab === 'approvals' && !data.backendEnabled && <HouseholdReview heroes={householdData.summaries} heroQuests={householdData.state.heroQuests} rewards={localRewards} guildApprovals={householdData.state.guildApprovals} rewardRequests={householdData.state.rewardRequests} onReviewGuild={householdData.reviewGuildApproval} onReviewReward={householdData.reviewRewardRequest} />}
          {parentTab === 'approvals' && data.backendEnabled && <Approvals quests={data.pendingQuests} runningTimers={data.runningTimers} rewards={data.pendingRewards} reviewQuest={reviewQuest} reviewReward={reviewReward} />}
          {parentTab === 'rewards' && <RewardAdmin rewards={data.backendEnabled ? data.rewards : activeLocalRewards} retiredRewards={data.backendEnabled ? data.retiredRewards : retiredLocalRewards} pendingRewardIds={data.backendEnabled ? data.pendingRewards.map(item => item.rewardId) : householdData.state.rewardRequests.filter(item => item.status === 'pending').map(item => item.rewardId)} catalog={data.backendEnabled ? data.rewardCatalog : demoRewardCatalog} onSave={saveReward} onRemove={removeReward} onRestore={restoreReward} />}
          {parentTab === 'levels' && <LevelAdmin levels={levelDefinitions} onSave={updated => setLevelDefinitions(current => current.map(level => level.level === updated.level ? updated : level))} />}
          <BottomNav value={parentTab} onChange={value => setParentTab(value as ParentTab)} items={[
            ['home', 'home-outline', 'Home'], ['quests', 'list-outline', 'Quests'], ['approvals', 'checkmark-done-outline', 'Review'], ['rewards', 'gift-outline', 'Rewards'], ['levels', 'trophy-outline', 'Levels'],
          ]} />
        </>
      )}
      </AppFrame>
      <HeroEnrollmentModal visible={enrollingHero} onClose={() => setEnrollingHero(false)} onEnrolled={async (name, username) => { await data.refresh(); Alert.alert('Hero enrolled', `${name} can sign in with username “${username}” and the PIN you created.`); }} />
      <HeroCredentialsModal hero={managedHero} onClose={() => setManagedHero(null)} onSaved={async (username, pinChanged) => { await data.refresh(); Alert.alert('Hero login updated', `Username: ${username}${pinChanged ? ' · PIN reset complete' : ''}`); }} />
      <TimerModal quest={timerQuest} onClose={() => setTimerQuest(null)} onFinish={async () => { if (!timerQuest) return; try { if (data.backendEnabled) await data.finishTimer(timerQuest); else householdData.finishTimerQuest(timerQuest); setTimerQuest(null); Alert.alert('Timer complete!', `${timerQuest.title} was sent to your Party Leader for approval.`); } catch (cause) { showError(cause); } }} />
    </SafeAreaView>
  );
}

function HeroHeader({ name, level, stars, xp, badges }: { name: string; level: HeroLevel; stars: number; xp: number; badges: number }) {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toUpperCase();
  return <LinearGradient colors={[colors.navy, '#284A7D']} style={styles.sharedHeroHeader}>
    <View style={styles.levelShield}><Text style={styles.levelSmall}>LEVEL</Text><Text style={styles.levelNumber}>{level.level}</Text></View>
    <View style={styles.heroHeaderCopy}><Text style={styles.eyebrow}>{weekday} · HERO DASHBOARD</Text><Text style={styles.greeting}>{name}</Text><Text style={styles.heroSub}>{level.title} · Every small win builds a hero.</Text></View>
    <View style={styles.heroStats}>
      <View style={styles.heroStat}><Text style={styles.heroStatIcon}>⭐</Text><View><Text style={styles.heroStatValue}>{stars}</Text><Text style={styles.heroStatLabel}>STARS</Text></View></View>
      <View style={styles.heroStat}><Text style={styles.heroStatIcon}>✦</Text><View><Text style={styles.heroStatValue}>{xp}</Text><Text style={styles.heroStatLabel}>XP</Text></View></View>
      <View style={styles.heroStat}><Text style={styles.heroStatIcon}>🏅</Text><View><Text style={styles.heroStatValue}>{badges}</Text><Text style={styles.heroStatLabel}>BADGES</Text></View></View>
    </View>
  </LinearGradient>;
}

function ChildToday({ quests, xp, levels, onQuest }: { quests: Quest[]; xp: number; levels: HeroLevel[]; onQuest: (q: Quest) => void }) {
  const compact = useWindowDimensions().width < 380;
  const earned = quests.filter(q => q.status === 'rewarded').length;
  const level = getHeroLevelProgress(xp, levels);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Panel>
        <View style={[styles.sectionHeader, compact && styles.levelHeaderCompact]}><View style={[styles.levelHeaderCopy, compact && styles.levelHeaderCopyCompact]}><Text style={styles.cardTitle}>Level {level.current.level} · {level.current.title}</Text><Text style={styles.muted}>{level.lifetimeXp} lifetime XP{level.next ? ` · ${level.earnedThisLevel} of ${level.levelRange} this level` : ''}</Text></View><Pill tone="gold">{level.next ? `${level.remainingXp} XP TO LEVEL ${level.next.level}` : 'MAX LEVEL'}</Pill></View>
        <ProgressBar value={level.earnedThisLevel} max={level.levelRange} color={colors.gold} />
      </Panel>
      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Today's quests</Text><Text style={styles.muted}>{earned} of {quests.length} complete</Text></View><Pill>{quests.length ? Math.round(earned / quests.length * 100) : 0}%</Pill></View>
      {quests.map(quest => <QuestCard key={quest.id} quest={quest} onPress={() => onQuest(quest)} />)}
      <Panel style={{ backgroundColor: '#FFF7DE' }}><Text style={styles.tipTitle}>⚡ Perfect week in reach</Text><Text style={styles.muted}>Keep your daily quests going through Sunday to earn +5 bonus XP.</Text></Panel>
    </ScrollView>
  );
}

function WeeklyBoard({ history, quests, streakAwards }: { history: QuestCompletion[]; quests: Quest[]; streakAwards: StreakAward[] }) {
  const now = new Date();
  const dayNumber = now.getDay() || 7;
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - dayNumber + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday); date.setDate(monday.getDate() + index);
    const dateKey = localDateKey(date);
    const completions = history.filter(item => localDateKey(new Date(item.completedAt)) === dateKey);
    return { date, dateKey, label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date), stars: completions.reduce((sum, item) => sum + item.stars, 0), done: completions.length > 0, today: dateKey === localDateKey(now) };
  });
  const total = days.reduce((sum, day) => sum + day.stars, 0);
  const target = 30;
  const questStreaks = quests.filter(quest => quest.kind !== 'guild').map(quest => ({ quest, days: currentStreak(history, quest.templateId ?? quest.id, now) })).filter(item => item.days > 0).sort((a, b) => b.days - a.days).slice(0, 3);
  const dateRange = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(monday)}–${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(sunday)}`;
  const bonuses = streakAwards.filter(item => item.weekStart === localDateKey(monday)).reduce((sum, item) => sum + item.xpAwarded, 0);
  return <ScrollView contentContainerStyle={styles.content}><PageHeading eyebrow="HERO JOURNEY" title="Weekly adventure" subtitle={`Monday to Sunday · ${dateRange}`} />
    <Panel><View style={styles.sectionHeader}><View><Text style={styles.cardTitle}>Weekend bonus</Text><Text style={styles.muted}>{total} of {target} stars</Text></View><Text style={styles.bigStar}>⭐</Text></View><ProgressBar value={total} max={target} /><Text style={styles.encourage}>{total >= target ? 'Weekend reward unlocked!' : `${target - total} more stars unlock the weekend reward.`}</Text></Panel>
    <Panel><Text style={styles.cardTitle}>Your quest trail</Text><View style={styles.weekRow}>{days.map(item => <View key={item.dateKey} style={styles.day}><Text style={styles.dayLabel}>{item.label}</Text><View style={[styles.dayDot, item.done && styles.dayDone, item.today && styles.dayToday]}><Text style={styles.dayValue}>{item.done ? '✓' : item.today ? '•' : ''}</Text></View><Text style={styles.dayStars}>{item.stars ? `⭐${item.stars}` : '—'}</Text></View>)}</View></Panel>
    <Panel><View style={styles.sectionHeader}><Text style={styles.cardTitle}>Quest streaks</Text>{bonuses > 0 && <Pill tone="gold">+{bonuses} XP</Pill>}</View>{questStreaks.length === 0 ? <Text style={[styles.muted, { marginTop: 12 }]}>Complete the same daily quest on consecutive days to start a streak.</Text> : questStreaks.map(item => <View key={item.quest.id} style={styles.statRow}><Text style={styles.statEmoji}>{item.quest.emoji}</Text><Text style={styles.statName}>{item.quest.title}</Text><Pill tone="gold">🔥 {item.days} day{item.days === 1 ? '' : 's'}</Pill></View>)}</Panel>
  </ScrollView>;
}

function StarStore({ rewards: storeRewards, stars, pendingRewardIds, onRedeem }: { rewards: typeof rewards; stars: number; pendingRewardIds: string[]; onRedeem: (cost: number, title: string, id: string) => void }) {
  return <ScrollView contentContainerStyle={styles.content}><PageHeading eyebrow="HERO JOURNEY" title="Star Store" subtitle="Real rewards for heroic habits" action={<View style={styles.starBalance}><Text style={styles.starBalanceText}>⭐ {stars}</Text></View>} />
    {storeRewards.length === 0 ? <EmptyState icon="gift-outline" title="Store opening soon" description="Your Party Leader has not added rewards yet." /> : storeRewards.map(reward => {
      const pending = pendingRewardIds.includes(reward.id);
      const canBuy = stars >= reward.cost && !pending;
      return <View key={reward.id} style={styles.storeCard}><Text style={styles.storeEmoji}>{reward.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.questTitle}>{reward.title}</Text><Text style={styles.muted}>{reward.subtitle}</Text>{pending ? <Text style={styles.pendingReward}>Waiting for Party Leader</Text> : stars < reward.cost && <Text style={styles.starsNeeded}>{reward.cost - stars} more stars needed</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel={pending ? `${reward.title} awaiting approval` : `Buy ${reward.title} for ${reward.cost} stars`} accessibilityState={{ disabled: !canBuy }} disabled={!canBuy} onPress={() => onRedeem(reward.cost, reward.title, reward.id)} style={[styles.buyButton, !canBuy && styles.buyButtonDisabled]}><Text style={[styles.buyButtonText, !canBuy && styles.buyButtonTextDisabled]}>{pending ? 'Awaiting approval' : `Buy · ${reward.cost} ⭐`}</Text></Pressable></View>;
    })}
    <Text style={styles.footnote}>Purchases are requests. A Party Leader approves and fulfills each reward.</Text>
  </ScrollView>;
}

function HeroProfile({ name, stars, xp, levels, badges }: { name: string; stars: number; xp: number; levels: HeroLevel[]; badges: { id: string; emoji: string; name: string }[] }) {
  const level = getHeroLevelProgress(xp, levels);
  return <ScrollView contentContainerStyle={styles.content}><LinearGradient colors={['#EAF3DD','#F7F3E8']} style={styles.profile}><View style={styles.profileShield}><Text style={styles.profileLevel}>{level.current.level}</Text></View><View style={styles.profileHeading}><Text style={styles.profileTitle}>{name} the {level.current.title}</Text><Text style={styles.profileLead}>{level.current.characteristics.join(' · ')}</Text><Text style={styles.qualitiesLabel}>QUALITIES YOU’RE BUILDING</Text></View></LinearGradient>
    <View style={styles.metricGrid}><Panel style={styles.metric}><Text style={styles.metricValue}>{xp}</Text><Text style={styles.muted}>Lifetime XP</Text></Panel><Panel style={styles.metric}><Text style={styles.metricValue}>{stars}</Text><Text style={styles.muted}>Stars to spend</Text></Panel></View>
    <Panel><View style={styles.sectionHeader}><View><Text style={styles.cardTitle}>Level {level.current.level} progress</Text><Text style={styles.muted}>{level.next ? `${level.remainingXp} XP until ${level.next.title}` : 'Highest level reached'}</Text></View><Pill tone="gold">{level.next ? `${level.earnedThisLevel}/${level.levelRange} XP` : 'MAX LEVEL'}</Pill></View><ProgressBar value={level.earnedThisLevel} max={level.levelRange} color={colors.gold} /></Panel>
    <Panel><Text style={styles.cardTitle}>Hero badges</Text>{badges.length === 0 ? <View style={styles.badgeEmpty}><Text style={styles.badgeEmptyIcon}>🏅</Text><View style={{ flex: 1 }}><Text style={styles.badgeEmptyTitle}>No badges earned yet</Text><Text style={styles.muted}>Complete quests and build streaks to unlock achievements.</Text></View></View> : <View style={styles.badges}>{badges.map(badge => <View key={badge.id} style={styles.badge}><Text style={styles.badgeIcon}>{badge.emoji}</Text><Text style={styles.badgeName}>{badge.name}</Text></View>)}</View>}</Panel>
  </ScrollView>;
}

function ParentHome({ householdName, householdId, currentUserId, dashboard, pendingQuests, pendingRewards, runningTimers, onEnrollHero, onManageHero, onOpenReview, onOpenQuests, onOpenRewards }: { householdName: string; householdId: string; currentUserId: string; dashboard: ParentDashboardSummary; pendingQuests: Quest[]; pendingRewards: RewardRedemption[]; runningTimers: Quest[]; onEnrollHero: () => void; onManageHero: (hero: ManagedHeroAccount) => void; onOpenReview: () => void; onOpenQuests: () => void; onOpenRewards: () => void }) {
  const pendingCount = pendingQuests.length + pendingRewards.length;
  const todayTotal = dashboard.todayProgress.reduce((sum, hero) => sum + hero.totalQuests, 0);
  const todayCompleted = dashboard.todayProgress.reduce((sum, hero) => sum + hero.completedQuests, 0);
  const heroCount = dashboard.heroNames.length;
  const summary = heroCount === 0 ? 'Your household is ready for its first Hero.' : `${heroCount} Hero${heroCount === 1 ? '' : 'es'} · ${todayCompleted} of ${todayTotal} quests approved today`;

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <LinearGradient colors={[colors.navy, '#284A7D']} style={styles.parentWelcome}>
      <View style={styles.parentWelcomeCopy}><Text style={styles.parentWelcomeEyebrow}>{householdName.toUpperCase()}</Text><Text style={styles.parentWelcomeTitle}>{greeting()}, {dashboard.leaderName}</Text><Text style={styles.parentWelcomeLead}>{summary}</Text></View>
      <Pressable accessibilityRole="button" onPress={onEnrollHero} style={styles.parentWelcomeButton}><Ionicons name="person-add-outline" size={17} color={colors.navy} /><Text style={styles.parentWelcomeButtonText}>Enroll Hero</Text></Pressable>
    </LinearGradient>

    <View style={styles.dashboardSectionHeader}><View><Text style={styles.sectionTitle}>Needs your attention</Text><Text style={styles.muted}>Decisions and time-sensitive activity.</Text></View>{pendingCount > 0 && <Pill tone="purple">{pendingCount} TO REVIEW</Pill>}</View>
    {pendingCount === 0 && runningTimers.length === 0 && !dashboard.safeZone ? <Panel style={styles.dashboardClear}><View style={styles.dashboardClearIcon}><Ionicons name="checkmark" size={22} color={colors.white} /></View><View style={{ flex: 1 }}><Text style={styles.dashboardClearTitle}>Everything is on track</Text><Text style={styles.muted}>There are no approvals or time-sensitive quests right now.</Text></View></Panel> : <View style={styles.attentionGrid}>
      {pendingCount > 0 && <Pressable accessibilityRole="button" onPress={onOpenReview} style={styles.attentionCard}><View style={[styles.attentionIcon, { backgroundColor: '#EFE8FA' }]}><Ionicons name="checkmark-done-outline" size={22} color={colors.purple} /></View><View style={{ flex: 1 }}><Text style={styles.attentionLabel}>AWAITING REVIEW</Text><Text style={styles.attentionValue}>{pendingCount} item{pendingCount === 1 ? '' : 's'}</Text><Text style={styles.muted}>{pendingQuests.length} quest{pendingQuests.length === 1 ? '' : 's'} · {pendingRewards.length} reward{pendingRewards.length === 1 ? '' : 's'}</Text><Text style={styles.attentionLink}>Open inbox →</Text></View></Pressable>}
      {runningTimers.length > 0 && <Pressable accessibilityRole="button" onPress={onOpenReview} style={styles.attentionCard}><View style={[styles.attentionIcon, { backgroundColor: '#FFF3C9' }]}><Ionicons name="timer-outline" size={22} color="#8A6300" /></View><View style={{ flex: 1 }}><Text style={styles.attentionLabel}>TIMERS RUNNING</Text><Text style={styles.attentionValue}>{runningTimers.length} active</Text><Text style={styles.muted}>{runningTimers.map(timer => timer.heroName ?? 'Hero').slice(0, 2).join(', ')}{runningTimers.length > 2 ? ` +${runningTimers.length - 2}` : ''}</Text><Text style={styles.attentionLink}>View progress →</Text></View></Pressable>}
      {dashboard.safeZone && <View style={styles.attentionCard}><View style={[styles.attentionIcon, { backgroundColor: '#E6ECF6' }]}><Ionicons name="moon-outline" size={22} color={colors.navy} /></View><View style={{ flex: 1 }}><Text style={styles.attentionLabel}>TONIGHT’S SAFE ZONE</Text><Text style={styles.attentionValue}>{formatCutoff(dashboard.safeZone.cutoffAt)}</Text><Text style={styles.muted}>{dashboard.safeZone.heroName} · {dashboard.safeZone.title}</Text><Text style={styles.safeZoneRemaining}>{formatTimeRemaining(dashboard.safeZone.cutoffAt)} remaining</Text></View></View>}
    </View>}

    <View style={styles.dashboardSectionHeader}><View><Text style={styles.sectionTitle}>Today’s Heroes</Text><Text style={styles.muted}>Daily completion and weekly stars, together.</Text></View>{heroCount > 0 && <Pill>{heroCount} HERO{heroCount === 1 ? '' : 'ES'}</Pill>}</View>
    <HeroOverview today={dashboard.todayProgress} weekly={dashboard.weeklyProgress} pendingQuests={pendingQuests} pendingRewards={pendingRewards} runningTimers={runningTimers} onEnrollHero={onEnrollHero} onOpenReview={onOpenReview} />

    <View style={styles.dashboardSectionHeader}><View><Text style={styles.sectionTitle}>Quick actions</Text><Text style={styles.muted}>Go straight to common household tasks.</Text></View></View>
    <View style={styles.quickActions}>
      <DashboardAction icon="add-circle-outline" label="Manage quests" onPress={onOpenQuests} />
      <DashboardAction icon="gift-outline" label="Manage rewards" onPress={onOpenRewards} />
      <DashboardAction icon="person-add-outline" label="Enroll Hero" onPress={onEnrollHero} />
      <DashboardAction icon="checkmark-done-outline" label="Review inbox" onPress={onOpenReview} badge={pendingCount} />
    </View>

    {dashboard.managedHeroes.length > 0 && <Panel><View style={styles.enrollmentCard}><View style={styles.enrollmentCopy}><Text style={styles.cardTitle}>Hero access</Text><Text style={styles.muted}>Manage the child-safe usernames and PINs your Heroes use to sign in.</Text></View></View><View style={styles.heroLoginList}>{dashboard.managedHeroes.map(hero => <View key={hero.userId} style={styles.heroLoginRow}><View style={styles.heroLoginIcon}><Ionicons name="person-outline" size={20} color={colors.navy} /></View><View style={styles.heroLoginCopy}><Text style={styles.heroLoginName}>{hero.displayName}</Text><Text style={styles.heroLoginUsername}>@{hero.username}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Manage ${hero.displayName}'s login`} onPress={() => onManageHero(hero)} style={styles.manageLoginButton}><Ionicons name="key-outline" size={16} color={colors.navy} /><Text style={styles.manageLoginText}>Manage login</Text></Pressable></View>)}</View></Panel>}
    <PartyLeaders householdId={householdId} currentUserId={currentUserId} />
  </ScrollView>;
}

function HeroOverview({ today, weekly, pendingQuests, pendingRewards, runningTimers, onEnrollHero, onOpenReview }: { today: HeroTodayProgress[]; weekly: HeroWeeklyProgress[]; pendingQuests: Quest[]; pendingRewards: RewardRedemption[]; runningTimers: Quest[]; onEnrollHero: () => void; onOpenReview: () => void }) {
  const weeklyByHero = new Map(weekly.map(hero => [hero.childId, hero]));
  if (today.length === 0) return <Panel style={styles.heroOverviewEmpty}><Text style={styles.heroOverviewEmptyIcon}>🦸</Text><Text style={styles.cardTitle}>No Heroes enrolled yet</Text><Text style={[styles.muted, { textAlign: 'center' }]}>Enroll a Hero to assign quests and begin tracking progress.</Text><Pressable accessibilityRole="button" onPress={onEnrollHero} style={styles.enrollButton}><Ionicons name="person-add-outline" size={18} color={colors.white} /><Text style={styles.enrollButtonText}>Enroll your first Hero</Text></Pressable></Panel>;
  return <View style={styles.heroOverviewGrid}>{today.map(hero => {
    const week = weeklyByHero.get(hero.childId);
    const todayPercentage = hero.totalQuests > 0 ? Math.min(100, Math.round(hero.completedQuests / hero.totalQuests * 100)) : 0;
    const weeklyPercentage = week && week.availableStars > 0 ? Math.min(100, Math.round(week.earnedStars / week.availableStars * 100)) : 0;
    const reviews = pendingQuests.filter(item => item.childId === hero.childId).length + pendingRewards.filter(item => item.childId === hero.childId).length;
    const timers = runningTimers.filter(item => item.childId === hero.childId).length;
    return <Panel key={hero.childId} style={styles.heroOverviewCard}><View style={styles.heroOverviewHeader}><View style={styles.heroAvatar}><Text style={styles.heroAvatarText}>{hero.heroName.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.heroOverviewName}>{hero.heroName}</Text><Text style={styles.muted}>{reviews > 0 ? `${reviews} awaiting review` : timers > 0 ? `${timers} timer${timers === 1 ? '' : 's'} running` : 'No action needed'}</Text></View>{reviews > 0 && <Pressable onPress={onOpenReview}><Pill tone="purple">REVIEW</Pill></Pressable>}</View>
      <View style={styles.heroMetricHeader}><Text style={styles.heroMetricLabel}>TODAY</Text><Text style={styles.heroMetricValue}>{hero.completedQuests}/{hero.totalQuests} quests · {todayPercentage}%</Text></View><ProgressBar value={hero.completedQuests} max={Math.max(hero.totalQuests, 1)} />
      <View style={styles.heroMetricHeader}><Text style={styles.heroMetricLabel}>THIS WEEK</Text><Text style={styles.heroMetricValue}>{week?.earnedStars ?? 0}/{week?.availableStars ?? 0} stars · {weeklyPercentage}%</Text></View><ProgressBar value={week?.earnedStars ?? 0} max={Math.max(week?.availableStars ?? 0, 1)} color={colors.gold} />
      {(reviews > 0 || timers > 0) && <View style={styles.heroStatusRow}>{reviews > 0 && <Text style={styles.heroStatusText}>🔔 {reviews} to review</Text>}{timers > 0 && <Text style={styles.heroStatusText}>⏱️ {timers} active</Text>}</View>}
    </Panel>;
  })}</View>;
}

function DashboardAction({ icon, label, onPress, badge = 0 }: { icon: string; label: string; onPress: () => void; badge?: number }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: .75 }]}><View style={styles.quickActionIcon}><Ionicons name={icon as never} size={21} color={colors.green} /></View><Text style={styles.quickActionLabel}>{label}</Text>{badge > 0 && <View style={styles.quickActionBadge}><Text style={styles.quickActionBadgeText}>{badge}</Text></View>}</Pressable>;
}

function TodayProgress({ heroes }: { heroes: HeroTodayProgress[] }) {
  return <Panel style={styles.todayProgress}><View style={styles.sectionHeader}><Text style={styles.cardTitle}>Quests today</Text>{heroes.length > 0 && <Pill>{heroes.length} HERO{heroes.length === 1 ? '' : 'ES'}</Pill>}</View>
    {heroes.length === 0 ? <View style={styles.todayEmpty}><Text style={styles.todayEmptyIcon}>🦸</Text><View style={{ flex: 1 }}><Text style={styles.todayHeroName}>No Heroes enrolled yet</Text><Text style={styles.muted}>Enroll a Hero to begin tracking today’s quests.</Text></View></View> : heroes.map((hero, index) => {
      const percentage = hero.totalQuests > 0 ? Math.min(100, Math.round(hero.completedQuests / hero.totalQuests * 100)) : 0;
      const allComplete = hero.totalQuests > 0 && hero.completedQuests >= hero.totalQuests;
      return <View key={hero.childId} style={[styles.todayHero, index > 0 && styles.todayHeroDivider]}>
        <View style={styles.todayHeroHeader}><Text style={styles.todayHeroName}>{hero.heroName}</Text>{hero.totalQuests > 0 && <Pill tone={allComplete ? 'gold' : 'green'}>{allComplete ? 'ALL DONE' : `${percentage}%`}</Pill>}</View>
        {hero.totalQuests > 0 ? <><View style={styles.todayProgressBar}><ProgressBar value={hero.completedQuests} max={hero.totalQuests} /></View><Text style={styles.todayQuestCount}>{hero.completedQuests} of {hero.totalQuests} quests completed</Text></> : <Text style={styles.todayNoQuests}>No quests are scheduled for {hero.heroName} today.</Text>}
      </View>;
    })}
  </Panel>;
}

function WeeklyProgress({ heroes }: { heroes: HeroWeeklyProgress[] }) {
  return <Panel><View style={styles.sectionHeader}><Text style={styles.cardTitle}>Weekly progress</Text>{heroes.length > 0 && <Pill>{heroes.length} HERO{heroes.length === 1 ? '' : 'ES'}</Pill>}</View>
    {heroes.length === 0 ? <View style={styles.weeklyEmpty}><Text style={styles.weeklyEmptyIcon}>⭐</Text><View style={{ flex: 1 }}><Text style={styles.weeklyHeroName}>No Heroes enrolled yet</Text><Text style={styles.muted}>Add a Hero to begin tracking weekly stars.</Text></View></View> : heroes.map((hero, index) => {
      const percentage = hero.availableStars > 0 ? Math.min(100, Math.round(hero.earnedStars / hero.availableStars * 100)) : 0;
      const goalRemaining = hero.goalStars === null ? null : Math.max(0, hero.goalStars - hero.earnedStars);
      return <View key={hero.childId} style={[styles.weeklyHero, index > 0 && styles.weeklyHeroDivider]}>
        <View style={styles.weeklyHeroHeader}><Text style={styles.weeklyHeroName}>{hero.heroName}</Text>{hero.availableStars > 0 && <Pill tone={hero.earnedStars >= hero.availableStars ? 'gold' : 'green'}>{hero.earnedStars >= hero.availableStars ? 'ALL EARNED' : `${percentage}%`}</Pill>}</View>
        {hero.availableStars > 0 ? <><View style={styles.dashboardProgress}><ProgressBar value={hero.earnedStars} max={hero.availableStars} /></View><Text style={styles.encourage}>{hero.earnedStars} of {hero.availableStars} available stars earned</Text></> : <Text style={styles.weeklyNoQuests}>No quests are scheduled for {hero.heroName} this week.</Text>}
        {hero.goalStars !== null && <Text style={[styles.weeklyGoal, goalRemaining === 0 && styles.weeklyGoalMet]}>Weekly goal: {hero.goalStars} stars · {goalRemaining === 0 ? 'Goal met!' : `${goalRemaining} to go`}</Text>}
      </View>;
    })}
  </Panel>;
}

function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; }
function formatCutoff(value: string) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function formatTimeRemaining(value: string) { const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60_000)); return minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'Due now'; }

function Approvals({ quests, runningTimers, rewards: rewardRequests, reviewQuest, reviewReward }: { quests: Quest[]; runningTimers: Quest[]; rewards: RewardRedemption[]; reviewQuest: (q: Quest, approve: boolean) => void; reviewReward: (request: RewardRedemption, approve: boolean) => void }) {
  const [now, setNow] = useState(Date.now());
  const pending = quests.filter(q => q.status === 'pending_approval');
  const runningTimerEnd = [...runningTimers, ...pending].find(q => q.kind === 'timer' && q.timerEndsAt && new Date(q.timerEndsAt).getTime() > now)?.timerEndsAt;
  useEffect(() => {
    if (!runningTimerEnd) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningTimerEnd]);
  return <ScrollView contentContainerStyle={styles.content}><PageHeading eyebrow="PARTY LEADER" title="Approval inbox" subtitle="Celebrate effort, then award points." />
    {pending.length === 0 && runningTimers.length === 0 && rewardRequests.length === 0 ? <EmptyState icon="checkmark-circle-outline" title="All caught up!" description="Quest completions, active timers, and reward requests will appear here." /> : <>
      {runningTimers.map(q => {
        const remainingSeconds = q.timerEndsAt ? Math.max(0, Math.ceil((new Date(q.timerEndsAt).getTime() - now) / 1000)) : 0;
        return <Panel key={`running-${q.id}`}><Text style={styles.eyebrowDark}>TIMED QUEST · IN PROGRESS</Text><Text style={styles.approvalQuest}>{q.emoji} {q.heroName ? `${q.heroName} is doing ` : ''}{q.title}</Text><Text style={styles.muted}>{q.description}</Text><View style={styles.timerApprovalNotice}><Text style={styles.timerApprovalTitle}>⏱️ {remainingSeconds > 0 ? `Time remaining · ${formatCountdown(remainingSeconds)}` : 'Countdown complete'}</Text><Text style={styles.timerApprovalText}>{remainingSeconds > 0 ? 'This quest is visible for monitoring. Approval becomes available after the Hero submits it.' : 'Waiting for the Hero to reopen the quest and submit the completed timer.'}</Text></View></Panel>;
      })}
      {rewardRequests.map(request => {
        const enoughStars = request.availableStars >= request.cost;
        return <Panel key={request.id}><Text style={styles.eyebrowDark}>REWARD REQUEST</Text><Text style={styles.approvalQuest}>{request.emoji} {request.heroName} wants {request.title}</Text><Text style={styles.muted}>{request.subtitle}</Text><Text style={styles.rewardBalance}>{request.cost} stars · {request.availableStars} available</Text>{!enoughStars && <View style={styles.balanceError}><Text style={styles.balanceErrorTitle}>Not enough stars</Text><Text style={styles.balanceErrorText}>{request.heroName} needs {request.cost - request.availableStars} more stars before this reward can be approved.</Text></View>}<View style={styles.reviewActions}><Pressable style={styles.secondaryButton} onPress={() => reviewReward(request, false)}><Text style={styles.secondaryText}>Decline</Text></Pressable><Pressable accessibilityState={{ disabled: !enoughStars }} disabled={!enoughStars} style={[styles.primaryButton, !enoughStars && styles.primaryButtonDisabled]} onPress={() => reviewReward(request, true)}><Text style={[styles.primaryText, !enoughStars && styles.primaryTextDisabled]}>Approve · −{request.cost} ⭐</Text></Pressable></View></Panel>;
      })}
      {pending.map(q => {
        const timed = q.kind === 'timer';
        const remainingSeconds = timed && q.timerEndsAt ? Math.max(0, Math.ceil((new Date(q.timerEndsAt).getTime() - now) / 1000)) : 0;
        const timerFinished = !timed || Boolean(q.timerCompletedAt && q.timerEndsAt && new Date(q.timerEndsAt).getTime() <= now);
        return <Panel key={q.id}><Text style={styles.eyebrowDark}>{questKindLabel(q.kind)} · {timerFinished ? 'READY FOR REVIEW' : 'TIMER RUNNING'}</Text><Text style={styles.approvalQuest}>{q.emoji} {q.heroName ? `${q.heroName} submitted ` : ''}{q.title}</Text><Text style={styles.muted}>{q.description}</Text>{!timerFinished && <View style={styles.timerApprovalNotice}><Text style={styles.timerApprovalTitle}>⏱️ {remainingSeconds > 0 ? `Timer still running · ${formatCountdown(remainingSeconds)}` : 'Timer completion not verified'}</Text><Text style={styles.timerApprovalText}>{remainingSeconds > 0 ? 'Approval unlocks automatically when the countdown reaches zero.' : 'The Hero must complete the timer before this quest can be approved.'}</Text></View>}<View style={styles.reviewActions}><Pressable style={styles.secondaryButton} onPress={() => reviewQuest(q, false)}><Text style={styles.secondaryText}>Try again</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !timerFinished }} disabled={!timerFinished} style={[styles.primaryButton, !timerFinished && styles.primaryButtonDisabled]} onPress={() => reviewQuest(q, true)}><Text style={[styles.primaryText, !timerFinished && styles.primaryTextDisabled]}>{timerFinished ? `Approve · +${q.stars} ⭐ · +${q.xp} XP` : remainingSeconds > 0 ? `Wait · ${formatCountdown(remainingSeconds)}` : 'Cannot approve'}</Text></Pressable></View></Panel>;
      })}
    </>}
  </ScrollView>;
}

function formatCountdown(totalSeconds: number) { return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`; }

function questKindLabel(kind: Quest['kind']) { return kind === 'timer' ? 'TIMED QUEST' : kind === 'guild' ? 'GUILD QUEST' : kind === 'bedtime' ? 'BEDTIME QUEST' : 'DAILY QUEST'; }

function BottomNav({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: string[][] }) {
  return <View style={styles.nav}>{items.map(([id, icon, label]) => <Pressable key={id} onPress={() => onChange(id)} style={styles.navItem}><Ionicons name={icon as never} size={23} color={value === id ? colors.green : colors.muted} /><Text style={[styles.navText, value === id && styles.navActive]}>{label}</Text></Pressable>)}</View>;
}

function TimerModal({ quest, onClose, onFinish }: { quest: Quest | null; onClose: () => void; onFinish: () => void }) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const finished = useRef(false);
  const { width } = useWindowDimensions();
  useEffect(() => {
    finished.current = false;
    if (!quest?.timerEndsAt) { setRemainingSeconds(0); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(quest.timerEndsAt as string).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !finished.current) { finished.current = true; onFinish(); }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [quest?.id, quest?.timerEndsAt]);
  if (!quest) return null;
  const minutes = Math.floor(remainingSeconds / 60); const seconds = remainingSeconds % 60;
  return <Modal animationType="slide" transparent={false} onRequestClose={onClose}><SafeAreaView style={styles.timerSafe}><Pressable accessibilityRole="button" accessibilityLabel="Close timer" onPress={onClose} style={styles.close}><Ionicons name="close" size={28} color={colors.navy} /></Pressable><View style={styles.timerBody}><Text style={styles.timerEmoji}>{quest.emoji}</Text><Pill tone="purple">FOCUS QUEST</Pill><Text style={styles.timerTitle}>{quest.title}</Text><View style={[styles.timerRing, { width: Math.min(width - 80, 280), height: Math.min(width - 80, 280) }]}><Text style={styles.timerTime}>{minutes}:{String(seconds).padStart(2, '0')}</Text><Text style={styles.muted}>remaining</Text></View><Text style={styles.timerHint}>You can close this screen—the timer will keep running.</Text></View></SafeAreaView></Modal>;
}

function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function currentStreak(history: QuestCompletion[], questId: string, now: Date) {
  const dates = new Set(history.filter(item => item.questId === questId).map(item => localDateKey(new Date(item.completedAt))));
  const cursor = new Date(now); cursor.setHours(0, 0, 0, 0);
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(localDateKey(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

const styles = StyleSheet.create({
  levelHeaderCompact: { flexWrap: 'wrap' },
  levelHeaderCopy: { flex: 1, minWidth: 0 },
  levelHeaderCopyCompact: { flexBasis: '100%' },
  safe: { flex: 1, backgroundColor: colors.cream }, screen: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }, content: { padding: 18, paddingBottom: 110, gap: 16 },
  roleBar: { paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cream },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 }, wordmarkIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: colors.navy, fontSize: 19, fontWeight: '900', letterSpacing: 1 }, switcher: { flexDirection: 'row', backgroundColor: '#EAE5D9', borderRadius: 12, padding: 3 },
  switchButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 }, switchActive: { backgroundColor: colors.white }, switchText: { fontSize: 11, color: colors.muted, fontWeight: '700' }, switchTextActive: { color: colors.navy },
  signOutButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 5 }, signOutPressed: { opacity: .75 }, signOutDisabled: { opacity: .55 }, signOutText: { color: colors.navy, fontSize: 11, fontWeight: '800' },
  sharedHeroHeader: { marginHorizontal: 18, marginBottom: 2, borderRadius: 22, padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 13 }, levelShield: { width: 58, height: 66, backgroundColor: colors.green, borderWidth: 3, borderColor: colors.gold, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, levelSmall: { color: colors.white, fontSize: 8, fontWeight: '900' }, levelNumber: { color: colors.white, fontSize: 31, lineHeight: 34, fontWeight: '900' }, heroHeaderCopy: { flexGrow: 1, flexBasis: 150, minWidth: 120 }, heroStats: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 }, heroStat: { minWidth: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.13)' }, heroStatIcon: { fontSize: 16 }, heroStatValue: { color: colors.white, fontSize: 15, lineHeight: 17, fontWeight: '900' }, heroStatLabel: { color: '#CBD7EA', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  eyebrow: { color: '#CBD7EA', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, eyebrowDark: { color: colors.purple, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, greeting: { color: colors.white, fontSize: 21, fontWeight: '900' }, heroSub: { color: '#DCE5F2', fontSize: 10, lineHeight: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, inviteCode: { color: colors.green, fontSize: 28, fontWeight: '900', letterSpacing: 4, marginVertical: 8 }, questTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 }, sectionTitle: { fontSize: 21, color: colors.navy, fontWeight: '900' }, pageTitle: { fontSize: 27, color: colors.navy, fontWeight: '900' }, pageLead: { fontSize: 13, color: colors.muted, marginTop: -12 }, tipTitle: { color: '#7A5700', fontWeight: '900', marginBottom: 4 },
  parentWelcome: { borderRadius: 24, padding: 22, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 }, parentWelcomeCopy: { flex: 1, minWidth: 230, gap: 4 }, parentWelcomeEyebrow: { color: '#BFD0E8', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, parentWelcomeTitle: { color: colors.white, fontSize: 25, lineHeight: 31, fontWeight: '900' }, parentWelcomeLead: { color: '#DCE5F2', fontSize: 12, lineHeight: 18 }, parentWelcomeButton: { minHeight: 42, paddingHorizontal: 15, borderRadius: 13, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, parentWelcomeButtonText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  dashboardSectionHeader: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, dashboardClear: { flexDirection: 'row', alignItems: 'center', gap: 12 }, dashboardClearIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, dashboardClearTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, attentionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, attentionCard: { flexGrow: 1, flexBasis: 250, minWidth: 230, padding: 16, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, attentionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, attentionLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8 }, attentionValue: { color: colors.navy, fontSize: 19, fontWeight: '900', marginTop: 2 }, attentionLink: { color: colors.purple, fontSize: 11, fontWeight: '900', marginTop: 7 }, safeZoneRemaining: { color: '#8A6300', fontSize: 11, fontWeight: '900', marginTop: 7 },
  heroOverviewGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 12 }, heroOverviewCard: { flexGrow: 1, flexBasis: 350, minWidth: 260 }, heroOverviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 15 }, heroAvatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.navy, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }, heroAvatarText: { color: colors.white, fontSize: 20, fontWeight: '900' }, heroOverviewName: { color: colors.navy, fontSize: 17, fontWeight: '900' }, heroMetricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 11, marginBottom: 7 }, heroMetricLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: .8 }, heroMetricValue: { color: colors.ink, fontSize: 11, fontWeight: '800' }, heroStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }, heroStatusText: { color: colors.purple, fontSize: 10, fontWeight: '900' }, heroOverviewEmpty: { alignItems: 'center', gap: 10, paddingVertical: 30 }, heroOverviewEmptyIcon: { fontSize: 38 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, quickAction: { flexGrow: 1, flexBasis: 170, minWidth: 145, minHeight: 70, padding: 13, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }, quickActionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, quickActionLabel: { flex: 1, color: colors.navy, fontSize: 12, fontWeight: '900' }, quickActionBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }, quickActionBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  enrollmentCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }, enrollmentCopy: { flex: 1, minWidth: 220, gap: 4 }, enrollButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 13, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, enrollButtonText: { color: colors.white, fontWeight: '900', fontSize: 12 },
  heroLoginList: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border }, heroLoginRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 13 }, heroLoginIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, heroLoginCopy: { flex: 1 }, heroLoginName: { color: colors.ink, fontSize: 13, fontWeight: '900' }, heroLoginUsername: { color: colors.muted, fontSize: 11, marginTop: 2 }, manageLoginButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 5 }, manageLoginText: { color: colors.navy, fontSize: 10, fontWeight: '900' },
  todayProgress: { width: '100%' }, todayEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 13, padding: 12, borderRadius: 14, backgroundColor: colors.cream }, todayEmptyIcon: { fontSize: 25, opacity: .6 }, todayHero: { paddingTop: 13 }, todayHeroDivider: { marginTop: 13, borderTopWidth: 1, borderTopColor: colors.border }, todayHeroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, todayHeroName: { color: colors.ink, fontSize: 14, fontWeight: '900' }, todayProgressBar: { marginTop: 9 }, todayQuestCount: { color: colors.green, fontSize: 11, fontWeight: '800', marginTop: 7 }, todayNoQuests: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  bigStar: { fontSize: 36 }, encourage: { color: colors.green, fontWeight: '700', fontSize: 12, marginTop: 10 }, weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, day: { alignItems: 'center', gap: 7 }, dayLabel: { fontSize: 10, color: colors.muted, fontWeight: '800' }, dayDot: { width: 33, height: 33, borderRadius: 17, borderWidth: 2, borderColor: '#D9D4C8', justifyContent: 'center', alignItems: 'center' }, dayDone: { backgroundColor: colors.green, borderColor: colors.green }, dayToday: { borderColor: colors.gold }, dayValue: { color: colors.white, fontWeight: '900' }, dayStars: { color: '#836000', fontWeight: '800', fontSize: 10 },
  dashboardProgress: { marginTop: 10 }, weeklyEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15, padding: 14, borderRadius: 15, backgroundColor: colors.cream }, weeklyEmptyIcon: { fontSize: 27, opacity: .55 }, weeklyHero: { paddingTop: 15 }, weeklyHeroDivider: { marginTop: 15, borderTopWidth: 1, borderTopColor: colors.border }, weeklyHeroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, weeklyHeroName: { color: colors.ink, fontSize: 14, fontWeight: '900' }, weeklyNoQuests: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, weeklyGoal: { color: colors.purple, fontSize: 11, fontWeight: '800', marginTop: 7 }, weeklyGoalMet: { color: colors.green }, statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EFECE5' }, statEmoji: { fontSize: 25 }, statName: { flex: 1, fontWeight: '800', color: colors.ink }, storeHeading: { flex: 1, gap: 3 }, storeLead: { color: colors.muted, fontSize: 13, lineHeight: 19 }, starBalance: { backgroundColor: '#FFF0B7', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 }, starBalanceText: { color: '#755400', fontWeight: '900', fontSize: 17 }, storeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, storeEmoji: { fontSize: 34 }, starsNeeded: { color: colors.coral, fontSize: 10, fontWeight: '800', marginTop: 4 }, pendingReward: { color: colors.purple, fontSize: 10, fontWeight: '900', marginTop: 4 }, buyButton: { backgroundColor: colors.navy, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 10 }, buyButtonDisabled: { backgroundColor: '#E1DED5' }, buyButtonText: { color: colors.white, fontWeight: '900', fontSize: 12 }, buyButtonTextDisabled: { color: colors.muted }, footnote: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, paddingHorizontal: 20 },
  profile: { alignItems: 'center', borderRadius: 25, padding: 25 }, profileShield: { width: 92, height: 105, backgroundColor: colors.navy, borderRadius: 26, borderWidth: 5, borderColor: colors.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }, profileLevel: { color: colors.white, fontSize: 52, fontWeight: '900' }, profileHeading: { alignItems: 'center', gap: 5 }, profileTitle: { color: colors.navy, fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center' }, profileLead: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' }, qualitiesLabel: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 }, metricGrid: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, alignItems: 'center' }, metricValue: { color: colors.green, fontSize: 27, fontWeight: '900' }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 }, badge: { width: '47%', backgroundColor: colors.cream, borderRadius: 15, padding: 13, alignItems: 'center' }, badgeIcon: { fontSize: 28 }, badgeName: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 5 }, badgeEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 15, backgroundColor: colors.cream }, badgeEmptyIcon: { fontSize: 28, opacity: .55 }, badgeEmptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  approvalBanner: { borderRadius: 22, padding: 19 }, approvalTitle: { color: colors.white, fontWeight: '900', fontSize: 17 }, approvalText: { color: '#EFE9F8', marginTop: 5 }, approvalAction: { color: colors.white, fontWeight: '900', marginTop: 14 }, addButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, managerCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }, empty: { alignItems: 'center', paddingVertical: 45 }, emptyIcon: { fontSize: 44, marginBottom: 12 }, approvalQuest: { color: colors.ink, fontSize: 20, fontWeight: '900', marginVertical: 12 }, rewardBalance: { color: colors.green, fontWeight: '900', fontSize: 12, marginTop: 10 }, balanceError: { borderRadius: 13, padding: 12, marginTop: 12, backgroundColor: '#FDE8E5', borderWidth: 1, borderColor: '#F2B8B1' }, balanceErrorTitle: { color: colors.coral, fontWeight: '900', fontSize: 12 }, balanceErrorText: { color: '#8B3D34', fontSize: 11, lineHeight: 16, marginTop: 3 }, timerApprovalNotice: { borderRadius: 13, padding: 12, marginTop: 12, backgroundColor: '#F4EEFC', borderWidth: 1, borderColor: colors.purple }, timerApprovalTitle: { color: colors.purple, fontWeight: '900', fontSize: 12 }, timerApprovalText: { color: colors.ink, fontSize: 11, lineHeight: 16, marginTop: 3 }, reviewActions: { flexDirection: 'row', gap: 10, marginTop: 20 }, secondaryButton: { flex: 1, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }, secondaryText: { color: colors.navy, fontWeight: '800' }, primaryButton: { flex: 1, borderRadius: 14, padding: 14, backgroundColor: colors.green, alignItems: 'center' }, primaryButtonDisabled: { backgroundColor: '#E1DED5' }, primaryText: { color: colors.white, fontWeight: '900' }, primaryTextDisabled: { color: colors.muted },
  nav: { position: 'absolute', left: 12, right: 12, bottom: 8, backgroundColor: colors.white, borderRadius: 22, flexDirection: 'row', paddingVertical: 10, borderWidth: 1, borderColor: colors.border }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navText: { color: colors.muted, fontSize: 10, fontWeight: '700' }, navActive: { color: colors.green, fontWeight: '900' },
  timerSafe: { flex: 1, backgroundColor: colors.cream }, close: { alignSelf: 'flex-end', padding: 20 }, timerBody: { flex: 1, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 16 }, timerEmoji: { fontSize: 50 }, timerTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, timerRing: { borderRadius: 999, borderWidth: 15, borderColor: colors.green, borderTopColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginVertical: 12 }, timerTime: { color: colors.navy, fontSize: 45, fontWeight: '900' }, timerHint: { color: colors.muted, textAlign: 'center', maxWidth: 280 },
});
