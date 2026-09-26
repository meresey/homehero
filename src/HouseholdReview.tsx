import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, PageHeading, Panel, Pill } from './components';
import { GuildApproval, HeroSummary, Quest, Reward, RewardRequest } from './types';
import { colors } from './theme';

export function HouseholdReview({ heroes, heroQuests, rewards, guildApprovals, rewardRequests, onReviewGuild, onReviewReward }: { heroes: HeroSummary[]; heroQuests: Record<string, Quest[]>; rewards: Reward[]; guildApprovals: GuildApproval[]; rewardRequests: RewardRequest[]; onReviewGuild: (id: string, approve: boolean) => void; onReviewReward: (id: string, approve: boolean) => 'approved' | 'declined' | 'insufficient' | 'missing' }) {
  const [now, setNow] = useState(Date.now());
  const pendingGuild = guildApprovals.filter(item => item.status === 'pending');
  const pendingRewards = rewardRequests.filter(item => item.status === 'pending');
  const total = pendingGuild.length + pendingRewards.length;
  const hero = (id: string) => heroes.find(item => item.heroId === id);
  const quest = (item: GuildApproval) => (heroQuests[item.heroId] ?? []).find(candidate => (candidate.templateId ?? candidate.id) === item.questId);
  const reward = (item: RewardRequest) => rewards.find(candidate => candidate.id === item.rewardId);
  const runningTimerEnd = pendingGuild
    .map(item => quest(item))
    .find(item => item?.kind === 'timer' && item.timerEndsAt && new Date(item.timerEndsAt).getTime() > now)?.timerEndsAt;
  const reviewReward = (id: string, approve: boolean) => {
    const result = onReviewReward(id, approve);
    if (result === 'insufficient') Alert.alert('Not enough stars', 'This Hero no longer has enough stars. Decline the request or let them earn more stars first.');
    else if (result === 'approved') Alert.alert('Reward approved', 'The stars have now been deducted from the Hero’s balance.');
  };
  useEffect(() => {
    if (!runningTimerEnd) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningTimerEnd]);

  return <ScrollView contentContainerStyle={styles.content}>
    <PageHeading eyebrow="PARTY LEADER" title="Review inbox" subtitle="Approve effort and reward requests across your household." action={<Pill tone="purple">{total}</Pill>} />
    {total === 0 && <EmptyState icon="checkmark-circle-outline" title="All caught up!" description="Quest completions and reward requests will appear here." />}
    {pendingRewards.length > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Reward requests</Text>{pendingRewards.map(item => {
      const owner = hero(item.heroId); const requested = reward(item);
      const availableStars = owner?.stars ?? 0;
      const canApprove = availableStars >= item.starCost;
      return <Panel key={item.id}><Text style={styles.typeLabel}>🎁 STAR STORE REQUEST</Text><Text style={styles.itemTitle}>{owner?.avatarEmoji} {owner?.displayName ?? 'Hero'} wants {requested?.title ?? 'a reward'}</Text><Text style={styles.lead}>{requested?.subtitle ?? 'Parent-approved reward'} · Costs {item.starCost} stars · Balance {availableStars} stars</Text>{!canApprove && <View style={styles.balanceError}><Text style={styles.balanceErrorTitle}>⚠️ Insufficient stars</Text><Text style={styles.balanceErrorText}>{owner?.displayName ?? 'This Hero'} needs {item.starCost - availableStars} more stars before this reward can be approved.</Text></View>}<View style={styles.actions}><Pressable style={styles.secondary} onPress={() => reviewReward(item.id, false)}><Text style={styles.secondaryText}>Decline</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canApprove }} disabled={!canApprove} style={[styles.primary, !canApprove && styles.primaryDisabled]} onPress={() => reviewReward(item.id, true)}><Text style={[styles.primaryText, !canApprove && styles.primaryTextDisabled]}>{canApprove ? `Approve · −${item.starCost} ⭐` : 'Cannot approve'}</Text></Pressable></View></Panel>;
    })}</View>}
    {pendingGuild.length > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Quest completions</Text>{pendingGuild.map(item => {
      const owner = hero(item.heroId); const submitted = quest(item);
      const timed = item.kind === 'timer' || submitted?.kind === 'timer';
      const remainingSeconds = timed && submitted?.timerEndsAt ? Math.max(0, Math.ceil((new Date(submitted.timerEndsAt).getTime() - now) / 1000)) : 0;
      const timerVerified = Boolean(submitted?.timerCompletedAt && submitted?.timerEndsAt && new Date(submitted.timerEndsAt).getTime() <= now);
      const canApprove = !timed || timerVerified;
      const typeLabel = timed ? '⏱️ TIMED QUEST' : submitted?.kind === 'guild' ? '🤝 GUILD QUEST' : submitted?.kind === 'bedtime' ? '🌙 BEDTIME QUEST' : '⭐ DAILY QUEST';
      return <Panel key={item.id}><Text style={styles.typeLabel}>{typeLabel}</Text><Text style={styles.itemTitle}>{owner?.avatarEmoji} {owner?.displayName ?? 'Hero'} {timed ? 'finished' : 'submitted'} {submitted?.title ?? 'a quest'}</Text><Text style={styles.lead}>{submitted?.description ?? 'Ready for Party Leader review'}</Text>{!canApprove && <View style={styles.timerNotice}><Text style={styles.timerNoticeTitle}>⏱️ {remainingSeconds > 0 ? `Timer still running · ${formatRemaining(remainingSeconds)}` : 'Timer completion not verified'}</Text><Text style={styles.timerNoticeText}>{remainingSeconds > 0 ? 'Approval unlocks automatically when the countdown reaches zero.' : 'Ask the Hero to restart and complete the timer before approving this quest.'}</Text></View>}<View style={styles.actions}><Pressable style={styles.secondary} onPress={() => onReviewGuild(item.id, false)}><Text style={styles.secondaryText}>Try again</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canApprove }} disabled={!canApprove} style={[styles.primary, !canApprove && styles.primaryDisabled]} onPress={() => onReviewGuild(item.id, true)}><Text style={[styles.primaryText, !canApprove && styles.primaryTextDisabled]}>{canApprove ? `Approve · +${submitted?.stars ?? 0} ⭐ · +${submitted?.xp ?? 0} XP` : remainingSeconds > 0 ? `Wait · ${formatRemaining(remainingSeconds)}` : 'Cannot approve'}</Text></Pressable></View></Panel>;
    })}</View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 18 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, pageTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 12, lineHeight: 18 }, section: { gap: 12 }, sectionTitle: { color: colors.navy, fontSize: 18, fontWeight: '900' }, typeLabel: { color: colors.purple, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, itemTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '900', marginTop: 8 }, balanceError: { backgroundColor: '#FFF0ED', borderColor: colors.coral, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 12 }, balanceErrorTitle: { color: colors.coral, fontSize: 12, fontWeight: '900' }, balanceErrorText: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 3 }, timerNotice: { backgroundColor: '#F4EEFC', borderColor: colors.purple, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 12 }, timerNoticeTitle: { color: colors.purple, fontSize: 12, fontWeight: '900' }, timerNoticeText: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 3 }, actions: { flexDirection: 'row', gap: 10, marginTop: 18 }, secondary: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: colors.border, padding: 13, alignItems: 'center' }, secondaryText: { color: colors.navy, fontWeight: '800' }, primary: { flex: 1, borderRadius: 13, backgroundColor: colors.green, padding: 13, alignItems: 'center' }, primaryDisabled: { backgroundColor: '#E1DED5' }, primaryText: { color: colors.white, fontWeight: '900', textAlign: 'center' }, primaryTextDisabled: { color: colors.muted }, empty: { alignItems: 'center', paddingVertical: 42 }, emptyIcon: { fontSize: 42, marginBottom: 10 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 3 },
});

function formatRemaining(totalSeconds: number) { return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`; }
