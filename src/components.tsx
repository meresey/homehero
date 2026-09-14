import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from './theme';
import { Quest } from './types';

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
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

export function QuestCard({ quest, onPress }: { quest: Quest; onPress: () => void }) {
  const complete = quest.status === 'rewarded';
  const pending = quest.status === 'pending_approval';
  return (
    <Pressable onPress={onPress} disabled={complete || pending} style={({ pressed }) => [styles.quest, pressed && styles.pressed, complete && styles.questDone]}>
      <View style={styles.emoji}><Text style={styles.emojiText}>{quest.emoji}</Text></View>
      <View style={styles.questCopy}>
        <View style={styles.row}><Text style={[styles.questTitle, complete && styles.doneText]}>{quest.title}</Text>{quest.kind === 'guild' && <Pill tone="purple">GUILD</Pill>}</View>
        <Text style={styles.questDescription}>{pending ? 'Waiting for Party Leader' : quest.description}</Text>
        <View style={styles.rewardRow}>
          {quest.timerMinutes && <Text style={styles.meta}>◷ {quest.timerMinutes} min</Text>}
          {quest.cutoffLabel && <Text style={[styles.meta, { color: colors.coral }]}>Safe Zone · {quest.cutoffLabel}</Text>}
          <Text style={styles.reward}>⭐ {quest.stars}  ✦ {quest.xp} XP</Text>
        </View>
      </View>
      <View style={[styles.check, complete && styles.checkDone]}>
        <Ionicons name={complete ? 'checkmark' : pending ? 'hourglass-outline' : 'chevron-forward'} size={20} color={complete ? colors.white : colors.navy} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.white, borderRadius: 22, padding: 18, ...shadow },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  track: { height: 11, borderRadius: 99, backgroundColor: '#E8E4DA', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  pressed: { transform: [{ scale: .985 }], opacity: .9 },
  questDone: { backgroundColor: '#F0F6E9', borderColor: '#C9DEB0' },
  emoji: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 25 },
  questCopy: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', gap: 7, alignItems: 'center', flexWrap: 'wrap' },
  questTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  doneText: { color: colors.green },
  questDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  rewardRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  meta: { color: colors.purple, fontSize: 11, fontWeight: '700' },
  reward: { color: '#886100', fontSize: 11, fontWeight: '800', marginLeft: 'auto' },
  check: { width: 31, height: 31, borderRadius: 16, borderWidth: 1.5, borderColor: '#CCD3DE', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.green, borderColor: colors.green },
});
