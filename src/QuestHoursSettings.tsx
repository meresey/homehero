import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Panel } from './components';
import { colors } from './theme';
import { questWindowNames, scheduledWindows, validQuestHours } from './questWindows';
import type { QuestHours } from './questWindows';

export function QuestHoursSettings({ hours, timezone, onSave }: {
  hours: QuestHours; timezone: string; onSave: (hours: QuestHours) => Promise<void>;
}) {
  const [draft, setDraft] = useState<QuestHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (!draft || saving) return;
    if (!validQuestHours(draft)) {
      setError('Use 24-hour times like 07:30. Each closing time must be later on the same day.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save quest hours.');
    } finally {
      setSaving(false);
    }
  }

  return <Panel style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Quest hours</Text>
    <Text style={styles.label}>{timezone}{draft ? ' · Enter times in 24-hour format.' : ''}</Text>
    {scheduledWindows.map(window => <View key={window} style={styles.row}>
      <Text style={styles.name}>{questWindowNames[window]}</Text>
      {draft ? (['start', 'end'] as const).map(side =>
        <TextInput key={side} style={styles.input} accessibilityLabel={`${questWindowNames[window]} ${side} time`}
          value={draft[window][side]} maxLength={5} editable={!saving}
          onChangeText={value => setDraft({ ...draft, [window]: { ...draft[window], [side]: value } })} />)
        : <Text style={styles.label}>{hours[window].start}–{hours[window].end}</Text>}
    </View>)}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {draft ? <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={() => void save()} disabled={saving} style={styles.button}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save quest hours'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setDraft(null); setError(''); }} style={styles.secondary}>
        <Text style={styles.name}>Cancel</Text>
      </Pressable>
    </View> : <Pressable accessibilityRole="button" onPress={() => setDraft(hours)} style={styles.secondary}>
      <Text style={styles.name}>Edit quest hours</Text>
    </Pressable>}
  </Panel>;
}

const styles = StyleSheet.create({
  panel: { gap: 10 },
  heading: { color: colors.navy, fontSize: 17, fontWeight: '900' },
  label: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.navy, fontWeight: '800', flexGrow: 1 },
  input: { width: 68, minHeight: 44, borderColor: colors.border, borderWidth: 1, borderRadius: 8, textAlign: 'center', color: colors.ink },
  button: { minHeight: 44, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.green, paddingHorizontal: 12 },
  buttonText: { color: colors.white, fontWeight: '800' },
  secondary: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: colors.cream, paddingHorizontal: 12 },
  error: { color: '#98313C' },
});
