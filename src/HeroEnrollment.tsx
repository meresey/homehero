import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { isValidHeroPin, isValidHeroUsername, normalizeHeroUsername } from './managedHero';
import { colors } from './theme';

type Message = { tone: 'success' | 'error'; text: string } | null;

export function HeroEnrollmentModal({ visible, onClose, onEnrolled }: { visible: boolean; onClose: () => void; onEnrolled: (displayName: string, username: string) => Promise<void> }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    if (!visible) return;
    setDisplayName(''); setUsername(''); setBirthDate(''); setPin(''); setConfirmPin(''); setMessage(null);
  }, [visible]);

  const submit = async () => {
    const normalizedUsername = normalizeHeroUsername(username);
    if (!displayName.trim()) return setMessage({ tone: 'error', text: 'Enter the Hero’s display name.' });
    if (!isValidHeroUsername(normalizedUsername)) return setMessage({ tone: 'error', text: 'Username must be 3–20 characters, start with a letter, and use only letters, numbers, or underscores.' });
    if (!isValidBirthDate(birthDate)) return setMessage({ tone: 'error', text: 'Enter a valid birth date. Heroes must be between 3 and 18 years old.' });
    if (!isValidHeroPin(pin)) return setMessage({ tone: 'error', text: 'Choose a six-digit PIN.' });
    if (pin !== confirmPin) return setMessage({ tone: 'error', text: 'The PINs do not match.' });
    if (!supabase) return setMessage({ tone: 'error', text: 'Home Hero could not connect to the server.' });

    setBusy(true); setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('enroll-hero', { body: { displayName: displayName.trim(), username: normalizedUsername, dateOfBirth: birthDate, pin } });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      onClose();
      await onEnrolled(displayName.trim(), normalizedUsername);
    } catch (cause) {
      setMessage({ tone: 'error', text: cause instanceof Error ? cause.message : 'Could not enroll this Hero. Please try again.' });
    } finally { setBusy(false); }
  };

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={busy ? undefined : onClose}>
    <SafeAreaView style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}><View><Text style={styles.title}>Enroll a Hero</Text><Text style={styles.lead}>Create the username and PIN they’ll use to sign in.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.navy} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {message && <View accessibilityRole="alert" style={[styles.message, message.tone === 'success' ? styles.successMessage : styles.errorMessage]}><Text style={[styles.messageText, message.tone === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text></View>}
          <Field label="Hero name"><TextInput editable={!busy} value={displayName} onChangeText={setDisplayName} autoCapitalize="words" placeholder="e.g. Alex" style={styles.input} /></Field>
          <Field label="Username"><TextInput editable={!busy} value={username} onChangeText={text => setUsername(text.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} placeholder="e.g. alex_hero" style={styles.input} /><Text style={styles.hint}>3–20 characters. Start with a letter; use letters, numbers, or underscores.</Text></Field>
          <Field label="Birth date"><TextInput editable={!busy} value={birthDate} onChangeText={setBirthDate} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" style={styles.input} /><Text style={styles.hint}>Used to show age-appropriate quests.</Text></Field>
          <View style={styles.pinRow}><Field label="Six-digit PIN" style={styles.pinField}><TextInput editable={!busy} value={pin} onChangeText={text => setPin(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" style={styles.input} /></Field><Field label="Confirm PIN" style={styles.pinField}><TextInput editable={!busy} value={confirmPin} onChangeText={text => setConfirmPin(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" style={styles.input} /></Field></View>
          <View style={styles.notice}><Text style={styles.noticeIcon}>🛡️</Text><Text style={styles.noticeText}>Keep these credentials somewhere safe. The Hero does not need an email address.</Text></View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Enroll Hero</Text>}</Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }

function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const now = new Date(); let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) age -= 1;
  return age >= 3 && age <= 18;
}

async function functionErrorMessage(error: any) {
  try { const payload = await error.context?.json(); return payload?.error ?? error.message; } catch { return error.message ?? 'Could not enroll this Hero.'; }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,31,64,.55)', justifyContent: 'center', padding: 18 }, sheet: { width: '100%', maxWidth: 620, maxHeight: '92%', alignSelf: 'center', backgroundColor: colors.cream, borderRadius: 24, overflow: 'hidden' }, header: { padding: 20, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, title: { color: colors.navy, fontSize: 24, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 12, marginTop: 4 }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, form: { padding: 20, gap: 15 }, field: { gap: 6 }, label: { color: colors.ink, fontSize: 12, fontWeight: '900' }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, fontSize: 15, color: colors.ink }, hint: { color: colors.muted, fontSize: 10, lineHeight: 15 }, pinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, pinField: { flex: 1, minWidth: 180 }, notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 13, backgroundColor: '#EAF3DD' }, noticeIcon: { fontSize: 21 }, noticeText: { flex: 1, color: '#315D1A', fontSize: 11, lineHeight: 16, fontWeight: '700' }, primary: { minHeight: 50, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .6 }, primaryText: { color: colors.white, fontWeight: '900' }, secondary: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.navy, fontWeight: '900' }, message: { borderRadius: 13, borderWidth: 1, padding: 12 }, successMessage: { backgroundColor: '#EAF5DF', borderColor: '#B9D998' }, errorMessage: { backgroundColor: '#FCE9E6', borderColor: '#E6A69B' }, messageText: { fontSize: 12, lineHeight: 18, fontWeight: '700' }, successText: { color: '#315D1A' }, errorText: { color: '#9A3528' },
});
