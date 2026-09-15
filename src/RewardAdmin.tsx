import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Panel } from './components';
import { colors } from './theme';
import { Reward } from './types';
import { EmojiPickerField } from './EmojiPicker';

type Draft = { title: string; subtitle: string; emoji: string; cost: string };
const emptyDraft: Draft = { title: '', subtitle: '', emoji: '🎁', cost: '25' };

export function RewardAdmin({ rewards, onSave, onRemove }: { rewards: Reward[]; onSave: (reward: Reward) => void; onRemove: (id: string) => void }) {
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);

  const confirmRemove = (reward: Reward) => Alert.alert(
    'Remove reward?',
    `“${reward.title}” will disappear from the Hero’s Star Store.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => onRemove(reward.id) }],
  );

  return <>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View><Text style={styles.pageTitle}>Rewards</Text><Text style={styles.lead}>Set privileges and star prices</Text></View>
        <Pressable accessibilityLabel="Add reward" style={styles.addButton} onPress={() => setEditing('new')}><Ionicons name="add" size={25} color={colors.white} /></Pressable>
      </View>
      <Panel style={styles.summary}><Text style={styles.summaryValue}>{rewards.length}</Text><View><Text style={styles.cardTitle}>Active rewards</Text><Text style={styles.lead}>Changes appear instantly in the Hero’s store.</Text></View></Panel>
      {rewards.length === 0 ? <Panel style={styles.empty}><Text style={styles.emptyIcon}>🎁</Text><Text style={styles.cardTitle}>No rewards yet</Text><Pressable onPress={() => setEditing('new')}><Text style={styles.link}>Add the first reward</Text></Pressable></Panel> : rewards.map(reward =>
        <Panel key={reward.id} style={styles.rewardCard}>
          <View style={styles.emojiBox}><Text style={styles.emoji}>{reward.emoji}</Text></View>
          <View style={styles.copy}><Text style={styles.rewardTitle}>{reward.title}</Text><Text style={styles.lead}>{reward.subtitle}</Text><Text style={styles.cost}>⭐ {reward.cost} stars</Text></View>
          <View style={styles.actions}>
            <Pressable accessibilityLabel={`Edit ${reward.title}`} style={styles.iconButton} onPress={() => setEditing(reward)}><Ionicons name="create-outline" size={20} color={colors.navy} /></Pressable>
            <Pressable accessibilityLabel={`Remove ${reward.title}`} style={styles.iconButton} onPress={() => confirmRemove(reward)}><Ionicons name="trash-outline" size={19} color={colors.coral} /></Pressable>
          </View>
        </Panel>)}
    </ScrollView>
    <RewardEditor value={editing} onClose={() => setEditing(null)} onSave={reward => { onSave(reward); setEditing(null); }} />
  </>;
}

function RewardEditor({ value, onClose, onSave }: { value: Reward | 'new' | null; onClose: () => void; onSave: (reward: Reward) => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  useEffect(() => {
    if (!value || value === 'new') setDraft(emptyDraft);
    else setDraft({ title: value.title, subtitle: value.subtitle, emoji: value.emoji, cost: String(value.cost) });
  }, [value]);
  if (!value) return null;
  const update = (key: keyof Draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const submit = () => {
    const cost = Number.parseInt(draft.cost, 10);
    if (!draft.title.trim()) return Alert.alert('Reward name required', 'Give this reward a short name.');
    if (!Number.isInteger(cost) || cost < 1 || cost > 10000) return Alert.alert('Invalid star cost', 'Enter a whole number between 1 and 10,000.');
    onSave({ id: value === 'new' ? `reward-${Date.now()}` : value.id, title: draft.title.trim(), subtitle: draft.subtitle.trim() || 'A special Hero reward', emoji: draft.emoji.trim() || '🎁', cost });
  };
  return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modalSafe}>
    <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{value === 'new' ? 'New reward' : 'Edit reward'}</Text><Pressable onPress={submit}><Text style={styles.save}>Save</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Reward name"><TextInput value={draft.title} onChangeText={text => update('title', text)} placeholder="e.g. Choose movie night" style={styles.input} /></Field>
      <Field label="Description"><TextInput value={draft.subtitle} onChangeText={text => update('subtitle', text)} placeholder="What does the Hero receive?" multiline style={[styles.input, styles.multiline]} /></Field>
      <Field label="Icon"><EmojiPickerField value={draft.emoji} onSelect={emoji => update('emoji', emoji)} /></Field>
      <Field label="Star cost"><TextInput value={draft.cost} onChangeText={text => update('cost', text)} keyboardType="number-pad" style={styles.input} /></Field>
      <View style={styles.notice}><Ionicons name="star-outline" size={22} color={colors.green} /><Text style={styles.noticeText}>Heroes see this reward and its updated price immediately in the Star Store.</Text></View>
      <Pressable style={styles.primary} onPress={submit}><Text style={styles.primaryText}>{value === 'new' ? 'Add reward' : 'Save changes'}</Text></Pressable>
    </ScrollView>
  </SafeAreaView></Modal>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 110, gap: 14 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, pageTitle: { color: colors.navy, fontSize: 27, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 12, lineHeight: 18 }, addButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 13 }, summaryValue: { color: colors.green, fontSize: 30, fontWeight: '900' }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, emojiBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 27 }, copy: { flex: 1, gap: 2 }, rewardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, cost: { color: colors.green, fontWeight: '900', fontSize: 11, marginTop: 3 }, actions: { gap: 7 }, iconButton: { width: 35, height: 35, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 42 }, emptyIcon: { fontSize: 43 }, link: { color: colors.green, fontWeight: '900', marginTop: 10 }, modalSafe: { flex: 1, backgroundColor: colors.cream }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderColor: colors.border }, modalTitle: { color: colors.navy, fontSize: 17, fontWeight: '900' }, cancel: { color: colors.muted, fontWeight: '700' }, save: { color: colors.green, fontWeight: '900' }, form: { padding: 18, gap: 17 }, field: { gap: 7 }, label: { color: colors.navy, fontWeight: '800', fontSize: 12 }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, multiline: { minHeight: 88, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 12 }, iconField: { width: 84 }, costField: { flex: 1 }, notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#EAF3DD', alignItems: 'center' }, noticeText: { flex: 1, color: colors.green, fontSize: 12, lineHeight: 17, fontWeight: '700' }, primary: { backgroundColor: colors.green, borderRadius: 15, padding: 16, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '900' },
});
