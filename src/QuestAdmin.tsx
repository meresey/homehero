import { ReactNode, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Panel, Pill } from './components';
import { colors } from './theme';
import { Quest } from './types';
import { EmojiPickerField } from './EmojiPicker';

type Category = 'all' | 'daily' | 'weekly' | 'guild';
type Draft = { title: string; description: string; emoji: string; cadence: Exclude<Category, 'all'>; scheduleLabel: string; stars: string; xp: string; timerMinutes: string };

const emptyDraft: Draft = { title: '', description: '', emoji: '✨', cadence: 'daily', scheduleLabel: 'Every day', stars: '1', xp: '1', timerMinutes: '' };

export function QuestAdmin({ quests, onSave, onRemove }: { quests: Quest[]; onSave: (quest: Quest) => void; onRemove: (id: string) => void }) {
  const [category, setCategory] = useState<Category>('all');
  const [editing, setEditing] = useState<Quest | null | 'new'>(null);
  const filtered = quests.filter(q => category === 'all' || (q.cadence ?? (q.kind === 'guild' ? 'guild' : 'daily')) === category);
  const counts = (key: Category) => key === 'all' ? quests.length : quests.filter(q => (q.cadence ?? (q.kind === 'guild' ? 'guild' : 'daily')) === key).length;

  const remove = (quest: Quest) => Alert.alert('Remove quest?', `“${quest.title}” will stop appearing in future schedules. Existing history will be kept.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => onRemove(quest.id) },
  ]);

  return <>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View><Text style={styles.pageTitle}>Quest admin</Text><Text style={styles.lead}>Create and manage Alex’s adventures</Text></View>
        <Pressable accessibilityLabel="Add quest" style={styles.addButton} onPress={() => setEditing('new')}><Ionicons name="add" size={25} color={colors.white} /></Pressable>
      </View>

      <View style={styles.summaryRow}>
        {(['daily','weekly','guild'] as const).map(key => <Panel key={key} style={styles.summaryCard}><Text style={styles.summaryNumber}>{counts(key)}</Text><Text style={styles.summaryLabel}>{key}</Text></Panel>)}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all','daily','weekly','guild'] as Category[]).map(key => <Pressable key={key} onPress={() => setCategory(key)} style={[styles.filter, category === key && styles.filterActive]}><Text style={[styles.filterText, category === key && styles.filterTextActive]}>{key[0].toUpperCase()+key.slice(1)} · {counts(key)}</Text></Pressable>)}
      </ScrollView>

      {filtered.length === 0 ? <Panel style={styles.empty}><Text style={styles.emptyIcon}>🗺️</Text><Text style={styles.cardTitle}>No {category} quests yet</Text><Pressable onPress={() => setEditing('new')}><Text style={styles.link}>Create the first one</Text></Pressable></Panel> : filtered.map(q => <Panel key={q.id} style={styles.questCard}>
        <View style={styles.emojiBox}><Text style={styles.emoji}>{q.emoji}</Text></View>
        <View style={styles.questCopy}>
          <View style={styles.titleRow}><Text style={styles.questTitle}>{q.title}</Text><Pill tone={q.cadence === 'guild' ? 'purple' : q.cadence === 'weekly' ? 'gold' : 'green'}>{(q.cadence ?? 'daily').toUpperCase()}</Pill></View>
          <Text style={styles.description}>{q.description}</Text>
          <Text style={styles.meta}>{q.scheduleLabel ?? 'Every day'}  ·  ⭐ {q.stars}  ·  ✦ {q.xp} XP{q.timerMinutes ? `  ·  ◷ ${q.timerMinutes} min` : ''}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel={`Edit ${q.title}`} onPress={() => setEditing(q)} style={styles.iconButton}><Ionicons name="create-outline" size={20} color={colors.navy} /></Pressable>
          <Pressable accessibilityLabel={`Remove ${q.title}`} onPress={() => remove(q)} style={styles.iconButton}><Ionicons name="trash-outline" size={19} color={colors.coral} /></Pressable>
        </View>
      </Panel>)}
    </ScrollView>
    <QuestEditor value={editing} onClose={() => setEditing(null)} onSave={quest => { onSave(quest); setEditing(null); }} />
  </>;
}

function QuestEditor({ value, onClose, onSave }: { value: Quest | null | 'new'; onClose: () => void; onSave: (quest: Quest) => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (!value || value === 'new') return setDraft(emptyDraft);
    setDraft({ title: value.title, description: value.description, emoji: value.emoji, cadence: value.cadence ?? 'daily', scheduleLabel: value.scheduleLabel ?? 'Every day', stars: String(value.stars), xp: String(value.xp), timerMinutes: value.timerMinutes ? String(value.timerMinutes) : '' });
  }, [value]);
  if (!value) return null;
  const set = <K extends keyof Draft>(key: K, next: Draft[K]) => setDraft(old => ({ ...old, [key]: next }));
  const submit = () => {
    if (!draft.title.trim()) return Alert.alert('Quest name required', 'Give this quest a short, encouraging name.');
    const stars = Math.max(0, Number.parseInt(draft.stars, 10) || 0); const xp = Math.max(0, Number.parseInt(draft.xp, 10) || 0); const timer = Number.parseInt(draft.timerMinutes, 10) || undefined;
    onSave({ id: value === 'new' ? `quest-${Date.now()}` : value.id, templateId: value === 'new' ? undefined : value.templateId, title: draft.title.trim(), description: draft.description.trim() || 'A new heroic challenge', emoji: draft.emoji.trim() || '✨', cadence: draft.cadence, scheduleLabel: draft.scheduleLabel.trim() || 'Every day', kind: draft.cadence === 'guild' ? 'guild' : timer ? 'timer' : 'daily', status: value === 'new' ? 'available' : value.status, stars, xp, timerMinutes: timer });
  };
  return <Modal animationType="slide" visible onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}><View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{value === 'new' ? 'New quest' : 'Edit quest'}</Text><Pressable onPress={submit}><Text style={styles.save}>Save</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Quest name"><TextInput value={draft.title} onChangeText={text => set('title', text)} placeholder="e.g. Tidy your room" style={styles.input} /></Field>
      <Field label="Description"><TextInput value={draft.description} onChangeText={text => set('description', text)} placeholder="What should the hero do?" multiline style={[styles.input, styles.multiline]} /></Field>
      <Field label="Quest type"><View style={styles.segment}>{(['daily','weekly','guild'] as const).map(key => <Pressable key={key} onPress={() => set('cadence', key)} style={[styles.segmentItem, draft.cadence === key && styles.segmentActive]}><Text style={[styles.segmentText, draft.cadence === key && styles.segmentTextActive]}>{key[0].toUpperCase()+key.slice(1)}</Text></Pressable>)}</View></Field>
      <Field label="Icon"><EmojiPickerField value={draft.emoji} onSelect={emoji => set('emoji', emoji)} /></Field>
      <Field label="Schedule"><TextInput value={draft.scheduleLabel} onChangeText={text => set('scheduleLabel', text)} placeholder="Mon–Fri" style={styles.input} /></Field>
      <View style={styles.twoColumns}><Field label="Stars" style={styles.half}><TextInput value={draft.stars} onChangeText={text => set('stars', text)} keyboardType="number-pad" style={styles.input} /></Field><Field label="XP" style={styles.half}><TextInput value={draft.xp} onChangeText={text => set('xp', text)} keyboardType="number-pad" style={styles.input} /></Field></View>
      <Field label="Timer minutes (optional)"><TextInput value={draft.timerMinutes} onChangeText={text => set('timerMinutes', text)} keyboardType="number-pad" placeholder="20" style={styles.input} /></Field>
      {draft.cadence === 'guild' && <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={22} color={colors.purple} /><Text style={styles.noticeText}>Guild Quests always require Party Leader approval before stars and XP are awarded.</Text></View>}
      <Pressable onPress={submit} style={styles.primary}><Text style={styles.primaryText}>{value === 'new' ? 'Create quest' : 'Save changes'}</Text></Pressable>
    </ScrollView>
  </SafeAreaView></Modal>;
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pageTitle: { fontSize: 27, color: colors.navy, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 13, marginTop: 2 }, addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: 9 }, summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 5 }, summaryNumber: { color: colors.navy, fontSize: 22, fontWeight: '900' }, summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  filters: { gap: 8 }, filter: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, filterActive: { backgroundColor: colors.navy, borderColor: colors.navy }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: colors.white },
  questCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, emojiBox: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 25 }, questCopy: { flex: 1, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, questTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, description: { color: colors.muted, fontSize: 11 }, meta: { color: colors.green, fontSize: 10, fontWeight: '800' }, actions: { gap: 7 }, iconButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 38 }, emptyIcon: { fontSize: 42 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8 }, link: { color: colors.green, fontWeight: '900', marginTop: 10 }, modalSafe: { flex: 1, backgroundColor: colors.cream }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: colors.border }, cancel: { color: colors.muted, fontWeight: '700' }, save: { color: colors.green, fontWeight: '900' }, modalTitle: { color: colors.navy, fontWeight: '900', fontSize: 17 }, form: { padding: 18, gap: 17, paddingBottom: 50 }, field: { gap: 7 }, label: { color: colors.navy, fontWeight: '800', fontSize: 12 }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, multiline: { minHeight: 86, textAlignVertical: 'top' }, segment: { flexDirection: 'row', backgroundColor: '#EAE5D9', padding: 4, borderRadius: 14 }, segmentItem: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 11 }, segmentActive: { backgroundColor: colors.navy }, segmentText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, segmentTextActive: { color: colors.white }, twoColumns: { flexDirection: 'row', gap: 12 }, half: { flex: 1 }, smallField: { width: 82 }, wideField: { flex: 1 }, notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#EFE8FA', alignItems: 'center' }, noticeText: { color: colors.purple, flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' }, primary: { backgroundColor: colors.green, borderRadius: 15, padding: 16, alignItems: 'center', marginTop: 5 }, primaryText: { color: colors.white, fontWeight: '900' },
});
