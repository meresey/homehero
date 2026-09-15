import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Panel, Pill } from './components';
import { HeroLevel } from './levels';
import { colors } from './theme';

type Draft = { title: string; minimumXp: string; characteristics: string };

export function LevelAdmin({ levels, onSave }: { levels: HeroLevel[]; onSave: (level: HeroLevel) => void }) {
  const [editing, setEditing] = useState<HeroLevel | null>(null);
  return <>
    <ScrollView contentContainerStyle={styles.content}>
      <View><Text style={styles.pageTitle}>Level configuration</Text><Text style={styles.lead}>Set XP milestones, titles, and qualities Heroes build.</Text></View>
      <Panel style={styles.notice}><Ionicons name="information-circle-outline" size={23} color={colors.green} /><Text style={styles.noticeText}>Level 1 always starts at 0 XP. Every later milestone must remain higher than the previous one.</Text></Panel>
      {levels.map((level, index) => {
        const next = levels[index + 1];
        return <Panel key={level.level} style={styles.levelCard}>
          <View style={styles.shield}><Text style={styles.shieldSmall}>LEVEL</Text><Text style={styles.shieldNumber}>{level.level}</Text></View>
          <View style={styles.copy}><View style={styles.titleRow}><Text style={styles.levelTitle}>{level.title}</Text><Pill tone="gold">{level.minimumXp} XP</Pill></View><Text style={styles.traits}>{level.characteristics.join(' · ')}</Text><Text style={styles.range}>{next ? `${level.minimumXp}–${next.minimumXp - 1} lifetime XP` : `${level.minimumXp}+ lifetime XP`}</Text></View>
          <Pressable accessibilityLabel={`Edit level ${level.level}`} style={styles.editButton} onPress={() => setEditing(level)}><Ionicons name="create-outline" size={20} color={colors.navy} /></Pressable>
        </Panel>;
      })}
    </ScrollView>
    <LevelEditor value={editing} levels={levels} onClose={() => setEditing(null)} onSave={level => { onSave(level); setEditing(null); }} />
  </>;
}

function LevelEditor({ value, levels, onClose, onSave }: { value: HeroLevel | null; levels: HeroLevel[]; onClose: () => void; onSave: (level: HeroLevel) => void }) {
  const [draft, setDraft] = useState<Draft>({ title: '', minimumXp: '', characteristics: '' });
  useEffect(() => { if (value) setDraft({ title: value.title, minimumXp: String(value.minimumXp), characteristics: value.characteristics.join(', ') }); }, [value]);
  if (!value) return null;
  const update = (key: keyof Draft, text: string) => setDraft(current => ({ ...current, [key]: text }));
  const submit = () => {
    const minimumXp = value.level === 1 ? 0 : Number.parseInt(draft.minimumXp, 10);
    const characteristics = draft.characteristics.split(',').map(item => item.trim()).filter(Boolean);
    const index = levels.findIndex(level => level.level === value.level);
    const previous = levels[index - 1]; const next = levels[index + 1];
    if (!draft.title.trim()) return Alert.alert('Title required', 'Enter an encouraging title for this level.');
    if (!Number.isInteger(minimumXp) || minimumXp < 0) return Alert.alert('Invalid XP milestone', 'Enter a positive whole number.');
    if (previous && minimumXp <= previous.minimumXp) return Alert.alert('Milestone too low', `Level ${value.level} must start above ${previous.minimumXp} XP.`);
    if (next && minimumXp >= next.minimumXp) return Alert.alert('Milestone too high', `Level ${value.level} must start below ${next.minimumXp} XP.`);
    if (characteristics.length !== 3) return Alert.alert('Three qualities required', 'Enter exactly three comma-separated qualities.');
    onSave({ ...value, title: draft.title.trim(), minimumXp, characteristics });
  };
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}>
    <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>Edit Level {value.level}</Text><Pressable onPress={submit}><Text style={styles.save}>Save</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Level title"><TextInput value={draft.title} onChangeText={text => update('title', text)} placeholder="e.g. Home Hero" style={styles.input} /></Field>
      <Field label="Minimum lifetime XP"><TextInput value={draft.minimumXp} onChangeText={text => update('minimumXp', text)} editable={value.level !== 1} keyboardType="number-pad" style={[styles.input, value.level === 1 && styles.disabled]} /></Field>
      <Field label="Qualities (exactly three)"><TextInput value={draft.characteristics} onChangeText={text => update('characteristics', text)} placeholder="Dependable, Curious, Kind" style={styles.input} /><Text style={styles.hint}>Separate each quality with a comma.</Text></Field>
      <View style={styles.preview}><Text style={styles.previewLabel}>HERO PREVIEW</Text><Text style={styles.previewTitle}>Alex the {draft.title || 'Hero'}</Text><Text style={styles.previewTraits}>{draft.characteristics.split(',').map(item => item.trim()).filter(Boolean).join(' · ')}</Text></View>
      <Pressable style={styles.primary} onPress={submit}><Text style={styles.primaryText}>Save level</Text></Pressable>
    </ScrollView>
  </SafeAreaView></Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 14 }, pageTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 }, notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EAF3DD' }, noticeText: { flex: 1, color: colors.green, fontSize: 12, lineHeight: 17, fontWeight: '700' }, levelCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, shield: { width: 51, height: 58, backgroundColor: colors.navy, borderWidth: 3, borderColor: colors.gold, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, shieldSmall: { color: colors.white, fontSize: 7, fontWeight: '900' }, shieldNumber: { color: colors.white, fontSize: 25, lineHeight: 28, fontWeight: '900' }, copy: { flex: 1, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, levelTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, traits: { color: colors.purple, fontSize: 11, fontWeight: '800' }, range: { color: colors.muted, fontSize: 10 }, editButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  modalSafe: { flex: 1, backgroundColor: colors.cream }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderColor: colors.border }, modalTitle: { color: colors.navy, fontSize: 17, fontWeight: '900' }, cancel: { color: colors.muted, fontWeight: '700' }, save: { color: colors.green, fontWeight: '900' }, form: { padding: 18, gap: 18 }, field: { gap: 7 }, label: { color: colors.navy, fontSize: 12, fontWeight: '800' }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, disabled: { backgroundColor: '#E9E5DC', color: colors.muted }, hint: { color: colors.muted, fontSize: 11 }, preview: { alignItems: 'center', padding: 22, borderRadius: 18, backgroundColor: '#EAF3DD', gap: 5 }, previewLabel: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, previewTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', textAlign: 'center' }, previewTraits: { color: colors.muted, fontSize: 12, textAlign: 'center' }, primary: { backgroundColor: colors.green, borderRadius: 15, padding: 16, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '900' },
});
