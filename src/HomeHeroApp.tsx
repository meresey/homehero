import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Panel, Pill, ProgressBar, QuestCard } from './components';
import { heroBadges, rewards, week } from './data';
import { colors } from './theme';
import { Quest, Reward } from './types';
import { QuestAdmin } from './QuestAdmin';
import { RewardAdmin } from './RewardAdmin';
import { AuthScreen, OnboardingScreen } from './AuthFlow';
import { useHomeHeroData } from './useHomeHeroData';
import { archiveQuest, saveQuest as saveQuestToDatabase } from './lib/questAdmin';
import { getHeroLevelProgress, HeroLevel, heroLevels } from './levels';
import { LevelAdmin } from './LevelAdmin';
import { useHouseholdState } from './useHouseholdState';
import { HouseholdDashboard } from './HouseholdDashboard';
import { HouseholdReview } from './HouseholdReview';

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
  const [localRewards, setLocalRewards] = useState<Reward[]>(rewards);
  const [levelDefinitions, setLevelDefinitions] = useState<HeroLevel[]>(heroLevels);
  const quests = data.backendEnabled ? data.quests : householdData.selectedQuests;
  const stars = data.backendEnabled ? data.stars : householdData.selectedBalance.stars;
  const xp = data.backendEnabled ? data.xp : householdData.selectedBalance.lifetimeXp;
  const heroName = data.backendEnabled ? 'Hero' : householdData.selectedHero.displayName;
  const earnedBadges = data.backendEnabled ? heroBadges.filter(badge => badge.earned) : householdData.selectedBadges;
  const activeRole = data.backendEnabled && data.family ? data.family.role : role;
  const currentHeroLevel = getHeroLevelProgress(xp, levelDefinitions).current;
  const earnedBadgeCount = earnedBadges.length;

  const complete = async (quest: Quest) => {
    if (['rewarded', 'pending_approval', 'expired'].includes(quest.status)) return;
    if (quest.kind === 'timer') {
      try { if (data.backendEnabled) await data.startTimer(quest); setTimerQuest(quest); } catch (cause) { showError(cause); }
      return;
    }
    if (data.backendEnabled) {
      try { await data.completeQuest(quest); if (quest.kind === 'guild') Alert.alert('Guild quest submitted!', 'Your Party Leader has been asked to approve it.'); } catch (cause) { showError(cause); }
      return;
    }
    if (quest.kind === 'guild') {
      householdData.submitGuildQuest(quest);
      return Alert.alert('Guild quest submitted!', 'Your Party Leader has been asked to approve it.');
    }
    award(quest);
  };

  const award = (quest: Quest) => {
    householdData.setSelectedHeroQuests(list => list.map(q => q.id === quest.id ? { ...q, status: 'rewarded' } : q));
    householdData.setSelectedStars(value => value + quest.stars);
    householdData.setSelectedXp(value => value + quest.xp);
    setTimerQuest(null);
  };

  const approveGuild = async (selected?: Quest) => {
    const quest = selected ?? (data.backendEnabled ? data.pendingQuests[0] : quests.find(q => q.status === 'pending_approval'));
    if (!quest) return;
    if (data.backendEnabled) { try { await data.approveGuild(quest); Alert.alert('Quest approved', `${quest.stars} stars and ${quest.xp} XP awarded.`); } catch (cause) { showError(cause); } return; }
    award(quest);
    Alert.alert('Quest approved', `${quest.stars} stars and ${quest.xp} XP awarded.`);
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

  const saveQuest = async (quest: Quest) => {
    if (data.backendEnabled) {
      if (!data.family?.childId) return Alert.alert('Invite your hero first', `Share family code ${data.family?.inviteCode}. Once they join, you can assign quests.`);
      try {
        await saveQuestToDatabase({ householdId: data.family.householdId, childId: data.family.childId, templateId: quest.templateId, title: quest.title, description: quest.description, iconKey: quest.emoji, cadence: quest.cadence ?? 'daily', stars: quest.stars, xp: quest.xp, timerMinutes: quest.timerMinutes, daysOfWeek: quest.cadence === 'weekly' ? [1] : [1,2,3,4,5,6,7], scheduleLabel: quest.scheduleLabel });
        await data.refresh(); Alert.alert('Quest saved', `“${quest.title}” is ready.`);
      } catch (cause) { showError(cause); }
      return;
    }
    householdData.setSelectedHeroQuests(current => current.some(item => item.id === quest.id)
      ? current.map(item => item.id === quest.id ? quest : item)
      : [quest, ...current]);
    Alert.alert('Quest saved', `“${quest.title}” is ready for ${heroName}.`);
  };

  const removeQuest = async (id: string) => {
    if (data.backendEnabled) { try { await archiveQuest(id); await data.refresh(); } catch (cause) { showError(cause); } return; }
    householdData.setSelectedHeroQuests(current => current.filter(item => item.id !== id));
  };

  const saveReward = (reward: Reward) => {
    setLocalRewards(current => current.some(item => item.id === reward.id)
      ? current.map(item => item.id === reward.id ? reward : item)
      : [...current, reward].sort((a, b) => a.cost - b.cost));
    Alert.alert('Reward saved', `“${reward.title}” is now available in the Star Store.`);
  };

  const removeReward = (id: string) => setLocalRewards(current => current.filter(item => item.id !== id));

  if (data.backendEnabled && data.loading) return <SafeAreaView style={[styles.safe, styles.loading]}><ActivityIndicator size="large" color={colors.green} /><Text style={styles.muted}>Loading your hero party…</Text></SafeAreaView>;
  if (data.backendEnabled && !data.session) return <AuthScreen />;
  if (data.backendEnabled && !data.family) return <OnboardingScreen refresh={data.refresh} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.roleBar}>
        <Text style={styles.logo}>HOME <Text style={{ color: colors.green }}>HERO</Text></Text>
        <View style={styles.switcher}>
          {(data.backendEnabled ? [activeRole] : ['child', 'parent'] as Role[]).map(item => (
            <Pressable key={item} onPress={() => setRole(item)} style={[styles.switchButton, role === item && styles.switchActive]}>
              <Text style={[styles.switchText, role === item && styles.switchTextActive]}>{item === 'child' ? 'Hero' : 'Party Leader'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeRole === 'child' ? (
        <>
          <HeroHeader name={heroName} level={currentHeroLevel} stars={stars} xp={xp} badges={earnedBadgeCount} />
          <View style={styles.screen}>
            {childTab === 'today' && <ChildToday quests={quests} xp={xp} levels={levelDefinitions} onQuest={complete} />}
            {childTab === 'week' && <WeeklyBoard />}
            {childTab === 'store' && <StarStore rewards={data.backendEnabled ? data.rewards : localRewards} stars={stars} onRedeem={redeem} />}
            {childTab === 'hero' && <HeroProfile name={heroName} stars={stars} xp={xp} levels={levelDefinitions} badges={earnedBadges} />}
          </View>
          <BottomNav value={childTab} onChange={value => setChildTab(value as ChildTab)} items={[
            ['today', 'map-outline', 'Today'], ['week', 'calendar-outline', 'Week'], ['store', 'star-outline', 'Store'], ['hero', 'shield-outline', 'Hero'],
          ]} />
        </>
      ) : (
        <>
          {parentTab === 'home' && !data.backendEnabled && <HouseholdDashboard household={householdData.state.household} heroes={householdData.summaries} levels={levelDefinitions} guildApprovals={householdData.state.guildApprovals} rewardRequests={householdData.state.rewardRequests} onViewHero={heroId => { householdData.setSelectedHero(heroId); setRole('child'); setChildTab('today'); }} onOpenAttention={(heroId, type) => { householdData.setSelectedHero(heroId); setParentTab(type === 'bedtime' ? 'quests' : 'approvals'); }} />}
          {parentTab === 'home' && data.backendEnabled && <ParentHome quests={quests} pendingQuests={data.pendingQuests} familyCode={data.family?.inviteCode} approveGuild={approveGuild} />}
          {parentTab === 'quests' && <QuestAdmin quests={quests} onSave={saveQuest} onRemove={removeQuest} />}
          {parentTab === 'approvals' && !data.backendEnabled && <HouseholdReview heroes={householdData.summaries} heroQuests={householdData.state.heroQuests} rewards={localRewards} guildApprovals={householdData.state.guildApprovals} rewardRequests={householdData.state.rewardRequests} onReviewGuild={householdData.reviewGuildApproval} onReviewReward={householdData.reviewRewardRequest} />}
          {parentTab === 'approvals' && data.backendEnabled && <Approvals quests={data.pendingQuests} approve={approveGuild} />}
          {parentTab === 'rewards' && <RewardAdmin rewards={data.backendEnabled ? data.rewards : localRewards} onSave={saveReward} onRemove={removeReward} />}
          {parentTab === 'levels' && <LevelAdmin levels={levelDefinitions} onSave={updated => setLevelDefinitions(current => current.map(level => level.level === updated.level ? updated : level))} />}
          <BottomNav value={parentTab} onChange={value => setParentTab(value as ParentTab)} items={[
            ['home', 'home-outline', 'Home'], ['quests', 'list-outline', 'Quests'], ['approvals', 'checkmark-done-outline', 'Review'], ['rewards', 'gift-outline', 'Rewards'], ['levels', 'trophy-outline', 'Levels'],
          ]} />
        </>
      )}
      <TimerModal quest={timerQuest} onClose={() => setTimerQuest(null)} onFinish={async () => { if (!timerQuest) return; try { if (data.backendEnabled) await data.finishTimer(timerQuest); else award(timerQuest); setTimerQuest(null); } catch (cause) { showError(cause); } }} />
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
  const earned = quests.filter(q => q.status === 'rewarded').length;
  const level = getHeroLevelProgress(xp, levels);
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Panel>
        <View style={styles.sectionHeader}><View><Text style={styles.cardTitle}>Level {level.current.level} · {level.current.title}</Text><Text style={styles.muted}>{level.lifetimeXp} lifetime XP{level.next ? ` · ${level.earnedThisLevel} of ${level.levelRange} this level` : ''}</Text></View><Pill tone="gold">{level.next ? `${level.remainingXp} XP TO LEVEL ${level.next.level}` : 'MAX LEVEL'}</Pill></View>
        <ProgressBar value={level.earnedThisLevel} max={level.levelRange} color={colors.gold} />
      </Panel>
      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Today's quests</Text><Text style={styles.muted}>{earned} of {quests.length} complete</Text></View><Pill>{Math.round(earned / quests.length * 100)}%</Pill></View>
      {quests.map(quest => <QuestCard key={quest.id} quest={quest} onPress={() => onQuest(quest)} />)}
      <Panel style={{ backgroundColor: '#FFF7DE' }}><Text style={styles.tipTitle}>⚡ Perfect week in reach</Text><Text style={styles.muted}>Keep your daily quests going through Sunday to earn +5 bonus XP.</Text></Panel>
    </ScrollView>
  );
}

function WeeklyBoard() {
  const total = week.reduce((sum, day) => sum + day.stars, 0);
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Weekly adventure</Text><Text style={styles.pageLead}>Monday to Sunday · Sep 7–13</Text>
    <Panel><View style={styles.sectionHeader}><View><Text style={styles.cardTitle}>Weekend bonus</Text><Text style={styles.muted}>{total} of 30 stars</Text></View><Text style={styles.bigStar}>⭐</Text></View><ProgressBar value={total} max={30} /><Text style={styles.encourage}>11 more stars unlocks Family Movie Night!</Text></Panel>
    <Panel><Text style={styles.cardTitle}>Your quest trail</Text><View style={styles.weekRow}>{week.map((item, i) => <View key={item.day} style={styles.day}><Text style={styles.dayLabel}>{item.day}</Text><View style={[styles.dayDot, item.done && styles.dayDone, i === 4 && styles.dayToday]}><Text style={styles.dayValue}>{item.done ? '✓' : i === 4 ? '•' : ''}</Text></View><Text style={styles.dayStars}>{item.stars ? `⭐${item.stars}` : '—'}</Text></View>)}</View></Panel>
    <Panel><Text style={styles.cardTitle}>Quest streaks</Text>{[['🛏️','Tidy room','5 days'],['📚','Homework','4 days'],['📖','Reading','3 days']].map(row => <View key={row[1]} style={styles.statRow}><Text style={styles.statEmoji}>{row[0]}</Text><Text style={styles.statName}>{row[1]}</Text><Pill tone="gold">🔥 {row[2]}</Pill></View>)}</Panel>
  </ScrollView>;
}

function StarStore({ rewards: storeRewards, stars, onRedeem }: { rewards: typeof rewards; stars: number; onRedeem: (cost: number, title: string, id: string) => void }) {
  return <ScrollView contentContainerStyle={styles.content}><View style={styles.sectionHeader}><View style={styles.storeHeading}><Text style={styles.pageTitle}>Star Store</Text><Text style={styles.storeLead}>Real rewards for heroic habits</Text></View><View style={styles.starBalance}><Text style={styles.starBalanceText}>⭐ {stars}</Text></View></View>
    {storeRewards.length === 0 ? <Panel style={styles.empty}><Text style={styles.emptyIcon}>🎁</Text><Text style={styles.cardTitle}>Store opening soon</Text><Text style={styles.muted}>Your Party Leader has not added rewards yet.</Text></Panel> : storeRewards.map(reward => {
      const canBuy = stars >= reward.cost;
      return <View key={reward.id} style={styles.storeCard}><Text style={styles.storeEmoji}>{reward.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.questTitle}>{reward.title}</Text><Text style={styles.muted}>{reward.subtitle}</Text>{!canBuy && <Text style={styles.starsNeeded}>{reward.cost - stars} more stars needed</Text>}</View><Pressable accessibilityRole="button" accessibilityLabel={`Buy ${reward.title} for ${reward.cost} stars`} accessibilityState={{ disabled: !canBuy }} disabled={!canBuy} onPress={() => onRedeem(reward.cost, reward.title, reward.id)} style={[styles.buyButton, !canBuy && styles.buyButtonDisabled]}><Text style={[styles.buyButtonText, !canBuy && styles.buyButtonTextDisabled]}>Buy · {reward.cost} ⭐</Text></Pressable></View>;
    })}
    <Text style={styles.footnote}>Purchases are requests. A Party Leader approves and fulfills each reward.</Text>
  </ScrollView>;
}

function HeroProfile({ name, stars, xp, levels, badges }: { name: string; stars: number; xp: number; levels: HeroLevel[]; badges: { id: string; emoji: string; name: string }[] }) {
  const level = getHeroLevelProgress(xp, levels);
  return <ScrollView contentContainerStyle={styles.content}><LinearGradient colors={['#EAF3DD','#F7F3E8']} style={styles.profile}><View style={styles.profileShield}><Text style={styles.profileLevel}>{level.current.level}</Text></View><View style={styles.profileHeading}><Text style={styles.profileTitle}>{name} the {level.current.title}</Text><Text style={styles.profileLead}>{level.current.characteristics.join(' · ')}</Text><Text style={styles.qualitiesLabel}>QUALITIES YOU’RE BUILDING</Text></View></LinearGradient>
    <View style={styles.metricGrid}><Panel style={styles.metric}><Text style={styles.metricValue}>{xp}</Text><Text style={styles.muted}>Lifetime XP</Text></Panel><Panel style={styles.metric}><Text style={styles.metricValue}>{stars}</Text><Text style={styles.muted}>Stars to spend</Text></Panel></View>
    <Panel><View style={styles.sectionHeader}><View><Text style={styles.cardTitle}>Level {level.current.level} progress</Text><Text style={styles.muted}>{level.next ? `${level.remainingXp} XP until ${level.next.title}` : 'Highest level reached'}</Text></View><Pill tone="gold">{level.next ? `${level.earnedThisLevel}/${level.levelRange} XP` : 'MAX LEVEL'}</Pill></View><ProgressBar value={level.earnedThisLevel} max={level.levelRange} color={colors.gold} /></Panel>
    <Panel><Text style={styles.cardTitle}>Hero badges</Text><View style={styles.badges}>{badges.map(badge => <View key={badge.id} style={styles.badge}><Text style={styles.badgeIcon}>{badge.emoji}</Text><Text style={styles.badgeName}>{badge.name}</Text></View>)}</View></Panel>
  </ScrollView>;
}

function ParentHome({ quests, pendingQuests, familyCode, approveGuild }: { quests: Quest[]; pendingQuests: Quest[]; familyCode?: string; approveGuild: (q?: Quest) => void }) {
  const done = quests.filter(q => q.status === 'rewarded').length;
  const pending = pendingQuests.length || quests.filter(q => q.status === 'pending_approval').length;
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Good afternoon, Maya</Text><Text style={styles.pageLead}>Alex’s quest summary</Text>
    {familyCode && <Panel><Text style={styles.cardTitle}>Family join code</Text><Text style={styles.inviteCode}>{familyCode}</Text><Text style={styles.muted}>Share this code with your child so their Hero account joins your party.</Text></Panel>}
    <View style={styles.metricGrid}><Panel style={styles.metric}><Text style={styles.metricValue}>{done}/{quests.length}</Text><Text style={styles.muted}>Quests today</Text></Panel><Panel style={styles.metric}><Text style={[styles.metricValue, { color: colors.purple }]}>{pending}</Text><Text style={styles.muted}>Needs review</Text></Panel></View>
    {pending > 0 && <Pressable onPress={() => approveGuild()}><LinearGradient colors={[colors.purple, '#9274BD']} style={styles.approvalBanner}><Text style={styles.approvalTitle}>🤝 Guild quest ready</Text><Text style={styles.approvalText}>A Hero submitted a co-op quest.</Text><Text style={styles.approvalAction}>Approve now →</Text></LinearGradient></Pressable>}
    <Panel><View style={styles.sectionHeader}><Text style={styles.cardTitle}>Weekly progress</Text><Pill>ON TRACK</Pill></View><ProgressBar value={19} max={30} /><Text style={styles.encourage}>19 of 30 stars · 63%</Text></Panel>
    <Panel><Text style={styles.cardTitle}>Tonight’s Safe Zone</Text><View style={styles.statRow}><Text style={styles.statEmoji}>🌙</Text><View style={{ flex: 1 }}><Text style={styles.statName}>Night-time reset</Text><Text style={styles.muted}>Closes at 8:30 PM</Text></View><Pill tone="gold">2h 14m</Pill></View></Panel>
  </ScrollView>;
}

function Approvals({ quests, approve }: { quests: Quest[]; approve: (q: Quest) => void }) {
  const pending = quests.filter(q => q.status === 'pending_approval');
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Approval inbox</Text><Text style={styles.pageLead}>Celebrate effort, then award points.</Text>
    {pending.length === 0 ? <Panel style={styles.empty}><Text style={styles.emptyIcon}>✅</Text><Text style={styles.cardTitle}>All caught up!</Text><Text style={styles.muted}>New Guild Quests will appear here.</Text></Panel> : pending.map(q => <Panel key={q.id}><Text style={styles.eyebrowDark}>READY FOR REVIEW</Text><Text style={styles.approvalQuest}>{q.emoji} {q.title}</Text><Text style={styles.muted}>{q.description}</Text><View style={styles.reviewActions}><Pressable style={styles.secondaryButton}><Text style={styles.secondaryText}>Try again</Text></Pressable><Pressable style={styles.primaryButton} onPress={() => approve(q)}><Text style={styles.primaryText}>Approve · +{q.stars} ⭐</Text></Pressable></View></Panel>)}
  </ScrollView>;
}

function BottomNav({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: string[][] }) {
  return <View style={styles.nav}>{items.map(([id, icon, label]) => <Pressable key={id} onPress={() => onChange(id)} style={styles.navItem}><Ionicons name={icon as never} size={23} color={value === id ? colors.green : colors.muted} /><Text style={[styles.navText, value === id && styles.navActive]}>{label}</Text></Pressable>)}</View>;
}

function TimerModal({ quest, onClose, onFinish }: { quest: Quest | null; onClose: () => void; onFinish: () => void }) {
  const [demoSeconds, setDemoSeconds] = useState(5);
  const { width } = useWindowDimensions();
  useMemo(() => { setDemoSeconds(5); }, [quest]);
  if (!quest) return null;
  return <Modal animationType="slide" transparent={false} onRequestClose={onClose}><SafeAreaView style={styles.timerSafe}><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={28} color={colors.navy} /></Pressable><View style={styles.timerBody}><Text style={styles.timerEmoji}>{quest.emoji}</Text><Pill tone="purple">FOCUS QUEST</Pill><Text style={styles.timerTitle}>{quest.title}</Text><View style={[styles.timerRing, { width: Math.min(width - 80, 280), height: Math.min(width - 80, 280) }]}><Text style={styles.timerTime}>{quest.timerMinutes}:00</Text><Text style={styles.muted}>minutes remaining</Text></View><Text style={styles.timerHint}>The server keeps time, even if you leave the app.</Text><Pressable style={styles.primaryButton} onPress={onFinish}><Text style={styles.primaryText}>Demo: finish timer</Text></Pressable></View></SafeAreaView></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, screen: { flex: 1 }, loading: { alignItems: 'center', justifyContent: 'center', gap: 14 }, content: { padding: 18, paddingBottom: 110, gap: 16 },
  roleBar: { paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cream },
  logo: { color: colors.navy, fontSize: 19, fontWeight: '900', letterSpacing: 1 }, switcher: { flexDirection: 'row', backgroundColor: '#EAE5D9', borderRadius: 12, padding: 3 },
  switchButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 }, switchActive: { backgroundColor: colors.white }, switchText: { fontSize: 11, color: colors.muted, fontWeight: '700' }, switchTextActive: { color: colors.navy },
  sharedHeroHeader: { marginHorizontal: 18, marginBottom: 2, borderRadius: 22, padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 13 }, levelShield: { width: 58, height: 66, backgroundColor: colors.green, borderWidth: 3, borderColor: colors.gold, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, levelSmall: { color: colors.white, fontSize: 8, fontWeight: '900' }, levelNumber: { color: colors.white, fontSize: 31, lineHeight: 34, fontWeight: '900' }, heroHeaderCopy: { flexGrow: 1, flexBasis: 150, minWidth: 120 }, heroStats: { flexGrow: 1, flexBasis: 220, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7 }, heroStat: { minWidth: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.13)' }, heroStatIcon: { fontSize: 16 }, heroStatValue: { color: colors.white, fontSize: 15, lineHeight: 17, fontWeight: '900' }, heroStatLabel: { color: '#CBD7EA', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  eyebrow: { color: '#CBD7EA', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, eyebrowDark: { color: colors.purple, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, greeting: { color: colors.white, fontSize: 21, fontWeight: '900' }, heroSub: { color: '#DCE5F2', fontSize: 10, lineHeight: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, inviteCode: { color: colors.green, fontSize: 28, fontWeight: '900', letterSpacing: 4, marginVertical: 8 }, questTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 }, sectionTitle: { fontSize: 21, color: colors.navy, fontWeight: '900' }, pageTitle: { fontSize: 27, color: colors.navy, fontWeight: '900' }, pageLead: { fontSize: 13, color: colors.muted, marginTop: -12 }, tipTitle: { color: '#7A5700', fontWeight: '900', marginBottom: 4 },
  bigStar: { fontSize: 36 }, encourage: { color: colors.green, fontWeight: '700', fontSize: 12, marginTop: 10 }, weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, day: { alignItems: 'center', gap: 7 }, dayLabel: { fontSize: 10, color: colors.muted, fontWeight: '800' }, dayDot: { width: 33, height: 33, borderRadius: 17, borderWidth: 2, borderColor: '#D9D4C8', justifyContent: 'center', alignItems: 'center' }, dayDone: { backgroundColor: colors.green, borderColor: colors.green }, dayToday: { borderColor: colors.gold }, dayValue: { color: colors.white, fontWeight: '900' }, dayStars: { color: '#836000', fontWeight: '800', fontSize: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EFECE5' }, statEmoji: { fontSize: 25 }, statName: { flex: 1, fontWeight: '800', color: colors.ink }, storeHeading: { flex: 1, gap: 3 }, storeLead: { color: colors.muted, fontSize: 13, lineHeight: 19 }, starBalance: { backgroundColor: '#FFF0B7', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 }, starBalanceText: { color: '#755400', fontWeight: '900', fontSize: 17 }, storeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }, storeEmoji: { fontSize: 34 }, starsNeeded: { color: colors.coral, fontSize: 10, fontWeight: '800', marginTop: 4 }, buyButton: { backgroundColor: colors.navy, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 10 }, buyButtonDisabled: { backgroundColor: '#E1DED5' }, buyButtonText: { color: colors.white, fontWeight: '900', fontSize: 12 }, buyButtonTextDisabled: { color: colors.muted }, footnote: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, paddingHorizontal: 20 },
  profile: { alignItems: 'center', borderRadius: 25, padding: 25 }, profileShield: { width: 92, height: 105, backgroundColor: colors.navy, borderRadius: 26, borderWidth: 5, borderColor: colors.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }, profileLevel: { color: colors.white, fontSize: 52, fontWeight: '900' }, profileHeading: { alignItems: 'center', gap: 5 }, profileTitle: { color: colors.navy, fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center' }, profileLead: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' }, qualitiesLabel: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 }, metricGrid: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, alignItems: 'center' }, metricValue: { color: colors.green, fontSize: 27, fontWeight: '900' }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 }, badge: { width: '47%', backgroundColor: colors.cream, borderRadius: 15, padding: 13, alignItems: 'center' }, badgeIcon: { fontSize: 28 }, badgeName: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 5 },
  approvalBanner: { borderRadius: 22, padding: 19 }, approvalTitle: { color: colors.white, fontWeight: '900', fontSize: 17 }, approvalText: { color: '#EFE9F8', marginTop: 5 }, approvalAction: { color: colors.white, fontWeight: '900', marginTop: 14 }, addButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, managerCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }, empty: { alignItems: 'center', paddingVertical: 45 }, emptyIcon: { fontSize: 44, marginBottom: 12 }, approvalQuest: { color: colors.ink, fontSize: 20, fontWeight: '900', marginVertical: 12 }, reviewActions: { flexDirection: 'row', gap: 10, marginTop: 20 }, secondaryButton: { flex: 1, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }, secondaryText: { color: colors.navy, fontWeight: '800' }, primaryButton: { flex: 1, borderRadius: 14, padding: 14, backgroundColor: colors.green, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '900' },
  nav: { position: 'absolute', left: 12, right: 12, bottom: 8, backgroundColor: colors.white, borderRadius: 22, flexDirection: 'row', paddingVertical: 10, borderWidth: 1, borderColor: colors.border }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navText: { color: colors.muted, fontSize: 10, fontWeight: '700' }, navActive: { color: colors.green, fontWeight: '900' },
  timerSafe: { flex: 1, backgroundColor: colors.cream }, close: { alignSelf: 'flex-end', padding: 20 }, timerBody: { flex: 1, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 16 }, timerEmoji: { fontSize: 50 }, timerTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, timerRing: { borderRadius: 999, borderWidth: 15, borderColor: colors.green, borderTopColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginVertical: 12 }, timerTime: { color: colors.navy, fontSize: 45, fontWeight: '900' }, timerHint: { color: colors.muted, textAlign: 'center', maxWidth: 280 },
});
