import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Panel, ProgressBar } from './components';
import type { ReadingStory } from './reading';
import { colors } from './theme';

export type ReadingProgress = { storyId: string; scene: 'story' | 'questions'; answered: number };

export function ReadingQuest({ story, progress, timerEndsAt, onProgress, onSubmit, onClose }: {
  story: ReadingStory;
  progress: ReadingProgress;
  timerEndsAt?: string;
  onProgress: (progress: ReadingProgress) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  const [showStory, setShowStory] = useState(progress.scene === 'story');
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'retry' | 'correct' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const submitting = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const question = story.questions[progress.answered];
  const remaining = timerEndsAt ? Math.max(0, Math.ceil((Date.parse(timerEndsAt) - now) / 1000)) : 0;

  useEffect(() => {
    if (!timerEndsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [timerEndsAt]);

  function nextQuestion() {
    onProgress({ ...progress, answered: progress.answered + 1 });
    setChoice(null);
    setFeedback(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await onSubmit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit this quest. Try again.');
      submitting.current = false;
      setSaving(false);
    }
  }

  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.label}>Reading Adventure</Text>
              <Text accessibilityRole="header" style={styles.title}>{story.title}</Text>
            </View>
            <ReadingButton title="Close" onPress={onClose} secondary disabled={saving} />
          </View>
          {remaining > 0 && <Text style={styles.label}>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} left on your reading timer
          </Text>}
          {showStory ? <Panel style={styles.panel}>
            {story.paragraphs.map(paragraph => <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
            <ReadingButton title={progress.scene === 'story' ? 'Start questions' : 'Back to questions'} onPress={() => {
              onProgress({ ...progress, scene: 'questions' });
              setShowStory(false);
              scroll.current?.scrollTo({ y: 0, animated: false });
            }} />
          </Panel> : <>
            <ProgressBar value={progress.answered} max={story.questions.length} />
            {question ? <Panel style={styles.panel}>
              <Text style={styles.label}>Question {progress.answered + 1} of {story.questions.length}</Text>
              <Text accessibilityRole="header" style={styles.prompt}>{question.prompt}</Text>
              {question.options.map((option, index) => <Pressable key={option} accessibilityRole="radio"
                accessibilityState={{ checked: choice === index }} disabled={feedback === 'correct'} onPress={() => setChoice(index)}
                style={[styles.option, choice === index && styles.selected]}>
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>)}
              {feedback === 'retry' && <Text accessibilityLiveRegion="polite" style={styles.hint}>Try again. {question.hint}</Text>}
              {feedback === 'correct' && <Text accessibilityLiveRegion="polite" style={styles.correct}>Correct!</Text>}
              {feedback === 'correct'
                ? <ReadingButton title="Continue" onPress={nextQuestion} />
                : <ReadingButton title="Check answer" disabled={choice === null} onPress={() => setFeedback(choice === question.answer ? 'correct' : 'retry')} />}
              <ReadingButton title="Reread the story" onPress={() => {
                setShowStory(true);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }} secondary />
            </Panel> : <Panel style={styles.panel}>
              <Text accessibilityRole="header" style={styles.prompt}>You answered all {story.questions.length} questions!</Text>
              {remaining > 0 && <Text style={styles.label}>You can submit for approval when the reading timer ends.</Text>}
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <ReadingButton title={saving ? 'Submitting…' : 'Submit for approval'} disabled={saving || remaining > 0} onPress={() => void submit()} />
              <ReadingButton title="Reread the story" disabled={saving} onPress={() => {
                setShowStory(true);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }} secondary />
            </Panel>}
          </>}
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function ReadingButton({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { alignItems: 'center', padding: 18, paddingTop: 28, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: 620, gap: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
  panel: { gap: 16 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '900', color: colors.navy },
  label: { fontSize: 14, lineHeight: 20, color: colors.muted },
  paragraph: { fontSize: 18, lineHeight: 29, color: colors.ink },
  prompt: { fontSize: 19, lineHeight: 26, fontWeight: '800', color: colors.ink },
  option: { minHeight: 48, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  selected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  optionText: { fontSize: 16, lineHeight: 22, color: colors.ink },
  hint: { backgroundColor: '#FFF3C9', borderRadius: 10, padding: 12, color: colors.navy, lineHeight: 21 },
  correct: { color: colors.green, fontWeight: '800' },
  error: { color: '#98313C', lineHeight: 21 },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.green },
  secondary: { backgroundColor: '#E6ECF6' },
  buttonText: { fontWeight: '800', color: colors.white, fontSize: 14 },
  secondaryText: { color: colors.navy },
  disabled: { opacity: 0.5 },
});
