import { ReactNode, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Panel, Pill } from './components';
import { colors } from './theme';
import { HeroProfile, Quest, QuestAssignment } from './types';
import { EmojiPickerField } from './EmojiPicker';
import { calculateAge, formatQuestAgeRange } from './ageEligibility';

type Category = 'all' | 'daily' | 'weekly' | 'guild';
type Draft = { title: string; description: string; emoji: string; cadence: Exclude<Category, 'all'>; scheduleLabel: string; stars: string; xp: string; timerMinutes: string; minimumAge: string; maximumAge: string };

const emptyDraft: Draft = { title: '', description: '', emoji: '✨', cadence: 'daily', scheduleLabel: 'Every day', stars: '1', xp: '1', timerMinutes: '', minimumAge: '', maximumAge: '' };

type QuestAdminProps = { quests: Quest[]; heroes?: HeroProfile[]; assignments?: QuestAssignment[]; catalog?: Quest[]; householdName?: string; onSave: (quest: Quest, heroIds: string[]) => boolean | Promise<boolean>; onRemove: (id: string) => void };

export function QuestAdmin({ quests, heroes = [], assignments = [], catalog = [], householdName, onSave, onRemove }: QuestAdminProps) {
  const [category, setCategory] = useState<Category>('all');
  const [editing, setEditing] = useState<Quest | null | 'new'>(null);
  const [view, setView] = useState<'household' | 'library'>('household');
  const [editingHeroIds, setEditingHeroIds] = useState<string[]>([]);
  const source = view === 'household' ? quests : catalog.filter(item => !quests.some(quest => quest.catalogQuestId === item.catalogQuestId));
  const filtered = source.filter(q => category === 'all' || (q.cadence ?? (q.kind === 'guild' ? 'guild' : 'daily')) === category);
  const counts = (key: Category) => key === 'all' ? source.length : source.filter(q => (q.cadence ?? (q.kind === 'guild' ? 'guild' : 'daily')) === key).length;
  const assignmentIds = (questId: string) => assignments.filter(item => item.questId === questId && item.active).map(item => item.heroId);
  const edit = (quest: Quest) => { setEditingHeroIds(assignmentIds(quest.id)); setEditing(quest); };
  const create = () => { setEditingHeroIds(heroes.map(hero => hero.id)); setEditing('new'); };
  const addFromLibrary = (quest: Quest) => {
    const id = `quest-${Date.now()}`;
    setEditingHeroIds(heroes.filter(hero => isAgeEligible(quest, hero)).map(hero => hero.id));
    setEditing({ ...quest, id, templateId: undefined, catalogQuestId: quest.catalogQuestId ?? quest.id, householdId: undefined, visibility: 'household' });
  };

  const remove = (quest: Quest) => Alert.alert('Remove quest?', `“${quest.title}” will stop appearing in future schedules. Existing history will be kept.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => onRemove(quest.id) },
  ]);

  return <>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View><Text style={styles.pageTitle}>Household quests</Text><Text style={styles.lead}>Choose adventures and assign them to one or more Heroes</Text></View>
        <Pressable accessibilityLabel="Add custom quest" style={styles.addButton} onPress={create}><Ionicons name="add" size={25} color={colors.white} /></Pressable>
      </View>

      <View style={styles.viewTabs}>
        <Pressable onPress={() => setView('household')} style={[styles.viewTab, view === 'household' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'household' && styles.viewTabTextActive]}>My quests</Text></Pressable>
        <Pressable onPress={() => setView('library')} style={[styles.viewTab, view === 'library' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'library' && styles.viewTabTextActive]}>Quest library</Text></Pressable>
      </View>
      <Text style={styles.privacy}>{view === 'household' ? `🔒 Private to ${householdName ?? 'your household'}` : '✨ Ready-made quests you can customise before adding'}</Text>

      <View style={styles.summaryRow}>
        {(['daily','weekly','guild'] as const).map(key => <Panel key={key} style={styles.summaryCard}><Text style={styles.summaryNumber}>{counts(key)}</Text><Text style={styles.summaryLabel}>{key}</Text></Panel>)}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all','daily','weekly','guild'] as Category[]).map(key => <Pressable key={key} onPress={() => setCategory(key)} style={[styles.filter, category === key && styles.filterActive]}><Text style={[styles.filterText, category === key && styles.filterTextActive]}>{key[0].toUpperCase()+key.slice(1)} · {counts(key)}</Text></Pressable>)}
      </ScrollView>

      {filtered.length === 0 ? <Panel style={styles.empty}><Text style={styles.emptyIcon}>🗺️</Text><Text style={styles.cardTitle}>{view === 'library' ? 'Every library quest is already added' : `No ${category} quests yet`}</Text>{view === 'household' && <Pressable onPress={create}><Text style={styles.link}>Create the first one</Text></Pressable>}</Panel> : filtered.map(q => <Panel key={q.id} style={styles.questCard}>
        <View style={styles.emojiBox}><Text style={styles.emoji}>{q.emoji}</Text></View>
        <View style={styles.questCopy}>
          <View style={styles.titleRow}><Text style={styles.questTitle}>{q.title}</Text><Pill tone={q.cadence === 'guild' ? 'purple' : q.cadence === 'weekly' ? 'gold' : 'green'}>{(q.cadence ?? 'daily').toUpperCase()}</Pill></View>
          <Text style={styles.description}>{q.description}</Text>
          <Text style={styles.meta}>{q.scheduleLabel ?? 'Every day'}  ·  {formatQuestAgeRange(q)}  ·  ⭐ {q.stars}  ·  ✦ {q.xp} XP{q.timerMinutes ? `  ·  ◷ ${q.timerMinutes} min` : ''}</Text>
          {view === 'household' && <Text style={styles.assigned}>{assignmentIds(q.id).length ? `Assigned to ${heroes.filter(hero => assignmentIds(q.id).includes(hero.id)).map(hero => `${hero.avatarEmoji} ${hero.displayName}`).join(', ')}` : 'Not assigned to a Hero'}</Text>}
        </View>
        <View style={styles.actions}>
          {view === 'household' ? <><Pressable accessibilityLabel={`Edit ${q.title}`} onPress={() => edit(q)} style={styles.iconButton}><Ionicons name="create-outline" size={20} color={colors.navy} /></Pressable><Pressable accessibilityLabel={`Remove ${q.title}`} onPress={() => remove(q)} style={styles.iconButton}><Ionicons name="trash-outline" size={19} color={colors.coral} /></Pressable></> : <Pressable accessibilityLabel={`Add ${q.title}`} onPress={() => addFromLibrary(q)} style={styles.libraryAdd}><Text style={styles.libraryAddText}>ADD</Text></Pressable>}
        </View>
      </Panel>)}
    </ScrollView>
    <QuestEditor value={editing} heroes={heroes} selectedHeroIds={editingHeroIds} onSelectedHeroIds={setEditingHeroIds} isExisting={editing !== null && editing !== 'new' && quests.some(item => item.id === editing.id)} onClose={() => setEditing(null)} onSave={async (quest, heroIds) => { if (await onSave(quest, heroIds)) setEditing(null); }} />
  </>;
}

function QuestEditor({ value, heroes, selectedHeroIds, onSelectedHeroIds, isExisting, onClose, onSave }: { value: Quest | null | 'new'; heroes: HeroProfile[]; selectedHeroIds: string[]; onSelectedHeroIds: (ids: string[]) => void; isExisting: boolean; onClose: () => void; onSave: (quest: Quest, heroIds: string[]) => void | Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (!value || value === 'new') return setDraft(emptyDraft);
    setDraft({ title: value.title, description: value.description, emoji: value.emoji, cadence: value.cadence ?? 'daily', scheduleLabel: value.scheduleLabel ?? 'Every day', stars: String(value.stars), xp: String(value.xp), timerMinutes: value.timerMinutes ? String(value.timerMinutes) : '', minimumAge: value.minimumAge == null ? '' : String(value.minimumAge), maximumAge: value.maximumAge == null ? '' : String(value.maximumAge) });
  }, [value]);
  if (!value) return null;
  const set = <K extends keyof Draft>(key: K, next: Draft[K]) => setDraft(old => ({ ...old, [key]: next }));
  const submit = async () => {
    if (!draft.title.trim()) return Alert.alert('Quest name required', 'Give this quest a short, encouraging name.');
    const stars = Math.max(0, Number.parseInt(draft.stars, 10) || 0); const xp = Math.max(0, Number.parseInt(draft.xp, 10) || 0); const timer = Number.parseInt(draft.timerMinutes, 10) || undefined;
    const minimumAge = draft.minimumAge.trim() ? Number.parseInt(draft.minimumAge, 10) : undefined;
    const maximumAge = draft.maximumAge.trim() ? Number.parseInt(draft.maximumAge, 10) : undefined;
    if ((minimumAge != null && (minimumAge < 3 || minimumAge > 18)) || (maximumAge != null && (maximumAge < 3 || maximumAge > 18))) return Alert.alert('Invalid age range', 'Quest ages must be between 3 and 18.');
    if (minimumAge != null && maximumAge != null && minimumAge > maximumAge) return Alert.alert('Invalid age range', 'The maximum age must be equal to or greater than the minimum age.');
    const kind = draft.cadence === 'guild' ? 'guild' as const : timer ? 'timer' as const : value !== 'new' && value.kind === 'bedtime' ? 'bedtime' as const : 'daily' as const;
    const quest = { id: value === 'new' ? `quest-${Date.now()}` : value.id, templateId: undefined, catalogQuestId: value === 'new' ? undefined : value.catalogQuestId, title: draft.title.trim(), description: draft.description.trim() || 'A new heroic challenge', emoji: draft.emoji.trim() || '✨', cadence: draft.cadence, scheduleLabel: draft.scheduleLabel.trim() || 'Every day', kind, cutoffLabel: value === 'new' ? undefined : value.cutoffLabel, status: 'available' as const, stars, xp, timerMinutes: timer, minimumAge, maximumAge };
    const eligible = selectedHeroIds.filter(id => { const hero = heroes.find(item => item.id === id); return hero && isAgeEligible(quest, hero); });
    if (heroes.length && !eligible.length) return Alert.alert('Choose an eligible Hero', 'Assign this quest to at least one Hero whose age matches the quest range.');
    await onSave(quest, eligible);
  };
  const previewQuest = { minimumAge: draft.minimumAge ? Number(draft.minimumAge) : undefined, maximumAge: draft.maximumAge ? Number(draft.maximumAge) : undefined };
  return <Modal animationType="slide" visible onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}><View style={styles.modalSurface}><View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{isExisting ? 'Edit quest' : 'Add quest'}</Text><Pressable onPress={submit}><Text style={styles.save}>Save</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Quest name"><TextInput value={draft.title} onChangeText={text => set('title', text)} placeholder="e.g. Tidy your room" style={styles.input} /></Field>
      <Field label="Description"><TextInput value={draft.description} onChangeText={text => set('description', text)} placeholder="What should the hero do?" multiline style={[styles.input, styles.multiline]} /></Field>
      <Field label="Quest type"><View style={styles.segment}>{(['daily','weekly','guild'] as const).map(key => <Pressable key={key} onPress={() => set('cadence', key)} style={[styles.segmentItem, draft.cadence === key && styles.segmentActive]}><Text style={[styles.segmentText, draft.cadence === key && styles.segmentTextActive]}>{key[0].toUpperCase()+key.slice(1)}</Text></Pressable>)}</View></Field>
      <Field label="Icon"><EmojiPickerField value={draft.emoji} onSelect={emoji => set('emoji', emoji)} /></Field>
      <Field label="Schedule"><TextInput value={draft.scheduleLabel} onChangeText={text => set('scheduleLabel', text)} placeholder="Mon–Fri" style={styles.input} /></Field>
      <Field label="Age suitability"><Text style={styles.fieldHint}>Leave both fields blank to make this quest available to all ages.</Text><View style={styles.twoColumns}><TextInput accessibilityLabel="Minimum age" value={draft.minimumAge} onChangeText={text => set('minimumAge', text.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Minimum age" style={[styles.input, styles.half]} /><TextInput accessibilityLabel="Maximum age" value={draft.maximumAge} onChangeText={text => set('maximumAge', text.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Maximum age" style={[styles.input, styles.half]} /></View></Field>
      <Field label="Assign to Heroes"><Text style={styles.fieldHint}>Each Hero keeps their own completion status. Ineligible Heroes cannot be selected.</Text><View style={styles.heroChoices}>{heroes.map(hero => { const eligible = isAgeEligible(previewQuest, hero); const selected = selectedHeroIds.includes(hero.id); const age = calculateAge(hero.dateOfBirth); return <Pressable key={hero.id} disabled={!eligible} onPress={() => onSelectedHeroIds(selected ? selectedHeroIds.filter(id => id !== hero.id) : [...selectedHeroIds, hero.id])} style={[styles.heroChoice, selected && styles.heroChoiceSelected, !eligible && styles.heroChoiceDisabled]}><Text style={styles.heroChoiceEmoji}>{hero.avatarEmoji}</Text><Text style={[styles.heroChoiceText, selected && styles.heroChoiceTextSelected]}>{hero.displayName}</Text><Text style={styles.heroAge}>{age === null ? 'Age not set' : `Age ${age}`}</Text></Pressable>; })}</View></Field>
      <View style={styles.twoColumns}><Field label="Stars" style={styles.half}><TextInput value={draft.stars} onChangeText={text => set('stars', text)} keyboardType="number-pad" style={styles.input} /></Field><Field label="XP" style={styles.half}><TextInput value={draft.xp} onChangeText={text => set('xp', text)} keyboardType="number-pad" style={styles.input} /></Field></View>
      <Field label="Timer minutes (optional)"><TextInput value={draft.timerMinutes} onChangeText={text => set('timerMinutes', text)} keyboardType="number-pad" placeholder="20" style={styles.input} /></Field>
      {draft.cadence === 'guild' && <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={22} color={colors.purple} /><Text style={styles.noticeText}>Guild Quests always require Party Leader approval before stars and XP are awarded.</Text></View>}
      <Pressable onPress={submit} style={styles.primary}><Text style={styles.primaryText}>{isExisting ? 'Save changes' : 'Add to my quests'}</Text></Pressable>
    </ScrollView>
  </View></SafeAreaView></Modal>;
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

function isAgeEligible(quest: Pick<Quest, 'minimumAge' | 'maximumAge'>, hero: HeroProfile) {
  const age = calculateAge(hero.dateOfBirth);
  return age == null || ((quest.minimumAge == null || age >= quest.minimumAge) && (quest.maximumAge == null || age <= quest.maximumAge));
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pageTitle: { fontSize: 27, color: colors.navy, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 13, marginTop: 2 }, addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  viewTabs: { flexDirection: 'row', padding: 4, borderRadius: 15, backgroundColor: '#EAE5D9' }, viewTab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12 }, viewTabActive: { backgroundColor: colors.navy }, viewTabText: { color: colors.muted, fontWeight: '900', fontSize: 12 }, viewTabTextActive: { color: colors.white }, privacy: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 9 }, summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 5 }, summaryNumber: { color: colors.navy, fontSize: 22, fontWeight: '900' }, summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  filters: { gap: 8 }, filter: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, filterActive: { backgroundColor: colors.navy, borderColor: colors.navy }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: colors.white },
  questCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, emojiBox: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 25 }, questCopy: { flex: 1, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, questTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, description: { color: colors.muted, fontSize: 11 }, meta: { color: colors.green, fontSize: 10, fontWeight: '800' }, assigned: { color: colors.navy, fontSize: 10, fontWeight: '800', marginTop: 2 }, actions: { gap: 7 }, iconButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, libraryAdd: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.green }, libraryAddText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 38 }, emptyIcon: { fontSize: 42 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8 }, link: { color: colors.green, fontWeight: '900', marginTop: 10 }, modalSafe: { flex: 1, backgroundColor: colors.cream }, modalSurface: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: colors.cream, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: colors.border }, cancel: { color: colors.muted, fontWeight: '700' }, save: { color: colors.green, fontWeight: '900' }, modalTitle: { color: colors.navy, fontWeight: '900', fontSize: 17 }, form: { padding: 18, gap: 17, paddingBottom: 50 }, field: { gap: 7 }, fieldHint: { color: colors.muted, fontSize: 11, lineHeight: 16 }, label: { color: colors.navy, fontWeight: '800', fontSize: 12 }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, multiline: { minHeight: 86, textAlignVertical: 'top' }, segment: { flexDirection: 'row', backgroundColor: '#EAE5D9', padding: 4, borderRadius: 14 }, segmentItem: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 11 }, segmentActive: { backgroundColor: colors.navy }, segmentText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, segmentTextActive: { color: colors.white }, twoColumns: { flexDirection: 'row', gap: 12 }, half: { flex: 1 }, smallField: { width: 82 }, wideField: { flex: 1 }, heroChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, heroChoice: { minWidth: 105, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, heroChoiceSelected: { borderColor: colors.green, backgroundColor: '#EAF5DF' }, heroChoiceDisabled: { opacity: 0.35 }, heroChoiceEmoji: { fontSize: 18 }, heroChoiceText: { color: colors.navy, fontWeight: '900', fontSize: 12 }, heroChoiceTextSelected: { color: colors.green }, heroAge: { color: colors.muted, fontSize: 9 }, notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#EFE8FA', alignItems: 'center' }, noticeText: { color: colors.purple, flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' }, primary: { backgroundColor: colors.green, borderRadius: 15, padding: 16, alignItems: 'center', marginTop: 5 }, primaryText: { color: colors.white, fontWeight: '900' },
});
