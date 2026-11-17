import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, shadow } from './theme';
import { Quest } from './types';
import { COIN_ICON } from './economy';

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function AppFrame({ children }: { children: ReactNode }) {
  return <View style={styles.appFrame}>{children}</View>;
}

export function PageHeading({ title, subtitle, eyebrow, action }: { title: string; subtitle?: string; eyebrow?: string; action?: ReactNode }) {
  return <View style={styles.pageHeading}><View style={styles.pageHeadingCopy}>{eyebrow && <Text style={styles.pageEyebrow}>{eyebrow}</Text>}<Text style={styles.pageTitle}>{title}</Text>{subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}</View>{action}</View>;
}

export function EmptyState({ icon, title, description, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; description?: string; action?: ReactNode }) {
  return <Panel style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name={icon} size={25} color={colors.green} /></View><Text style={styles.emptyTitle}>{title}</Text>{description && <Text style={styles.emptyDescription}>{description}</Text>}{action && <View style={styles.emptyAction}>{action}</View>}</Panel>;
}

export function Pill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'gold' | 'purple' | 'navy' }) {
  const bg = { green: colors.greenSoft, gold: '#FFF3C9', purple: '#EFE8FA', navy: '#E6ECF6' }[tone];
  const fg = { green: colors.green, gold: '#8A6300', purple: colors.purple, navy: colors.navy }[tone];
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={[styles.pillText, { color: fg }]}>{children}</Text></View>;
}

export function ProgressBar({ value, max, color = colors.green }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, value / max * 100));
  return <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} /></View>;
}

export function QuestCard({ quest, onPress, actionLabel }: { quest: Quest; onPress: () => void; actionLabel?: string }) {
  const complete = quest.status === 'rewarded';
  const pending = quest.status === 'pending_approval';
  const continuing = quest.status === 'in_progress';
  const actionable = quest.status === 'available' || continuing || (complete && Boolean(actionLabel));
  const timerRemaining = useQuestTimerRemaining(quest);
  const action = actionLabel ?? (continuing ? 'Continue' : quest.kind === 'timer' ? 'Start' : 'Done');
  const status = complete ? 'Completed' : pending ? 'Waiting for approval' : undefined;
  const rewards = [
    quest.stars > 0 ? `${COIN_ICON} ${quest.stars}` : '',
    quest.xp > 0 ? `✦ ${quest.xp} XP` : '',
  ].filter(Boolean).join('  ');
  const timerLabel = timerRemaining === null ? undefined : timerRemaining > 0 ? `${formatTimer(timerRemaining)} left` : 'Timer finished';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[quest.title, status, actionable ? action : undefined, timerLabel].filter(Boolean).join(', ')}
      accessibilityHint={actionable ? quest.description : undefined} accessibilityState={{ disabled: !actionable }} onPress={onPress} disabled={!actionable}
      style={({ pressed }) => [styles.quest, pressed && styles.pressed, complete && styles.questDone, continuing && styles.questRunning]}>
      <View style={styles.emoji}><Text style={styles.emojiText}>{quest.emoji}</Text></View>
      <View style={styles.questCopy}>
        <Text style={styles.questTitle}>{quest.title}</Text>
        {actionable && Boolean(quest.description) && <Text style={styles.questDescription}>{quest.description}</Text>}
        <View style={styles.rewardRow}>
          {(timerLabel || quest.timerMinutes) && <Text style={[styles.meta, continuing && styles.timerActive]}>{timerLabel ?? `${quest.timerMinutes} min`}</Text>}
          {quest.cutoffLabel && actionable && <Text style={[styles.meta, { color: colors.coral }]}>Due {quest.cutoffLabel}</Text>}
          {rewards ? <Text style={styles.reward}>{rewards}</Text> : null}
        </View>
      </View>
      {actionable
        ? <Text style={styles.questAction}>{action}</Text>
        : <View style={[styles.check, complete && styles.checkDone]}>
          <Ionicons name={complete ? 'checkmark' : 'hourglass-outline'} size={20} color={complete ? colors.white : colors.navy} />
        </View>}
    </Pressable>
  );
}

function useQuestTimerRemaining(quest: Quest) {
  const active = quest.kind === 'timer' && quest.status === 'in_progress' && Boolean(quest.timerEndsAt);
  const calculate = () => active ? Math.max(0, Math.ceil((new Date(quest.timerEndsAt as string).getTime() - Date.now()) / 1000)) : null;
  const [remaining, setRemaining] = useState<number | null>(calculate);

  useEffect(() => {
    setRemaining(calculate());
    if (!active) return;
    const interval = setInterval(() => setRemaining(calculate()), 1000);
    return () => clearInterval(interval);
  }, [active, quest.timerEndsAt]);

  return remaining;
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  appFrame: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  panel: { backgroundColor: colors.white, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(17,36,73,.055)', ...shadow },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 4 },
  pageHeadingCopy: { flex: 1, gap: 4 },
  pageEyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  pageTitle: { color: colors.navy, fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -.6 },
  pageSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  emptyState: { alignItems: 'center', paddingHorizontal: 25, paddingVertical: 38 },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: colors.navy, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 340 },
  emptyAction: { marginTop: 16 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  track: { height: 11, borderRadius: 99, backgroundColor: '#E8E4DA', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  questRunning: { borderColor: colors.purple, backgroundColor: '#FAF7FF' },
  pressed: { transform: [{ scale: .985 }], opacity: .9 },
  questDone: { backgroundColor: '#F0F6E9', borderColor: '#C9DEB0' },
  emoji: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 25 },
  questCopy: { flex: 1, minWidth: 0, gap: 4 },
  questAction: { minWidth: 48, textAlign: 'center', paddingHorizontal: 8, paddingVertical: 7, backgroundColor: colors.greenSoft, color: colors.green, borderRadius: 9, fontSize: 12, fontWeight: '800' },
  questTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  questDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  rewardRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  meta: { color: colors.purple, fontSize: 11, fontWeight: '700' },
  timerActive: { color: colors.purple, fontSize: 13, fontWeight: '900' },
  reward: { color: '#886100', fontSize: 11, fontWeight: '800' },
  check: { width: 31, height: 31, borderRadius: 16, borderWidth: 1.5, borderColor: '#CCD3DE', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.green, borderColor: colors.green },
});
