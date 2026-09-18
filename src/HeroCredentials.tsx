import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { isValidHeroPin, isValidHeroUsername, normalizeHeroUsername } from './managedHero';
import { ManagedHeroAccount } from './useHomeHeroData';
import { colors } from './theme';

export function HeroCredentialsModal({ hero, onClose, onSaved }: { hero: ManagedHeroAccount | null; onClose: () => void; onSaved: (username: string, pinChanged: boolean) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (hero) { setUsername(hero.username); setPin(''); setConfirmPin(''); setError(null); } }, [hero]);

  const submit = async () => {
    if (!hero || !supabase) return;
    const normalized = normalizeHeroUsername(username);
    if (!isValidHeroUsername(normalized)) return setError('Username must be 3–20 characters, start with a letter, and use only letters, numbers, or underscores.');
    if (pin && !isValidHeroPin(pin)) return setError('The new PIN must contain exactly six digits.');
    if (pin !== confirmPin) return setError('The PINs do not match.');
    if (normalized === hero.username && !pin) return setError('Change the username or enter a new PIN before saving.');

    setBusy(true); setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('manage-hero-credentials', { body: { userId: hero.userId, username: normalized, pin: pin || null } });
      if (functionError) throw new Error(await functionErrorMessage(functionError));
      if (data?.error) throw new Error(data.error);
      onClose();
      await onSaved(normalized, Boolean(pin));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this Hero’s login.'); }
    finally { setBusy(false); }
  };

  return <Modal visible={Boolean(hero)} animationType="slide" transparent onRequestClose={busy ? undefined : onClose}>
    <SafeAreaView style={styles.backdrop}><View style={styles.sheet}>
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>Manage {hero?.displayName}’s login</Text><Text style={styles.lead}>Change the username, reset the PIN, or do both.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.navy} /></Pressable></View>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
        <Field label="Hero username"><TextInput editable={!busy} value={username} onChangeText={text => setUsername(text.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} style={styles.input} /><Text style={styles.hint}>Changing this changes the username the Hero enters at sign-in.</Text></Field>
        <View style={styles.pinRow}><Field label="New six-digit PIN" style={styles.pinField}><TextInput editable={!busy} value={pin} onChangeText={text => setPin(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Leave blank to keep" style={styles.input} /></Field><Field label="Confirm new PIN" style={styles.pinField}><TextInput editable={!busy} value={confirmPin} onChangeText={text => setConfirmPin(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Repeat new PIN" style={styles.input} /></Field></View>
        <View style={styles.notice}><Text style={styles.noticeIcon}>🔐</Text><Text style={styles.noticeText}>Home Hero cannot display the current PIN. A reset replaces it with the new PIN you enter here.</Text></View>
        <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.primary, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Save login changes</Text>}</Pressable>
      </ScrollView>
    </View></SafeAreaView>
  </Modal>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) { return <View style={[styles.field, style]}><Text style={styles.label}>{label}</Text>{children}</View>; }
async function functionErrorMessage(error: any) { try { const payload = await error.context?.json(); return payload?.error ?? error.message; } catch { return error.message ?? 'Could not update this Hero’s login.'; } }

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,31,64,.55)', justifyContent: 'center', padding: 18 }, sheet: { width: '100%', maxWidth: 620, maxHeight: '92%', alignSelf: 'center', backgroundColor: colors.cream, borderRadius: 24, overflow: 'hidden' }, header: { padding: 20, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, title: { color: colors.navy, fontSize: 23, fontWeight: '900' }, lead: { color: colors.muted, fontSize: 12, marginTop: 4 }, close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, form: { padding: 20, gap: 15 }, field: { gap: 6 }, label: { color: colors.ink, fontSize: 12, fontWeight: '900' }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 14, fontSize: 15, color: colors.ink }, hint: { color: colors.muted, fontSize: 10, lineHeight: 15 }, pinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, pinField: { flex: 1, minWidth: 180 }, notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 13, backgroundColor: '#EAF3DD' }, noticeIcon: { fontSize: 21 }, noticeText: { flex: 1, color: '#315D1A', fontSize: 11, lineHeight: 16, fontWeight: '700' }, primary: { minHeight: 50, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .6 }, primaryText: { color: colors.white, fontWeight: '900' }, error: { borderRadius: 13, borderWidth: 1, padding: 12, backgroundColor: '#FCE9E6', borderColor: '#E6A69B' }, errorText: { color: '#9A3528', fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
