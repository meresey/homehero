import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Panel, Pill, ProgressBar } from './components';
import { getHeroLevelProgress, HeroLevel } from './levels';
import { GuildApproval, HeroSummary, Household, RewardRequest } from './types';
import { colors } from './theme';

type AttentionType = 'guild' | 'reward';

export function HouseholdDashboard({ household, heroes, levels, guildApprovals, rewardRequests, onViewHero, onOpenAttention }: { household: Household; heroes: HeroSummary[]; levels: HeroLevel[]; guildApprovals: GuildApproval[]; rewardRequests: RewardRequest[]; onViewHero: (heroId: string) => void; onOpenAttention: (heroId: string, type: AttentionType) => void }) {
  const completed = heroes.reduce((sum, hero) => sum + hero.completedToday, 0);
  const total = heroes.reduce((sum, hero) => sum + hero.totalToday, 0);
  const pendingApprovals = guildApprovals.filter(item => item.status === 'pending').length + rewardRequests.filter(item => item.status === 'pending').length;
  const weeklyStars = heroes.reduce((sum, hero) => sum + hero.stars, 0);
  const attention = [
    ...guildApprovals.filter(item => item.status === 'pending').map(item => ({ id: item.id, heroId: item.heroId, type: 'guild' as const, icon: '🤝', text: 'submitted a Guild Quest' })),
    ...rewardRequests.filter(item => item.status === 'pending').map(item => ({ id: item.id, heroId: item.heroId, type: 'reward' as const, icon: '🎁', text: 'requested a Star Store reward' })),
  ];
  const heroName = (id: string) => heroes.find(hero => hero.heroId === id)?.displayName ?? 'A Hero';

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <LinearGradient colors={[colors.navy, '#284A7D']} style={styles.householdHero}><View><Text style={styles.eyebrow}>PARTY LEADER DASHBOARD</Text><Text style={styles.heading}>{household.name}</Text><Text style={styles.heroLead}>{heroes.length} active Heroes · Household overview</Text></View><Text style={styles.houseEmoji}>🏠</Text></LinearGradient>
    <View style={styles.metrics}>
      <Metric value={`${completed}/${total}`} label="Quests today" />
      <Metric value={String(pendingApprovals)} label="Needs review" tone="purple" />
      <Metric value={String(heroes.length)} label="Active Heroes" />
      <Metric value={String(weeklyStars)} label="Total stars" tone="gold" />
    </View>

    {attention.length > 0 && <Panel><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Needs your attention</Text><Pill tone="purple">{attention.length}</Pill></View><View style={styles.attentionList}>{attention.map(item => <Pressable key={item.id} onPress={() => onOpenAttention(item.heroId, item.type)} style={styles.attentionItem}><Text style={styles.attentionIcon}>{item.icon}</Text><Text style={styles.attentionText}><Text style={styles.attentionName}>{heroName(item.heroId)}</Text> {item.text}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View></Panel>}

    <View style={styles.sectionHeader}><View><Text style={styles.pageTitle}>Your Heroes</Text><Text style={styles.pageLead}>Choose a Hero to see their dashboard.</Text></View></View>
    <View style={styles.heroGrid}>{heroes.map(hero => <HeroCard key={hero.heroId} hero={hero} levels={levels} onView={() => onViewHero(hero.heroId)} />)}</View>
  </ScrollView>;
}

function Metric({ value, label, tone = 'green' }: { value: string; label: string; tone?: 'green' | 'purple' | 'gold' }) {
  const color = tone === 'purple' ? colors.purple : tone === 'gold' ? '#987000' : colors.green;
  return <Panel style={styles.metric}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Panel>;
}

function HeroCard({ hero, levels, onView }: { hero: HeroSummary; levels: HeroLevel[]; onView: () => void }) {
  const level = getHeroLevelProgress(hero.lifetimeXp, levels);
  const completion = hero.totalToday ? hero.completedToday / hero.totalToday : 0;
  const needsAttention = hero.pendingApprovals + hero.pendingRewardRequests;
  return <Panel style={styles.heroCard}>
    <View style={styles.heroCardHeader}><View style={styles.avatar}><Text style={styles.avatarEmoji}>{hero.avatarEmoji}</Text></View><View style={styles.heroIdentity}><Text style={styles.heroName}>{hero.displayName}</Text><Text style={styles.levelTitle}>Level {level.current.level} · {level.current.title}</Text></View>{needsAttention > 0 && <View style={styles.alertBadge}><Text style={styles.alertText}>{needsAttention}</Text></View>}</View>
    <View style={styles.progressCopy}><Text style={styles.progressLabel}>Today’s quests</Text><Text style={styles.progressValue}>{hero.completedToday} of {hero.totalToday}</Text></View><ProgressBar value={completion} max={1} />
    <View style={styles.heroStats}><Text style={styles.heroStat}>⭐ {hero.stars}</Text><Text style={styles.heroStat}>✦ {hero.lifetimeXp} XP</Text><Text style={styles.heroStat}>🏅 {hero.earnedBadgeCount}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${hero.displayName}'s dashboard`} onPress={onView} style={styles.viewButton}><Text style={styles.viewText}>View Hero</Text><Ionicons name="arrow-forward" size={17} color={colors.white} /></Pressable>
  </Panel>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 16 }, householdHero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: '#CBD7EA', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, heading: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 3 }, heroLead: { color: '#DCE5F2', fontSize: 12, marginTop: 4 }, houseEmoji: { fontSize: 39 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { flexGrow: 1, flexBasis: 130, alignItems: 'center', paddingVertical: 13 }, metricValue: { fontSize: 24, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 2 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, attentionList: { marginTop: 10 }, attentionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }, attentionIcon: { fontSize: 22 }, attentionText: { flex: 1, color: colors.muted, fontSize: 12 }, attentionName: { color: colors.ink, fontWeight: '900' }, pageTitle: { color: colors.navy, fontSize: 23, fontWeight: '900' }, pageLead: { color: colors.muted, fontSize: 12, marginTop: 2 }, heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, heroCard: { flexGrow: 1, flexBasis: 260, gap: 13 }, heroCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, avatarEmoji: { fontSize: 27 }, heroIdentity: { flex: 1 }, heroName: { color: colors.ink, fontSize: 18, fontWeight: '900' }, levelTitle: { color: colors.muted, fontSize: 10, marginTop: 2 }, alertBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, alertText: { color: colors.white, fontSize: 11, fontWeight: '900' }, progressCopy: { flexDirection: 'row', justifyContent: 'space-between' }, progressLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' }, progressValue: { color: colors.green, fontSize: 11, fontWeight: '900' }, heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, heroStat: { color: colors.navy, fontSize: 11, fontWeight: '900', backgroundColor: colors.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 }, viewButton: { backgroundColor: colors.green, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, viewText: { color: colors.white, fontWeight: '900', fontSize: 12 },
});
