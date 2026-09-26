import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from './theme';

const emojiGroups = [
  { title: 'Popular', emojis: ['⭐', '✨', '🎁', '🏆', '🎉', '❤️', '🔥', '✅'] },
  { title: 'Chores', emojis: ['🛏️', '🧹', '🧺', '🗑️', '🍽️', '🧽', '🧼', '🪴'] },
  { title: 'Learning', emojis: ['📚', '📖', '✏️', '🧠', '🎨', '🔬', '💡', '🎓'] },
  { title: 'Activities', emojis: ['⚽', '🏀', '🚲', '🌳', '🎵', '🏊', '🎲', '🧩'] },
  { title: 'Rewards', emojis: ['🎮', '🍦', '🍕', '🍿', '🎬', '🎟️', '🧸', '🛍️'] },
  { title: 'Family', emojis: ['🤝', '👨‍👩‍👧‍👦', '🏠', '🍳', '🥳', '💜', '🌈', '🦸'] },
];

export function EmojiPickerField({ value, onSelect }: { value: string; onSelect: (emoji: string) => void }) {
  const [visible, setVisible] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose icon, currently ${value}`} onPress={() => setVisible(true)} style={styles.field}>
      <Text style={styles.selectedEmoji}>{value}</Text>
      <View style={styles.fieldCopy}><Text style={styles.fieldTitle}>Choose icon</Text><Text style={styles.fieldHint}>Tap to browse emojis</Text></View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
    <EmojiPicker visible={visible} value={value} onClose={() => setVisible(false)} onSelect={emoji => { onSelect(emoji); setVisible(false); }} />
  </>;
}

function EmojiPicker({ visible, value, onSelect, onClose }: { visible: boolean; value: string; onSelect: (emoji: string) => void; onClose: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <Pressable accessibilityLabel="Close emoji picker" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}><View><Text style={styles.title}>Choose an icon</Text><Text style={styles.subtitle}>Pick an emoji for this item</Text></View><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.navy} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.groups} showsVerticalScrollIndicator={false}>
          {emojiGroups.map(group => <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.grid}>{group.emojis.map(emoji => <Pressable key={emoji} accessibilityLabel={`Select ${emoji}`} onPress={() => onSelect(emoji)} style={[styles.emojiButton, value === emoji && styles.emojiSelected]}><Text style={styles.emoji}>{emoji}</Text>{value === emoji && <View style={styles.check}><Ionicons name="checkmark" size={11} color={colors.white} /></View>}</Pressable>)}</View>
          </View>)}
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  field: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }, selectedEmoji: { fontSize: 30 }, fieldCopy: { flex: 1 }, fieldTitle: { color: colors.navy, fontSize: 13, fontWeight: '900' }, fieldHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 30, 58, 0.45)' }, sheet: { maxHeight: '82%', backgroundColor: colors.cream, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, title: { color: colors.navy, fontSize: 21, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 }, close: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, groups: { padding: 18, paddingBottom: 36, gap: 20 }, group: { gap: 10 }, groupTitle: { color: colors.navy, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, emojiButton: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, emojiSelected: { borderColor: colors.green, borderWidth: 2, backgroundColor: '#F0F7E7' }, emoji: { fontSize: 27 }, check: { position: 'absolute', right: -3, top: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
