import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, PageHeading, Panel } from './components';
import { colors } from './theme';
import { Reward } from './types';
import { EmojiPickerField } from './EmojiPicker';

type Draft = { title: string; subtitle: string; emoji: string; cost: string };
const emptyDraft: Draft = { title: '', subtitle: '', emoji: '🎁', cost: '25' };

export function RewardAdmin({ rewards, retiredRewards = [], pendingRewardIds = [], catalog = [], onSave, onRemove, onRestore }: { rewards: Reward[]; retiredRewards?: Reward[]; pendingRewardIds?: string[]; catalog?: Reward[]; onSave: (reward: Reward) => boolean | Promise<boolean>; onRemove: (id: string) => boolean | Promise<boolean>; onRestore: (id: string) => boolean | Promise<boolean> }) {
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [view, setView] = useState<'household' | 'library' | 'retired'>('household');
  const [retiring, setRetiring] = useState<Reward | null>(null);
  const [retireBusy, setRetireBusy] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const availableCatalog = catalog.filter(item => ![...rewards, ...retiredRewards].some(reward => reward.catalogRewardId === item.catalogRewardId));
  const source = view === 'household' ? rewards : view === 'retired' ? retiredRewards : availableCatalog;

  const addFromLibrary = (reward: Reward) => setEditing({ ...reward, id: `reward-${Date.now()}`, rewardId: undefined, catalogRewardId: reward.catalogRewardId ?? reward.id });

  const confirmRetire = async () => {
    if (!retiring || retireBusy) return;
    setRetireBusy(true); setRetireError(null);
    try {
      if (await onRemove(retiring.rewardId ?? retiring.id)) setRetiring(null);
      else setRetireError('The reward could not be retired. Please try again.');
    } catch (cause) { setRetireError(cause instanceof Error ? cause.message : 'The reward could not be retired. Please try again.'); }
    finally { setRetireBusy(false); }
  };
  const restore = async (reward: Reward) => {
    if (restoringId) return;
    setRestoringId(reward.id);
    try { await onRestore(reward.rewardId ?? reward.id); }
    finally { setRestoringId(null); }
  };

  return <>
    <ScrollView contentContainerStyle={styles.content}>
      <PageHeading eyebrow="PARTY LEADER" title="Rewards" subtitle="Set privileges and star prices" action={<Pressable accessibilityLabel="Add reward" style={styles.addButton} onPress={() => setEditing('new')}><Ionicons name="add" size={25} color={colors.white} /></Pressable>} />
      <View style={styles.viewTabs}>
        <Pressable onPress={() => setView('household')} style={[styles.viewTab, view === 'household' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'household' && styles.viewTabTextActive]}>My rewards</Text></Pressable>
        <Pressable onPress={() => setView('library')} style={[styles.viewTab, view === 'library' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'library' && styles.viewTabTextActive]}>Reward library</Text></Pressable>
        <Pressable onPress={() => setView('retired')} style={[styles.viewTab, view === 'retired' && styles.viewTabActive]}><Text style={[styles.viewTabText, view === 'retired' && styles.viewTabTextActive]}>Retired</Text></Pressable>
      </View>
      <Text style={styles.privacy}>{view === 'library' ? '✨ Ready-made rewards you can customise before adding' : view === 'retired' ? '🗃️ Hidden from Heroes · redemption history is preserved' : '🔒 Private to your household'}</Text>
      <Panel style={styles.summary}><Text style={styles.summaryValue}>{source.length}</Text><View><Text style={styles.cardTitle}>{view === 'household' ? 'Active rewards' : view === 'retired' ? 'Retired rewards' : 'Available ideas'}</Text><Text style={styles.lead}>{view === 'household' ? 'Changes appear instantly in the Hero’s store.' : view === 'retired' ? 'Restore a reward to return it to the Star Store.' : 'Choose one, then adjust its details and price.'}</Text></View></Panel>
      {source.length === 0 ? <EmptyState icon={view === 'retired' ? 'archive-outline' : 'gift-outline'} title={view === 'library' ? 'Every library reward is already added' : view === 'retired' ? 'No retired rewards' : 'No rewards yet'} description={view === 'household' ? 'Add a reward to make your Heroes’ stars meaningful.' : undefined} action={view === 'household' ? <Pressable onPress={() => setEditing('new')}><Text style={styles.link}>Add the first reward</Text></Pressable> : undefined} /> : source.map(reward =>
        <Panel key={reward.id} style={styles.rewardCard}>
          <View style={styles.emojiBox}><Text style={styles.emoji}>{reward.emoji}</Text></View>
          <View style={styles.copy}><Text style={styles.rewardTitle}>{reward.title}</Text><Text style={styles.lead}>{reward.subtitle}</Text><Text style={styles.cost}>⭐ {reward.cost} stars</Text>{view === 'household' && pendingRewardIds.includes(reward.rewardId ?? reward.id) && <Text style={styles.pendingNote}>Pending approval · review before retiring</Text>}</View>
          <View style={styles.actions}>
            {view === 'household' ? <><Pressable accessibilityLabel={`Edit ${reward.title}`} style={styles.iconButton} onPress={() => setEditing(reward)}><Ionicons name="create-outline" size={20} color={colors.navy} /></Pressable>
            <Pressable disabled={pendingRewardIds.includes(reward.rewardId ?? reward.id)} accessibilityLabel={pendingRewardIds.includes(reward.rewardId ?? reward.id) ? `Cannot retire ${reward.title} while approval is pending` : `Retire ${reward.title}`} style={[styles.iconButton, pendingRewardIds.includes(reward.rewardId ?? reward.id) && styles.disabledAction]} onPress={() => { setRetireError(null); setRetiring(reward); }}><Ionicons name="archive-outline" size={19} color={pendingRewardIds.includes(reward.rewardId ?? reward.id) ? colors.muted : colors.coral} /></Pressable></> : view === 'retired' ? <Pressable disabled={Boolean(restoringId)} accessibilityLabel={`Restore ${reward.title}`} onPress={() => restore(reward)} style={styles.restoreButton}><Text style={styles.restoreText}>{restoringId === reward.id ? 'RESTORING…' : 'RESTORE'}</Text></Pressable> : <Pressable accessibilityLabel={`Add ${reward.title}`} onPress={() => addFromLibrary(reward)} style={styles.libraryAdd}><Text style={styles.libraryAddText}>ADD</Text></Pressable>}
          </View>
        </Panel>)}
    </ScrollView>
    <Modal visible={Boolean(retiring)} transparent animationType="fade" onRequestClose={() => { if (!retireBusy) setRetiring(null); }}>
      <View style={styles.confirmOverlay}><View accessibilityRole="alert" style={styles.confirmCard}>
        <View style={styles.confirmIcon}><Ionicons name="archive-outline" size={24} color={colors.coral} /></View>
        <Text style={styles.confirmTitle}>Retire reward?</Text>
        <Text style={styles.confirmText}>“{retiring?.title}” will disappear from the Star Store. Existing and pending requests will be preserved, and you can restore it later.</Text>
        {retireError && <View style={styles.retireError}><Text style={styles.retireErrorText}>{retireError}</Text></View>}
        <View style={styles.confirmActions}><Pressable disabled={retireBusy} onPress={() => setRetiring(null)} style={styles.confirmCancel}><Text style={styles.confirmCancelText}>Cancel</Text></Pressable><Pressable disabled={retireBusy} onPress={confirmRetire} style={[styles.confirmRetire, retireBusy && styles.disabled]}><Text style={styles.confirmRetireText}>{retireBusy ? 'Retiring…' : 'Retire reward'}</Text></Pressable></View>
      </View></View>
    </Modal>
    <RewardEditor value={editing} isExisting={editing !== null && editing !== 'new' && rewards.some(item => item.id === editing.id)} onClose={() => setEditing(null)} onSave={async reward => { if (await onSave(reward)) setEditing(null); }} />
  </>;
}

function RewardEditor({ value, isExisting, onClose, onSave }: { value: Reward | 'new' | null; isExisting: boolean; onClose: () => void; onSave: (reward: Reward) => void | Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (!value || value === 'new') setDraft(emptyDraft);
    else setDraft({ title: value.title, subtitle: value.subtitle, emoji: value.emoji, cost: String(value.cost) });
  }, [value]);
  if (!value) return null;
  const update = (key: keyof Draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const submit = async () => {
    const cost = Number.parseInt(draft.cost, 10);
    if (!draft.title.trim()) return Alert.alert('Reward name required', 'Give this reward a short name.');
    if (!Number.isInteger(cost) || cost < 1 || cost > 10000) return Alert.alert('Invalid star cost', 'Enter a whole number between 1 and 10,000.');
    await onSave({ id: value === 'new' ? `reward-${Date.now()}` : value.id, rewardId: value === 'new' ? undefined : value.rewardId, catalogRewardId: value === 'new' ? undefined : value.catalogRewardId, title: draft.title.trim(), subtitle: draft.subtitle.trim() || 'A special Hero reward', emoji: draft.emoji.trim() || '🎁', cost });
  };
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}><View style={styles.modalSurface}>
    <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{isExisting ? 'Edit reward' : 'Add reward'}</Text><Pressable onPress={submit}><Text style={styles.save}>Save</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Reward name"><TextInput value={draft.title} onChangeText={text => update('title', text)} placeholder="e.g. Choose movie night" style={styles.input} /></Field>
      <Field label="Description"><TextInput value={draft.subtitle} onChangeText={text => update('subtitle', text)} placeholder="What does the Hero receive?" multiline style={[styles.input, styles.multiline]} /></Field>
      <Field label="Icon"><EmojiPickerField value={draft.emoji} onSelect={emoji => update('emoji', emoji)} /></Field>
      <Field label="Star cost"><TextInput value={draft.cost} onChangeText={text => update('cost', text)} keyboardType="number-pad" style={styles.input} /></Field>
      <View style={styles.notice}><Ionicons name="star-outline" size={22} color={colors.green} /><Text style={styles.noticeText}>Heroes see this reward and its updated price immediately in the Star Store.</Text></View>
      <Pressable style={styles.primary} onPress={submit}><Text style={styles.primaryText}>{isExisting ? 'Save changes' : 'Add to my rewards'}</Text></Pressable>
    </ScrollView>
  </View></SafeAreaView></Modal>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 14 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, pageTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 12, lineHeight: 18 }, addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  viewTabs: { flexDirection: 'row', padding: 4, borderRadius: 15, backgroundColor: '#EAE5D9' }, viewTab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12 }, viewTabActive: { backgroundColor: colors.navy }, viewTabText: { color: colors.muted, fontWeight: '900', fontSize: 12 }, viewTabTextActive: { color: colors.white }, privacy: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 13 }, summaryValue: { color: colors.green, fontSize: 30, fontWeight: '900' }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, emojiBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 27 }, copy: { flex: 1, gap: 2 }, rewardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, cost: { color: colors.green, fontWeight: '900', fontSize: 11, marginTop: 3 }, pendingNote: { color: colors.coral, fontSize: 10, fontWeight: '900', marginTop: 3 }, actions: { gap: 7 }, iconButton: { width: 35, height: 35, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, disabledAction: { opacity: .45 }, libraryAdd: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.green }, libraryAddText: { color: colors.white, fontSize: 10, fontWeight: '900' }, restoreButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.navy }, restoreText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 42 }, emptyIcon: { fontSize: 43 }, link: { color: colors.green, fontWeight: '900', marginTop: 10 }, modalSafe: { flex: 1, backgroundColor: colors.cream }, modalSurface: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: colors.cream, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderColor: colors.border }, modalTitle: { color: colors.navy, fontSize: 17, fontWeight: '900' }, cancel: { color: colors.muted, fontWeight: '700' }, save: { color: colors.green, fontWeight: '900' }, form: { padding: 18, gap: 17 }, field: { gap: 7 }, label: { color: colors.navy, fontWeight: '800', fontSize: 12 }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, multiline: { minHeight: 88, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 12 }, iconField: { width: 84 }, costField: { flex: 1 }, notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#EAF3DD', alignItems: 'center' }, noticeText: { flex: 1, color: colors.green, fontSize: 12, lineHeight: 17, fontWeight: '700' }, primary: { backgroundColor: colors.green, borderRadius: 15, padding: 16, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '900' },
  confirmOverlay: { flex: 1, padding: 20, backgroundColor: 'rgba(14, 35, 69, .45)', alignItems: 'center', justifyContent: 'center' }, confirmCard: { width: '100%', maxWidth: 440, borderRadius: 22, backgroundColor: colors.white, padding: 22, alignItems: 'center' }, confirmIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, confirmTitle: { color: colors.navy, fontSize: 21, fontWeight: '900' }, confirmText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 }, retireError: { alignSelf: 'stretch', borderRadius: 12, padding: 11, marginTop: 14, backgroundColor: '#FFF0ED', borderWidth: 1, borderColor: colors.coral }, retireErrorText: { color: colors.coral, fontSize: 11, lineHeight: 16, fontWeight: '800' }, confirmActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 20 }, confirmCancel: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, confirmCancelText: { color: colors.navy, fontWeight: '900' }, confirmRetire: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }, confirmRetireText: { color: colors.white, fontWeight: '900' }, disabled: { opacity: .55 },
});
