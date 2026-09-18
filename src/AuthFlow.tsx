import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from './lib/supabase';
import { colors } from './theme';
import { AppFrame } from './components';
import { heroLoginEmail, isValidHeroPin, isValidHeroUsername, normalizeHeroUsername } from './managedHero';

type LoginRole = 'parent' | 'hero';
type Message = { tone: 'success' | 'error'; text: string } | null;

export function AuthScreen() {
  const [role, setRole] = useState<LoginRole>('parent');
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const changeRole = (next: LoginRole) => { setRole(next); setSignup(false); setPassword(''); setConfirmPassword(''); setMessage(null); };
  const submit = async () => {
    if (!supabase) return setMessage({ tone: 'error', text: 'Home Hero could not connect to the server.' });
    if (role === 'hero') {
      const normalized = normalizeHeroUsername(username);
      if (!isValidHeroUsername(normalized)) return setMessage({ tone: 'error', text: 'Enter the username provided by your Party Leader.' });
      if (!isValidHeroPin(password)) return setMessage({ tone: 'error', text: 'Enter your six-digit PIN.' });
      setBusy(true); setMessage(null);
      const { error } = await supabase.auth.signInWithPassword({ email: heroLoginEmail(normalized), password });
      setBusy(false);
      if (error) setMessage({ tone: 'error', text: 'That username or PIN is incorrect.' });
      return;
    }
    if (!email.trim() || !password) return setMessage({ tone: 'error', text: 'Enter your email address and password.' });
    if (signup && !name.trim()) return setMessage({ tone: 'error', text: 'Enter your display name.' });
    if (signup && password !== confirmPassword) return setMessage({ tone: 'error', text: 'The passwords do not match.' });
    setBusy(true); setMessage(null);
    const result = signup
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: confirmationRedirect() } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) return setMessage({ tone: 'error', text: result.error.message });
    if (signup && !result.data.session) {
      setPassword(''); setConfirmPassword('');
      setMessage({ tone: 'success', text: `Party Leader account created. We sent a confirmation link to ${email.trim()}. Open it to verify your email, then sign in.` });
    }
  };
  const toggleSignup = () => { setSignup(value => !value); setPassword(''); setConfirmPassword(''); setMessage(null); };

  return <SafeAreaView style={styles.safe}><AppFrame>
    <LinearGradient colors={[colors.navy, '#294C7E']} style={styles.authHero}><Text style={styles.shield}>🛡️</Text><Text style={styles.authTitle}>HOME <Text style={{ color: '#A7D66D' }}>HERO</Text></Text><Text style={styles.authLead}>Strong habits today. Success tomorrow.</Text></LinearGradient>
    <View style={styles.form}>
      <Text style={styles.heading}>{role === 'hero' ? 'Hero sign in' : signup ? 'Create a Party Leader account' : 'Party Leader sign in'}</Text>
      <Text style={styles.copy}>{role === 'hero' ? 'Use the username and PIN your Party Leader created for you.' : 'Manage your family, quests, and rewards.'}</Text>
      <View style={styles.segment}>{(['parent', 'hero'] as const).map(item => <Pressable key={item} disabled={busy} onPress={() => changeRole(item)} style={[styles.segmentItem, role === item && styles.segmentActive]}><Text style={[styles.segmentText, role === item && styles.segmentTextActive]}>{item === 'parent' ? 'Party Leader' : 'Hero'}</Text></Pressable>)}</View>
      {message && <View accessibilityRole="alert" style={[styles.message, message.tone === 'success' ? styles.successMessage : styles.errorMessage]}><Text style={[styles.messageText, message.tone === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text></View>}
      {role === 'parent' ? <>{signup && <TextInput placeholder="Display name" value={name} onChangeText={setName} style={styles.input} />}<TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} /><TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />{signup && <TextInput placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} style={styles.input} />}</> : <><TextInput placeholder="Hero username" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={text => setUsername(text.toLowerCase().replace(/\s/g, ''))} style={styles.input} /><TextInput placeholder="Six-digit PIN" secureTextEntry keyboardType="number-pad" maxLength={6} value={password} onChangeText={text => setPassword(text.replace(/\D/g, '').slice(0, 6))} style={styles.input} /></>}
      <Pressable onPress={submit} disabled={busy} style={[styles.primary, busy && styles.primaryDisabled]}><Text style={styles.primaryText}>{busy ? (signup ? 'Creating account…' : 'Signing in…') : role === 'hero' ? 'Enter Hero HQ' : signup ? 'Create account' : 'Sign in'}</Text></Pressable>
      {role === 'parent' && <Pressable onPress={toggleSignup}><Text style={styles.link}>{signup ? 'Already have an account? Sign in' : 'New Party Leader? Create an account'}</Text></Pressable>}
      {role === 'hero' && <Text style={styles.help}>Don’t know your username or PIN? Ask your Party Leader.</Text>}
    </View>
  </AppFrame></SafeAreaView>;
}

function confirmationRedirect() { if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin; return 'homehero://'; }

export function OnboardingScreen({ refresh, backendError }: { refresh: () => Promise<void>; backendError?: string | null }) {
  const [familyName, setFamilyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const submit = async () => {
    if (!supabase) return setMessage({ tone: 'error', text: 'Home Hero could not connect to the server. Please reload and try again.' });
    if (!familyName.trim()) return setMessage({ tone: 'error', text: 'Enter a family name.' });
    setBusy(true); setMessage(null);
    try {
      const { error } = await supabase.rpc('create_parent_household', { p_name: familyName.trim(), p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (error) throw error;
      setMessage({ tone: 'success', text: 'Family created. Loading your Party Leader dashboard…' });
      await refresh();
    } catch (cause) { setMessage({ tone: 'error', text: cause instanceof Error ? cause.message : 'Could not create your family. Please try again.' }); }
    finally { setBusy(false); }
  };
  const visibleMessage = message ?? (backendError ? { tone: 'error' as const, text: backendError } : null);
  return <SafeAreaView style={styles.safe}><AppFrame><View style={styles.onboard}><Text style={styles.shield}>🛡️</Text><Text style={styles.heading}>Create your hero party</Text><Text style={styles.copy}>Start with your household. Once it’s ready, you’ll enroll each Hero with a username and PIN.</Text>{visibleMessage && <View accessibilityRole="alert" style={[styles.message, visibleMessage.tone === 'success' ? styles.successMessage : styles.errorMessage]}><Text style={[styles.messageText, visibleMessage.tone === 'success' ? styles.successText : styles.errorText]}>{visibleMessage.text}</Text></View>}<TextInput editable={!busy} value={familyName} onChangeText={text => { setFamilyName(text); setMessage(null); }} autoCapitalize="words" placeholder="Family name" style={styles.input} /><Pressable onPress={submit} disabled={busy} style={[styles.primary, busy && styles.primaryDisabled]}><Text style={styles.primaryText}>{busy ? 'Creating family…' : 'Create family'}</Text></Pressable><Pressable disabled={busy} onPress={() => supabase?.auth.signOut()}><Text style={styles.link}>Sign out</Text></Pressable></View></AppFrame></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.cream }, authHero: { padding: 38, paddingTop: 65, alignItems: 'center', borderBottomLeftRadius: 35, borderBottomRightRadius: 35 }, shield: { fontSize: 58 }, authTitle: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: 2 }, authLead: { color: '#DDE8F6', marginTop: 8 }, form: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 25, gap: 14 }, onboard: { width: '100%', maxWidth: 620, alignSelf: 'center', flex: 1, padding: 28, justifyContent: 'center', alignItems: 'stretch', gap: 16 }, heading: { fontSize: 25, color: colors.navy, fontWeight: '900', textAlign: 'center' }, copy: { color: colors.muted, textAlign: 'center', lineHeight: 19 }, help: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 17 }, input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, fontSize: 15, color: colors.ink }, primary: { backgroundColor: colors.green, borderRadius: 14, padding: 16, alignItems: 'center' }, primaryDisabled: { opacity: .65 }, primaryText: { color: colors.white, fontWeight: '900' }, message: { borderRadius: 14, borderWidth: 1, padding: 13 }, successMessage: { backgroundColor: '#EAF5DF', borderColor: '#B9D998' }, errorMessage: { backgroundColor: '#FCE9E6', borderColor: '#E6A69B' }, messageText: { fontSize: 12, lineHeight: 18, fontWeight: '700' }, successText: { color: '#315D1A' }, errorText: { color: '#9A3528' }, link: { color: colors.green, textAlign: 'center', fontWeight: '800', padding: 8 }, segment: { flexDirection: 'row', backgroundColor: '#E7E2D7', padding: 4, borderRadius: 14 }, segmentItem: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 11 }, segmentActive: { backgroundColor: colors.navy }, segmentText: { color: colors.muted, fontWeight: '800' }, segmentTextActive: { color: colors.white } });
