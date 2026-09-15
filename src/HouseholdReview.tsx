import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Panel, Pill } from './components';
import { GuildApproval, HeroSummary, Quest, Reward, RewardRequest } from './types';
import { colors } from './theme';

export function HouseholdReview({ heroes, heroQuests, rewards, guildApprovals, rewardRequests, onReviewGuild, onReviewReward }: { heroes: HeroSummary[]; heroQuests: Record<string, Quest[]>; rewards: Reward[]; guildApprovals: GuildApproval[]; rewardRequests: RewardRequest[]; onReviewGuild: (id: string, approve: boolean) => void; onReviewReward: (id: string, approve: boolean) => 'approved' | 'declined' | 'insufficient' | 'missing' }) {
  const pendingGuild = guildApprovals.filter(item => item.status === 'pending');
  const pendingRewards = rewardRequests.filter(item => item.status === 'pending');
  const total = pendingGuild.length + pendingRewards.length;
  const hero = (id: string) => heroes.find(item => item.heroId === id);
  const quest = (item: GuildApproval) => (heroQuests[item.heroId] ?? []).find(candidate => (candidate.templateId ?? candidate.id) === item.questId);
  const reward = (item: RewardRequest) => rewards.find(candidate => candidate.id === item.rewardId);
  const reviewReward = (id: string, approve: boolean) => {
    const result = onReviewReward(id, approve);
    if (result === 'insufficient') Alert.alert('Not enough stars', 'This Hero no longer has enough stars. Decline the request or let them earn more stars first.');
    else if (result === 'approved') Alert.alert('Reward approved', 'The stars have now been deducted from the Hero’s balance.');
  };

  return <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.heading}><View><Text style={styles.pageTitle}>Review inbox</Text><Text style={styles.lead}>Approve effort and reward requests across your household.</Text></View><Pill tone="purple">{total}</Pill></View>
    {total === 0 && <Panel style={styles.empty}><Text style={styles.emptyIcon}>✅</Text><Text style={styles.cardTitle}>All caught up!</Text><Text style={styles.lead}>New Guild Quests and reward requests will appear here.</Text></Panel>}
    {pendingRewards.length > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Reward requests</Text>{pendingRewards.map(item => {
      const owner = hero(item.heroId); const requested = reward(item);
      const availableStars = owner?.stars ?? 0;
      const canApprove = availableStars >= item.starCost;
      return <Panel key={item.id}><Text style={styles.typeLabel}>🎁 STAR STORE REQUEST</Text><Text style={styles.itemTitle}>{owner?.avatarEmoji} {owner?.displayName ?? 'Hero'} wants {requested?.title ?? 'a reward'}</Text><Text style={styles.lead}>{requested?.subtitle ?? 'Parent-approved reward'} · Costs {item.starCost} stars · Balance {availableStars} stars</Text>{!canApprove && <View style={styles.balanceError}><Text style={styles.balanceErrorTitle}>⚠️ Insufficient stars</Text><Text style={styles.balanceErrorText}>{owner?.displayName ?? 'This Hero'} needs {item.starCost - availableStars} more stars before this reward can be approved.</Text></View>}<View style={styles.actions}><Pressable style={styles.secondary} onPress={() => reviewReward(item.id, false)}><Text style={styles.secondaryText}>Decline</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canApprove }} disabled={!canApprove} style={[styles.primary, !canApprove && styles.primaryDisabled]} onPress={() => reviewReward(item.id, true)}><Text style={[styles.primaryText, !canApprove && styles.primaryTextDisabled]}>{canApprove ? `Approve · −${item.starCost} ⭐` : 'Cannot approve'}</Text></Pressable></View></Panel>;
    })}</View>}
    {pendingGuild.length > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Guild Quests</Text>{pendingGuild.map(item => {
      const owner = hero(item.heroId); const submitted = quest(item);
      return <Panel key={item.id}><Text style={styles.typeLabel}>🤝 GUILD QUEST</Text><Text style={styles.itemTitle}>{owner?.avatarEmoji} {owner?.displayName ?? 'Hero'} submitted {submitted?.title ?? 'a quest'}</Text><Text style={styles.lead}>{submitted?.description ?? 'Ready for Party Leader review'}</Text><View style={styles.actions}><Pressable style={styles.secondary} onPress={() => onReviewGuild(item.id, false)}><Text style={styles.secondaryText}>Try again</Text></Pressable><Pressable style={styles.primary} onPress={() => onReviewGuild(item.id, true)}><Text style={styles.primaryText}>Approve · +{submitted?.stars ?? 0} ⭐</Text></Pressable></View></Panel>;
    })}</View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 18 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, pageTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 12, lineHeight: 18 }, section: { gap: 12 }, sectionTitle: { color: colors.navy, fontSize: 18, fontWeight: '900' }, typeLabel: { color: colors.purple, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, itemTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '900', marginTop: 8 }, balanceError: { backgroundColor: '#FFF0ED', borderColor: colors.coral, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 12 }, balanceErrorTitle: { color: colors.coral, fontSize: 12, fontWeight: '900' }, balanceErrorText: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 3 }, actions: { flexDirection: 'row', gap: 10, marginTop: 18 }, secondary: { flex: 1, borderRadius: 13, borderWidth: 1, borderColor: colors.border, padding: 13, alignItems: 'center' }, secondaryText: { color: colors.navy, fontWeight: '800' }, primary: { flex: 1, borderRadius: 13, backgroundColor: colors.green, padding: 13, alignItems: 'center' }, primaryDisabled: { backgroundColor: '#E1DED5' }, primaryText: { color: colors.white, fontWeight: '900', textAlign: 'center' }, primaryTextDisabled: { color: colors.muted }, empty: { alignItems: 'center', paddingVertical: 42 }, emptyIcon: { fontSize: 42, marginBottom: 10 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 3 },
});
