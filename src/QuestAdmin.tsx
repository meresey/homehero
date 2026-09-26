import { ReactNode, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState, PageHeading, Panel, Pill } from './components';
import { colors } from './theme';
import { GuildScheduleMode, HeroProfile, Quest, QuestAssignment } from './types';
import { EmojiPickerField } from './EmojiPicker';
import { calculateAge, formatQuestAgeRange } from './ageEligibility';

type Category = 'all' | 'daily' | 'weekly' | 'guild';
type Draft = { title: string; description: string; emoji: string; cadence: Exclude<Category, 'all'>; scheduleLabel: string; guildScheduleMode: GuildScheduleMode; guildDayOfWeek: number; stars: string; xp: string; timerMinutes: string; minimumAge: string; maximumAge: string };

const weekdays = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 7, short: 'Sun', label: 'Sunday' },
] as const;

const emptyDraft: Draft = { title: '', description: '', emoji: '✨', cadence: 'daily', scheduleLabel: 'Every day', guildScheduleMode: 'any_week', guildDayOfWeek: 6, stars: '1', xp: '1', timerMinutes: '', minimumAge: '', maximumAge: '' };

type QuestAdminProps = { quests: Quest[]; retiredQuests?: Quest[]; pendingTemplateIds?: string[]; heroes?: HeroProfile[]; assignments?: QuestAssignment[]; catalog?: Quest[]; onSave: (quest: Quest, heroIds: string[]) => boolean | Promise<boolean>; onRemove: (id: string) => boolean | Promise<boolean>; onRestore: (id: string) => boolean | Promise<boolean> };

export function QuestAdmin({ quests, retiredQuests = [], pendingTemplateIds = [], heroes = [], assignments = [], catalog = [], onSave, onRemove, onRestore }: QuestAdminProps) {
  const mobile = useWindowDimensions().width < 600;
  const [category, setCategory] = useState<Category>('all');
  const [editing, setEditing] = useState<Quest | null | 'new'>(null);
  const [view, setView] = useState<'household' | 'library' | 'retired'>('household');
  const [editingHeroIds, setEditingHeroIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Quest | null>(null);
  const [removalBusy, setRemovalBusy] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const householdQuestIds = [...quests, ...retiredQuests].map(quest => quest.catalogQuestId);
  const source = view === 'household' ? quests : view === 'retired' ? retiredQuests : catalog.filter(item => !householdQuestIds.includes(item.catalogQuestId));
  const filtered = source.filter(q => category === 'all' || (q.cadence ?? (q.kind === 'guild' ? 'guild' : 'daily')) === category);
  const counts = (key: Category) => key === 'all' ? source.length : source.filter(q => (q.cadence ?? (q.kind === 'guild' ? 'guild' : 'daily')) === key).length;
  const assignmentIds = (questId: string) => assignments.filter(item => item.questId === questId && item.active).map(item => item.heroId);
  const edit = (quest: Quest) => {
    const assignmentDays = assignments.find(item => item.questId === quest.id && item.active)?.daysOfWeek;
    const inferredMode = quest.guildScheduleMode ?? (assignmentDays?.length === 7 || (!assignmentDays && !dayFromLabel(quest.scheduleLabel)) ? 'any_week' : 'specific_day');
    const inferredDay = quest.guildDayOfWeek ?? assignmentDays?.[0] ?? dayFromLabel(quest.scheduleLabel) ?? 6;
    setEditingHeroIds(assignmentIds(quest.id));
    setEditing(quest.cadence === 'guild' ? { ...quest, guildScheduleMode: inferredMode, guildDayOfWeek: inferredDay } : quest);
  };
  const create = () => { setEditingHeroIds(heroes.map(hero => hero.id)); setEditing('new'); };
  const addFromLibrary = (quest: Quest) => {
    const id = `quest-${Date.now()}`;
    setEditingHeroIds(heroes.filter(hero => isAgeEligible(quest, hero)).map(hero => hero.id));
    setEditing({ ...quest, id, templateId: undefined, catalogQuestId: quest.catalogQuestId ?? quest.id, householdId: undefined, visibility: 'household' });
  };

  const remove = (quest: Quest) => { setRemovalError(null); setRemoving(quest); };
  const confirmRemove = async () => {
    if (!removing || removalBusy) return;
    setRemovalBusy(true); setRemovalError(null);
    try {
      const removed = await onRemove(removing.id);
      if (removed) setRemoving(null);
      else setRemovalError('The quest could not be removed. Please try again.');
    } catch (cause) {
      setRemovalError(cause instanceof Error ? cause.message : 'The quest could not be removed. Please try again.');
    } finally { setRemovalBusy(false); }
  };
  const restore = async (quest: Quest) => {
    if (restoringId) return;
    setRestoringId(quest.id);
    try { await onRestore(quest.templateId ?? quest.id); }
    finally { setRestoringId(null); }
  };

  return <>
    <ScrollView contentContainerStyle={styles.content}>
      <PageHeading eyebrow="PARTY LEADER" title="Household quests" subtitle={mobile ? undefined : 'Choose adventures and assign them to one or more Heroes'} action={<Pressable accessibilityLabel="Add custom quest" style={styles.addButton} onPress={create}><Ionicons name="add" size={25} color={colors.white} /></Pressable>} />

      <View style={styles.viewTabs}>
        <Pressable onPress={() => setView('household')} style={[styles.viewTab, view === 'household' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'household' && styles.viewTabTextActive]}>My quests</Text></Pressable>
        <Pressable onPress={() => setView('library')} style={[styles.viewTab, view === 'library' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'library' && styles.viewTabTextActive]}>Quest library</Text></Pressable>
        <Pressable onPress={() => setView('retired')} style={[styles.viewTab, view === 'retired' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'retired' && styles.viewTabTextActive]}>Retired</Text></Pressable>
      </View>
      <Text style={styles.privacy}>{view === 'library' ? '✨ Ready-made quests you can customise before adding' : view === 'retired' ? '🗃️ Hidden from Heroes · history is preserved' : '🔒 Private to your household'}</Text>

      {!mobile && <View style={styles.summaryRow}>
        {(['daily','weekly','guild'] as const).map(key => <Panel key={key} style={styles.summaryCard}><Text style={styles.summaryNumber}>{counts(key)}</Text><Text style={styles.summaryLabel}>{key}</Text></Panel>)}
      </View>}

      <View style={styles.filters}>
        {(['all','daily','weekly','guild'] as Category[]).map(key => <Pressable key={key} onPress={() => setCategory(key)} style={[styles.filter, category === key && styles.filterActive]}><Text style={[styles.filterText, category === key && styles.filterTextActive]}>{key[0].toUpperCase()+key.slice(1)} · {counts(key)}</Text></Pressable>)}
      </View>

      {filtered.length === 0 ? <EmptyState icon={view === 'retired' ? 'archive-outline' : 'map-outline'} title={view === 'library' ? 'Every library quest is already added' : view === 'retired' ? 'No retired quests' : `No ${category} quests yet`} description={view === 'household' ? 'Create a quest for your Heroes or explore the library.' : undefined} action={view === 'household' ? <Pressable onPress={create}><Text style={styles.link}>Create the first one</Text></Pressable> : undefined} /> : filtered.map(q => <Panel key={q.id} style={[styles.questCard, mobile && styles.questCardMobile]}>
        <View style={styles.emojiBox}><Text style={styles.emoji}>{q.emoji}</Text></View>
        <View style={styles.questCopy}>
          <View style={styles.titleRow}><Text style={styles.questTitle}>{q.title}</Text><Pill tone={q.cadence === 'guild' ? 'purple' : q.cadence === 'weekly' ? 'gold' : 'green'}>{(q.cadence ?? 'daily').toUpperCase()}</Pill></View>
          {!mobile && <Text style={styles.description}>{q.description}</Text>}
          <Text style={styles.meta}>{q.scheduleLabel ?? 'Every day'}{!mobile && `  ·  ${formatQuestAgeRange(q)}`}  ·  ⭐ {q.stars}  ·  ✦ {q.xp} XP{q.timerMinutes ? `  ·  ◷ ${q.timerMinutes} min` : ''}</Text>
          {view === 'household' && <Text style={styles.assigned}>{assignmentIds(q.id).length ? `Assigned to ${heroes.filter(hero => assignmentIds(q.id).includes(hero.id)).map(hero => `${hero.avatarEmoji} ${hero.displayName}`).join(', ')}` : 'Not assigned to a Hero'}</Text>}
          {view === 'household' && pendingTemplateIds.includes(q.templateId ?? q.id) && <Text style={styles.pendingNote}>Pending approval · review before retiring</Text>}
          {view === 'retired' && <Text style={styles.retiredNote}>Past completions and earned points are preserved.</Text>}
        </View>
        <View style={styles.actions}>
          {view === 'household' ? <><Pressable accessibilityLabel={`Edit ${q.title}`} onPress={() => edit(q)} style={styles.iconButton}><Ionicons name="create-outline" size={20} color={colors.navy} /></Pressable><Pressable disabled={pendingTemplateIds.includes(q.templateId ?? q.id)} accessibilityLabel={pendingTemplateIds.includes(q.templateId ?? q.id) ? `Cannot retire ${q.title} while approval is pending` : `Retire ${q.title}`} onPress={() => remove(q)} style={[styles.iconButton, pendingTemplateIds.includes(q.templateId ?? q.id) && styles.disabledAction]}><Ionicons name="archive-outline" size={19} color={pendingTemplateIds.includes(q.templateId ?? q.id) ? colors.muted : colors.coral} /></Pressable></> : view === 'retired' ? <Pressable disabled={Boolean(restoringId)} accessibilityLabel={`Restore ${q.title}`} onPress={() => restore(q)} style={styles.restoreButton}><Text style={styles.restoreText}>{restoringId === q.id ? 'RESTORING…' : 'RESTORE'}</Text></Pressable> : <Pressable accessibilityLabel={`Add ${q.title}`} onPress={() => addFromLibrary(q)} style={styles.libraryAdd}><Text style={styles.libraryAddText}>ADD</Text></Pressable>}
        </View>
      </Panel>)}
    </ScrollView>
    <QuestEditor value={editing} heroes={heroes} selectedHeroIds={editingHeroIds} onSelectedHeroIds={setEditingHeroIds} isExisting={editing !== null && editing !== 'new' && quests.some(item => item.id === editing.id)} onClose={() => setEditing(null)} onSave={onSave} />
    <Modal visible={Boolean(removing)} transparent animationType="fade" onRequestClose={() => { if (!removalBusy) setRemoving(null); }}>
      <View style={styles.confirmOverlay}>
        <View accessibilityRole="alert" style={styles.confirmCard}>
          <View style={styles.confirmIcon}><Ionicons name="archive-outline" size={24} color={colors.coral} /></View>
          <Text style={styles.confirmTitle}>Retire quest?</Text>
          <Text style={styles.confirmText}>“{removing?.title}” will stop appearing in future schedules. Existing completions, stars, and XP will be kept. You can restore it later.</Text>
          {removalError && <View style={styles.removeError}><Text style={styles.removeErrorText}>{removalError}</Text></View>}
          <View style={styles.confirmActions}>
            <Pressable disabled={removalBusy} onPress={() => setRemoving(null)} style={styles.confirmCancel}><Text style={styles.confirmCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={removalBusy} onPress={confirmRemove} style={[styles.confirmRemove, removalBusy && styles.confirmDisabled]}><Text style={styles.confirmRemoveText}>{removalBusy ? 'Retiring…' : 'Retire quest'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

function QuestEditor({ value, heroes, selectedHeroIds, onSelectedHeroIds, isExisting, onClose, onSave }: { value: Quest | null | 'new'; heroes: HeroProfile[]; selectedHeroIds: string[]; onSelectedHeroIds: (ids: string[]) => void; isExisting: boolean; onClose: () => void; onSave: (quest: Quest, heroIds: string[]) => boolean | Promise<boolean> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setFormError(null); setSaving(false);
    if (!value || value === 'new') return setDraft(emptyDraft);
    setDraft({ title: value.title, description: value.description, emoji: value.emoji, cadence: value.cadence ?? 'daily', scheduleLabel: value.scheduleLabel ?? 'Every day', guildScheduleMode: value.guildScheduleMode ?? (dayFromLabel(value.scheduleLabel) ? 'specific_day' : 'any_week'), guildDayOfWeek: value.guildDayOfWeek ?? dayFromLabel(value.scheduleLabel) ?? 6, stars: String(value.stars), xp: String(value.xp), timerMinutes: value.kind === 'guild' ? '' : value.timerMinutes ? String(value.timerMinutes) : '', minimumAge: value.minimumAge == null ? '' : String(value.minimumAge), maximumAge: value.maximumAge == null ? '' : String(value.maximumAge) });
  }, [value]);
  if (!value) return null;
  const set = <K extends keyof Draft>(key: K, next: Draft[K]) => { setFormError(null); setDraft(old => ({ ...old, [key]: next })); };
  const setCadence = (cadence: Draft['cadence']) => {
    setFormError(null);
    setDraft(old => ({
      ...old,
      cadence,
      timerMinutes: cadence === 'guild' ? '' : old.timerMinutes,
      scheduleLabel: cadence === 'guild' ? 'Any day this week' : old.cadence === 'guild' ? (cadence === 'weekly' ? 'Once a week' : 'Every day') : old.scheduleLabel,
    }));
  };
  const submit = async () => {
    if (saving) return;
    setFormError(null);
    if (!draft.title.trim()) return setFormError('Give this quest a short, encouraging name.');
    const stars = Math.max(0, Number.parseInt(draft.stars, 10) || 0); const xp = Math.max(0, Number.parseInt(draft.xp, 10) || 0); const timer = draft.cadence === 'guild' ? undefined : Number.parseInt(draft.timerMinutes, 10) || undefined;
    const minimumAge = draft.minimumAge.trim() ? Number.parseInt(draft.minimumAge, 10) : undefined;
    const maximumAge = draft.maximumAge.trim() ? Number.parseInt(draft.maximumAge, 10) : undefined;
    if ((minimumAge != null && (minimumAge < 3 || minimumAge > 18)) || (maximumAge != null && (maximumAge < 3 || maximumAge > 18))) return setFormError('Quest ages must be between 3 and 18.');
    if (minimumAge != null && maximumAge != null && minimumAge > maximumAge) return setFormError('The maximum age must be equal to or greater than the minimum age.');
    const kind = draft.cadence === 'guild' ? 'guild' as const : timer ? 'timer' as const : value !== 'new' && value.kind === 'bedtime' ? 'bedtime' as const : 'daily' as const;
    const guildScheduleMode = draft.cadence === 'guild' ? draft.guildScheduleMode : undefined;
    const guildDayOfWeek = draft.cadence === 'guild' && draft.guildScheduleMode === 'specific_day' ? draft.guildDayOfWeek : undefined;
    const scheduleLabel = draft.cadence === 'guild'
      ? draft.guildScheduleMode === 'any_week' ? 'Any day this week' : weekdays.find(day => day.value === draft.guildDayOfWeek)?.label ?? 'Saturday'
      : draft.scheduleLabel.trim() || 'Every day';
    const quest = { id: value === 'new' ? `quest-${Date.now()}` : value.id, templateId: isExisting && value !== 'new' ? value.templateId ?? value.id : undefined, catalogQuestId: value === 'new' ? undefined : value.catalogQuestId, title: draft.title.trim(), description: draft.description.trim() || 'A new heroic challenge', emoji: draft.emoji.trim() || '✨', cadence: draft.cadence, scheduleLabel, guildScheduleMode, guildDayOfWeek, kind, cutoffLabel: value === 'new' ? undefined : value.cutoffLabel, status: 'available' as const, stars, xp, timerMinutes: timer, minimumAge, maximumAge };
    const eligible = selectedHeroIds.filter(id => { const hero = heroes.find(item => item.id === id); return hero && isAgeEligible(quest, hero); });
    setSaving(true);
    try {
      const saved = await onSave(quest, eligible);
      if (saved) onClose();
      else setFormError('The quest could not be saved. Check the details and try again.');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The quest could not be saved. Please try again.');
    } finally { setSaving(false); }
  };
  const previewQuest = { minimumAge: draft.minimumAge ? Number(draft.minimumAge) : undefined, maximumAge: draft.maximumAge ? Number(draft.maximumAge) : undefined };
  return <Modal animationType="slide" visible onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}><View style={styles.modalSurface}><View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{isExisting ? 'Edit quest' : 'Add quest'}</Text><Pressable disabled={saving} onPress={submit}><Text style={styles.save}>{saving ? 'Saving…' : 'Save'}</Text></Pressable></View>
    {formError && <View style={[styles.formError, styles.formErrorTop]}><Ionicons name="alert-circle-outline" size={19} color={colors.coral} /><Text style={styles.formErrorText}>{formError}</Text></View>}
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Quest name"><TextInput value={draft.title} onChangeText={text => set('title', text)} placeholder="e.g. Tidy your room" style={styles.input} /></Field>
      <Field label="Description"><TextInput value={draft.description} onChangeText={text => set('description', text)} placeholder="What should the hero do?" multiline style={[styles.input, styles.multiline]} /></Field>
      <Field label="Quest type"><View style={styles.segment}>{(['daily','weekly','guild'] as const).map(key => <Pressable key={key} onPress={() => setCadence(key)} style={[styles.segmentItem, draft.cadence === key && styles.segmentActive]}><Text style={[styles.segmentText, draft.cadence === key && styles.segmentTextActive]}>{key[0].toUpperCase()+key.slice(1)}</Text></Pressable>)}</View></Field>
      <Field label="Icon"><EmojiPickerField value={draft.emoji} onSelect={emoji => set('emoji', emoji)} /></Field>
      {draft.cadence === 'guild' ? <Field label="Guild schedule">
        <Text style={styles.fieldHint}>Choose whether the family can complete this quest once at any time during the week or only on a particular day.</Text>
        <View style={styles.segment}>
          <Pressable onPress={() => set('guildScheduleMode', 'any_week')} style={[styles.segmentItem, draft.guildScheduleMode === 'any_week' && styles.segmentActive]}><Text style={[styles.segmentText, draft.guildScheduleMode === 'any_week' && styles.segmentTextActive]}>Any day this week</Text></Pressable>
          <Pressable onPress={() => set('guildScheduleMode', 'specific_day')} style={[styles.segmentItem, draft.guildScheduleMode === 'specific_day' && styles.segmentActive]}><Text style={[styles.segmentText, draft.guildScheduleMode === 'specific_day' && styles.segmentTextActive]}>Specific day</Text></Pressable>
        </View>
        {draft.guildScheduleMode === 'specific_day' && <View style={styles.weekdays}>{weekdays.map(day => <Pressable accessibilityLabel={day.label} key={day.value} onPress={() => set('guildDayOfWeek', day.value)} style={[styles.weekday, draft.guildDayOfWeek === day.value && styles.weekdayActive]}><Text style={[styles.weekdayText, draft.guildDayOfWeek === day.value && styles.weekdayTextActive]}>{day.short}</Text></Pressable>)}</View>}
      </Field> : <Field label="Schedule"><TextInput value={draft.scheduleLabel} onChangeText={text => set('scheduleLabel', text)} placeholder="Mon–Fri" style={styles.input} /></Field>}
      <Field label="Age suitability"><Text style={styles.fieldHint}>Leave both fields blank to make this quest available to all ages.</Text><View style={styles.twoColumns}><TextInput accessibilityLabel="Minimum age" value={draft.minimumAge} onChangeText={text => set('minimumAge', text.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Minimum age" style={[styles.input, styles.half]} /><TextInput accessibilityLabel="Maximum age" value={draft.maximumAge} onChangeText={text => set('maximumAge', text.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Maximum age" style={[styles.input, styles.half]} /></View></Field>
      <Field label="Assign to Heroes"><Text style={styles.fieldHint}>Each Hero keeps their own completion status. Ineligible Heroes cannot be selected. You can save the quest without an assignment.</Text><View style={styles.heroChoices}>{heroes.map(hero => { const eligible = isAgeEligible(previewQuest, hero); const selected = eligible && selectedHeroIds.includes(hero.id); const age = calculateAge(hero.dateOfBirth); return <Pressable key={hero.id} disabled={!eligible || saving} onPress={() => onSelectedHeroIds(selected ? selectedHeroIds.filter(id => id !== hero.id) : [...selectedHeroIds, hero.id])} style={[styles.heroChoice, selected && styles.heroChoiceSelected, !eligible && styles.heroChoiceDisabled]}><Text style={styles.heroChoiceEmoji}>{hero.avatarEmoji}</Text><Text style={[styles.heroChoiceText, selected && styles.heroChoiceTextSelected]}>{hero.displayName}</Text><Text style={styles.heroAge}>{age === null ? 'Age not set' : `Age ${age}`}</Text></Pressable>; })}</View></Field>
      <View style={styles.twoColumns}><Field label="Stars" style={styles.half}><TextInput value={draft.stars} onChangeText={text => set('stars', text)} keyboardType="number-pad" style={styles.input} /></Field><Field label="XP" style={styles.half}><TextInput value={draft.xp} onChangeText={text => set('xp', text)} keyboardType="number-pad" style={styles.input} /></Field></View>
      {draft.cadence !== 'guild' && <Field label="Timer minutes (optional)"><TextInput value={draft.timerMinutes} onChangeText={text => set('timerMinutes', text)} keyboardType="number-pad" placeholder="20" style={styles.input} /></Field>}
      <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={22} color={colors.purple} /><Text style={styles.noticeText}>All quests require Party Leader approval before stars and XP are awarded.</Text></View>
      <Pressable accessibilityRole="button" disabled={saving} onPress={submit} style={[styles.primary, saving && styles.confirmDisabled]}><Text style={styles.primaryText}>{saving ? 'Saving…' : isExisting ? 'Save changes' : 'Add to my quests'}</Text></Pressable>
    </ScrollView>
  </View></SafeAreaView></Modal>;
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

function isAgeEligible(quest: Pick<Quest, 'minimumAge' | 'maximumAge'>, hero: HeroProfile) {
  const age = calculateAge(hero.dateOfBirth);
  return age == null || ((quest.minimumAge == null || age >= quest.minimumAge) && (quest.maximumAge == null || age <= quest.maximumAge));
}

function dayFromLabel(label?: string) {
  if (!label) return undefined;
  return weekdays.find(day => day.label.toLowerCase() === label.trim().toLowerCase())?.value;
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pageTitle: { fontSize: 27, color: colors.navy, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 13, marginTop: 2 }, addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  viewTabs: { flexDirection: 'row', padding: 4, borderRadius: 15, backgroundColor: '#EAE5D9' }, viewTab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12 }, viewTabActive: { backgroundColor: colors.navy }, viewTabText: { color: colors.muted, fontWeight: '900', fontSize: 12 }, viewTabTextActive: { color: colors.white }, privacy: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 9 }, summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 5 }, summaryNumber: { color: colors.navy, fontSize: 22, fontWeight: '900' }, summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filter: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, filterActive: { backgroundColor: colors.navy, borderColor: colors.navy }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: colors.white },
  questCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, emojiBox: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 25 }, questCopy: { flex: 1, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, questTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, description: { color: colors.muted, fontSize: 11 }, meta: { color: colors.green, fontSize: 10, fontWeight: '800' }, assigned: { color: colors.navy, fontSize: 10, fontWeight: '800', marginTop: 2 }, pendingNote: { color: colors.coral, fontSize: 10, fontWeight: '900', marginTop: 2 }, retiredNote: { color: colors.purple, fontSize: 10, fontWeight: '800', marginTop: 2 }, actions: { gap: 7 }, iconButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, disabledAction: { opacity: .45 }, libraryAdd: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.green }, libraryAddText: { color: colors.white, fontSize: 10, fontWeight: '900' }, restoreButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.navy }, restoreText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  questCardMobile: { padding: 11, gap: 9 },
  empty: { alignItems: 'center', paddingVertical: 38 }, emptyIcon: { fontSize: 42 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8 }, link: { color: colors.green, fontWeight: '900', marginTop: 10 }, modalSafe: { flex: 1, backgroundColor: colors.cream }, modalSurface: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: colors.cream, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: colors.border }, cancel: { color: colors.muted, fontWeight: '700' }, save: { color: colors.green, fontWeight: '900' }, modalTitle: { color: colors.navy, fontWeight: '900', fontSize: 17 }, form: { padding: 18, gap: 17, paddingBottom: 50 }, field: { gap: 7 }, fieldHint: { color: colors.muted, fontSize: 11, lineHeight: 16 }, label: { color: colors.navy, fontWeight: '800', fontSize: 12 }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, multiline: { minHeight: 86, textAlignVertical: 'top' }, segment: { flexDirection: 'row', backgroundColor: '#EAE5D9', padding: 4, borderRadius: 14 }, segmentItem: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 11 }, segmentActive: { backgroundColor: colors.navy }, segmentText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, segmentTextActive: { color: colors.white }, twoColumns: { flexDirection: 'row', gap: 12 }, half: { flex: 1 }, smallField: { width: 82 }, wideField: { flex: 1 }, heroChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, heroChoice: { minWidth: 105, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, heroChoiceSelected: { borderColor: colors.green, backgroundColor: '#EAF5DF' }, heroChoiceDisabled: { opacity: 0.35 }, heroChoiceEmoji: { fontSize: 18 }, heroChoiceText: { color: colors.navy, fontWeight: '900', fontSize: 12 }, heroChoiceTextSelected: { color: colors.green }, heroAge: { color: colors.muted, fontSize: 9 }, notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#EFE8FA', alignItems: 'center' }, noticeText: { color: colors.purple, flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' }, primary: { backgroundColor: colors.green, borderRadius: 15, padding: 16, alignItems: 'center', marginTop: 5 }, primaryText: { color: colors.white, fontWeight: '900' },
  confirmOverlay: { flex: 1, padding: 20, backgroundColor: 'rgba(14, 35, 69, .45)', alignItems: 'center', justifyContent: 'center' }, confirmCard: { width: '100%', maxWidth: 440, borderRadius: 22, backgroundColor: colors.white, padding: 22, alignItems: 'center' }, confirmIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, confirmTitle: { color: colors.navy, fontSize: 21, fontWeight: '900' }, confirmText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 }, removeError: { alignSelf: 'stretch', borderRadius: 12, padding: 11, marginTop: 14, backgroundColor: '#FFF0ED', borderWidth: 1, borderColor: colors.coral }, removeErrorText: { color: colors.coral, fontSize: 11, lineHeight: 16, fontWeight: '800' }, confirmActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 20 }, confirmCancel: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, confirmCancelText: { color: colors.navy, fontWeight: '900' }, confirmRemove: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }, confirmRemoveText: { color: colors.white, fontWeight: '900' }, confirmDisabled: { opacity: .55 },
  formError: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, padding: 12, backgroundColor: '#FFF0ED', borderWidth: 1, borderColor: colors.coral }, formErrorTop: { marginHorizontal: 18, marginTop: 14 }, formErrorText: { flex: 1, color: colors.coral, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 }, weekday: { minWidth: 52, flexGrow: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center' }, weekdayActive: { borderColor: colors.green, backgroundColor: '#EAF5DF' }, weekdayText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, weekdayTextActive: { color: colors.green },
});
