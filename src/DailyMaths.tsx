import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Panel, ProgressBar } from './components';
import { colors } from './theme';
import { MATHS_XP, mathsComplete, mathsSet, matchesMathsAnswer, QUESTIONS_PER_QUEST } from './maths';
import type { MathsAttempt, MathsResult } from './maths';
import type { HeroProfile } from './types';

function Action({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function MathsQuest({ initial, onRecord, onClose, onCompleted }: {
  initial: MathsAttempt;
  onRecord: (attempt: MathsAttempt, index: number, result: MathsResult) => Promise<MathsAttempt>;
  onClose: () => void; onCompleted: () => void;
}) {
  const [attempt, setAttempt] = useState(initial);
  const [input, setInput] = useState('');
  const [hint, setHint] = useState(false);
  const [incorrect, setIncorrect] = useState(false);
  const [feedback, setFeedback] = useState<{ index: number; result: MathsResult } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const set = mathsSet(attempt);
  const index = feedback?.index ?? attempt.results.length;
  const question = set?.questions[index];

  async function save(result: MathsResult) {
    if (!question || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const next = await onRecord(attempt, index, result);
      setAttempt(next);
      setFeedback({ index, result: next.results[index] });
      if (mathsComplete(next)) onCompleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your answer. Try again.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function check() {
    if (!question || !input.trim() || feedback || inFlight.current) return;
    if (matchesMathsAnswer(input, question.answers, question.options)) {
      void save(hint ? 'with_hint' : 'correct');
    } else {
      setIncorrect(true);
      setHint(true);
    }
  }

  function advance() {
    setFeedback(null);
    setInput('');
    setHint(false);
    setIncorrect(false);
  }

  return <Modal animationType="slide" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <View style={styles.row}><View style={styles.flex}>
          <Text style={styles.muted}>Grade {attempt.grade} · Daily Maths</Text>
          <Text style={styles.heading}>{set?.title ?? 'Daily Maths'}</Text>
        </View><Action label="Close" onPress={onClose} secondary /></View>
        <ProgressBar value={attempt.results.length} max={QUESTIONS_PER_QUEST} />
        {mathsComplete(attempt) && !feedback ? <Panel style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>Quest complete!</Text>
          <Text style={styles.body}>You earned {MATHS_XP} XP.</Text>
          <Text style={styles.muted}>{attempt.results.filter(result => result === 'correct').length} without hints · {attempt.results.filter(result => result === 'with_hint').length} with a hint · {attempt.results.filter(result => result === 'worked').length} worked examples</Text>
          <Action label="Back to Today" onPress={onClose} />
        </Panel> : question ? <Panel style={styles.card}>
          <Text style={styles.muted}>Question {index + 1} of {QUESTIONS_PER_QUEST}</Text>
          {question.context && <Text style={styles.muted}>{question.context}</Text>}
          <Text accessibilityRole="header" style={styles.body}>{question.prompt}</Text>
          {feedback ? <View accessibilityLiveRegion="polite" style={styles.card}>
            <Text style={styles.title}>{feedback.result === 'worked' ? 'Worked solution' : 'Correct!'}</Text>
            <Text style={styles.body}>{question.solution}</Text>
            <Action label={mathsComplete(attempt) ? 'See results' : 'Next question'} onPress={advance} />
          </View> : <>
            {question.options ? question.options.map(option => <Pressable accessibilityRole="radio" accessibilityState={{ checked: option === input }}
              key={option} disabled={saving} onPress={() => setInput(option)} style={[styles.choice, input === option && styles.selected]}>
              <Text style={styles.body}>{option}</Text>
            </Pressable>) : <>
              <Text style={styles.muted}>{question.answerPrompt}</Text>
              <TextInput accessibilityLabel="Your answer" style={styles.input} placeholder="Your answer" placeholderTextColor={colors.muted}
                editable={!saving} autoCapitalize="none" autoCorrect={false} maxLength={60} value={input} onChangeText={setInput}
                onSubmitEditing={check} />
            </>}
            {hint && <Text accessibilityLiveRegion="polite" style={styles.hint}>{incorrect ? 'Try again. ' : ''}{question.hint}</Text>}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Action label={saving ? 'Saving…' : 'Check answer'} disabled={saving || !input.trim()} onPress={check} />
            {hint
              ? <Action label="Show worked solution" onPress={() => void save('worked')} disabled={saving} secondary />
              : <Action label="Show hint" onPress={() => setHint(true)} disabled={saving} secondary />}
          </>}
        </Panel> : <Text style={styles.error}>This quest uses an older question bank. Update the app to continue.</Text>}
      </View>
    </ScrollView>
  </Modal>;
}

export function MathsGradeSettings({ heroes, onSave }: {
  heroes: HeroProfile[]; onSave: (heroId: string, grade: number | null) => Promise<void>;
}) {
  if (!heroes.length) return null;
  return <Panel style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Daily Maths</Text>
    <Text style={styles.muted}>Set each Hero’s school grade. Daily Maths is available for Grades 4–7.</Text>
    {heroes.map(hero => <GradeRow key={hero.id} hero={hero} onSave={onSave} />)}
  </Panel>;
}

function GradeRow({ hero, onSave }: { hero: HeroProfile; onSave: (heroId: string, grade: number | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  async function save() {
    if (inFlight.current) return;
    const clean = value.trim();
    if (clean && !/^(?:[1-9]|1[0-2])$/.test(clean)) {
      setError('Enter a school grade from 1 to 12.');
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(hero.id, clean ? Number(clean) : null);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this grade. Try again.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <View style={styles.gradeRow}>
    <View style={styles.row}><View style={styles.flex}>
      <Text style={styles.rowTitle}>{hero.displayName}</Text>
      <Text style={styles.muted}>{hero.schoolGrade ? `Grade ${hero.schoolGrade}` : 'Grade unset'}</Text>
    </View>
      {!editing && <Action label={hero.schoolGrade ? 'Edit grade' : 'Set grade'} secondary onPress={() => {
        setValue(hero.schoolGrade?.toString() ?? ''); setError(''); setEditing(true);
      }} />}
    </View>
    {editing && <>
      <TextInput accessibilityLabel={`School grade for ${hero.displayName}`} value={value} onChangeText={setValue}
        placeholder="Grade 1–12" placeholderTextColor={colors.muted} keyboardType="number-pad"
        style={styles.input} editable={!saving} maxLength={2} />
      <Text style={styles.muted}>Leave blank to clear the grade.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Action label={saving ? 'Saving…' : 'Save grade'} onPress={() => void save()} disabled={saving} />
        <Action label="Cancel" onPress={() => setEditing(false)} disabled={saving} secondary />
      </View>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  modal: { flexGrow: 1, alignItems: 'center', padding: 18, paddingTop: 44, paddingBottom: 48, backgroundColor: colors.cream },
  inner: { width: '100%', maxWidth: 600, gap: 18 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { gap: 12 },
  gradeRow: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  title: { fontSize: 18, fontWeight: '900', color: colors.navy },
  heading: { fontSize: 24, fontWeight: '900', color: colors.navy },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 18, color: colors.muted },
  hint: { color: colors.navy, backgroundColor: '#FFF3C9', padding: 12, borderRadius: 10, fontSize: 15, lineHeight: 22 },
  error: { color: '#98313C', fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, paddingHorizontal: 12, borderColor: colors.border, borderWidth: 1, borderRadius: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
  choice: { minHeight: 46, justifyContent: 'center', padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  selected: { borderColor: colors.green, backgroundColor: '#E6F4ED' },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.green, paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  secondary: { backgroundColor: '#E6ECF6' },
  secondaryText: { color: colors.navy },
  disabled: { opacity: 0.5 },
});
