import { ReactNode, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from './lib/supabase';
import { colors } from './theme';
import { AppFrame } from './components';
import { heroLoginEmail, isValidHeroPin, isValidHeroUsername, normalizeHeroUsername } from './managedHero';

type LoginRole = 'parent' | 'hero';
type Message = { tone: 'success' | 'error'; text: string } | null;

export function AuthScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 780;
  const [role, setRole] = useState<LoginRole>('parent');
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    if (result.error) return setMessage({ tone: 'error', text: friendlyAuthError(result.error.message, signup) });
    if (signup && !result.data.session) {
      setPassword(''); setConfirmPassword('');
      setMessage({ tone: 'success', text: `Party Leader account created. We sent a confirmation link to ${email.trim()}. Open it to verify your email, then sign in.` });
    }
  };
  const toggleSignup = () => { setSignup(value => !value); setPassword(''); setConfirmPassword(''); setMessage(null); };
  const forgotPassword = async () => {
    if (!supabase) return;
    if (!email.trim()) return setMessage({ tone: 'error', text: 'Enter your email address first, then choose “Forgot password?”.' });
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: confirmationRedirect() });
    setBusy(false);
    setMessage(error ? { tone: 'error', text: friendlyAuthError(error.message) } : { tone: 'success', text: `Password reset instructions were sent to ${email.trim()}.` });
  };

  return <SafeAreaView style={styles.safe}><AppFrame><ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
    <View style={[styles.authShell, !wide && styles.authShellStacked]}>
      <LinearGradient colors={[colors.navy, '#1D3D70', '#315A8D']} style={[styles.brandPanel, !wide && styles.brandPanelCompact]}>
        <View style={styles.brandOrbOne} /><View style={styles.brandOrbTwo} />
        <View style={styles.brandTop}><View style={styles.brandShield}><Ionicons name="shield-checkmark" size={31} color={colors.white} /></View><Text style={styles.authTitle}>HOME <Text style={styles.authTitleAccent}>HERO</Text></Text></View>
        <View style={styles.brandCopy}><Text style={[styles.brandHeadline, !wide && styles.brandHeadlineCompact]}>Build good habits together.</Text><Text style={styles.brandLead}>A calmer way to turn everyday responsibilities into confidence, teamwork, and small wins.</Text></View>
        {wide && <View style={styles.benefitList}>
          <BrandBenefit icon="sparkles-outline" text="Quests that build independence" />
          <BrandBenefit icon="people-outline" text="A shared rhythm for the whole family" />
          <BrandBenefit icon="trophy-outline" text="Rewards that celebrate real effort" />
        </View>}
        <View style={styles.brandFooter}><View style={styles.brandFooterLine} /><Text style={styles.brandFooterText}>STRONG HABITS · HAPPY HOMES</Text></View>
      </LinearGradient>

      <View style={[styles.authFormPanel, !wide && styles.authFormPanelStacked]}>
        <View style={styles.authFormHeader}><Text style={styles.authEyebrow}>{signup ? 'BEGIN YOUR ADVENTURE' : 'WELCOME BACK'}</Text><Text style={styles.authHeading}>{role === 'hero' ? 'Ready for your quests?' : signup ? 'Create your family hub' : 'Sign in to Home Hero'}</Text><Text style={styles.authCopy}>{role === 'hero' ? 'Use the username and PIN your Party Leader created.' : signup ? 'Set up your Party Leader account in a few moments.' : 'Manage quests, celebrate progress, and keep your family moving.'}</Text></View>

        <View style={styles.roleCards}>{(['parent', 'hero'] as const).map(item => {
          const active = role === item;
          return <Pressable key={item} disabled={busy} onPress={() => changeRole(item)} style={[styles.roleCard, active && styles.roleCardActive]}><View style={[styles.roleIcon, active && styles.roleIconActive]}><Ionicons name={item === 'parent' ? 'people-outline' : 'flash-outline'} size={18} color={active ? colors.white : colors.navy} /></View><View style={{ flex: 1 }}><Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{item === 'parent' ? 'Party Leader' : 'Hero'}</Text><Text style={[styles.roleDescription, active && styles.roleDescriptionActive]}>{item === 'parent' ? 'Manage the household' : 'Continue your quests'}</Text></View>{active && <Ionicons name="checkmark-circle" size={18} color={colors.gold} />}</Pressable>;
        })}</View>

        {message && <View accessibilityRole="alert" style={[styles.message, styles.authMessage, message.tone === 'success' ? styles.successMessage : styles.errorMessage]}><Ionicons name={message.tone === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={19} color={message.tone === 'success' ? '#315D1A' : '#9A3528'} /><Text style={[styles.messageText, styles.authMessageText, message.tone === 'success' ? styles.successText : styles.errorText]}>{message.text}</Text></View>}

        <View style={styles.fields}>
          {role === 'parent' ? <>
            {signup && <AuthField label="Display name" icon="person-outline"><TextInput editable={!busy} placeholder="How your Heroes will know you" placeholderTextColor="#9298A8" value={name} onChangeText={setName} style={styles.authInput} /></AuthField>}
            <AuthField label="Email address" icon="mail-outline"><TextInput editable={!busy} placeholder="you@example.com" placeholderTextColor="#9298A8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.authInput} /></AuthField>
            <AuthField label="Password" icon="lock-closed-outline" trailing={<PasswordToggle visible={showPassword} onPress={() => setShowPassword(value => !value)} />}><TextInput editable={!busy} placeholder={signup ? 'Choose a secure password' : 'Enter your password'} placeholderTextColor="#9298A8" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} style={styles.authInput} /></AuthField>
            {signup && <AuthField label="Confirm password" icon="shield-checkmark-outline" trailing={<PasswordToggle visible={showConfirmPassword} onPress={() => setShowConfirmPassword(value => !value)} />}><TextInput editable={!busy} placeholder="Enter it once more" placeholderTextColor="#9298A8" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} style={styles.authInput} /></AuthField>}
          </> : <>
            <AuthField label="Hero username" icon="person-circle-outline"><TextInput editable={!busy} placeholder="Your Hero username" placeholderTextColor="#9298A8" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={text => setUsername(text.toLowerCase().replace(/\s/g, ''))} style={styles.authInput} /></AuthField>
            <AuthField label="Six-digit PIN" icon="keypad-outline" trailing={<PasswordToggle visible={showPassword} onPress={() => setShowPassword(value => !value)} />}><TextInput editable={!busy} placeholder="••••••" placeholderTextColor="#9298A8" secureTextEntry={!showPassword} keyboardType="number-pad" maxLength={6} value={password} onChangeText={text => setPassword(text.replace(/\D/g, '').slice(0, 6))} style={styles.authInput} /></AuthField>
          </>}
        </View>

        {role === 'parent' && !signup && <Pressable disabled={busy} onPress={forgotPassword} style={styles.forgotButton}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={({ pressed }) => [styles.authPrimary, pressed && styles.authPrimaryPressed, busy && styles.primaryDisabled]}><Text style={styles.authPrimaryText}>{busy ? (signup ? 'Creating account…' : 'Signing in…') : role === 'hero' ? 'Enter Hero HQ' : signup ? 'Create account' : 'Sign in'}</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></Pressable>
        {role === 'parent' && <View style={styles.accountPrompt}><Text style={styles.accountPromptText}>{signup ? 'Already part of Home Hero?' : 'New to Home Hero?'}</Text><Pressable disabled={busy} onPress={toggleSignup}><Text style={styles.accountPromptLink}>{signup ? 'Sign in' : 'Create an account'}</Text></Pressable></View>}
        {role === 'hero' && <View style={styles.heroHelp}><Ionicons name="information-circle-outline" size={17} color={colors.muted} /><Text style={styles.heroHelpText}>Don’t know your username or PIN? Ask your Party Leader.</Text></View>}
      </View>
    </View>
  </ScrollView></AppFrame></SafeAreaView>;
}

function AuthField({ label, icon, trailing, children }: { label: string; icon: string; trailing?: ReactNode; children: ReactNode }) {
  return <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.fieldFrame}><Ionicons name={icon as never} size={19} color={colors.muted} />{children}{trailing}</View></View>;
}

function PasswordToggle({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={onPress} hitSlop={10} style={styles.passwordToggle}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} /></Pressable>;
}

function BrandBenefit({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.brandBenefit}><View style={styles.brandBenefitIcon}><Ionicons name={icon as never} size={17} color={colors.gold} /></View><Text style={styles.brandBenefitText}>{text}</Text></View>;
}

function friendlyAuthError(message: string, signup = false) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'We couldn’t sign you in. Check your email and password, then try again.';
  if (normalized.includes('already registered')) return 'An account already exists for this email. Try signing in instead.';
  if (normalized.includes('password') && signup) return 'Choose a stronger password with at least six characters.';
  if (normalized.includes('rate limit')) return 'Too many attempts. Wait a moment, then try again.';
  return message;
}

function confirmationRedirect() { if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin; return 'homehero://'; }

export function OnboardingScreen({ refresh, backendError }: { refresh: () => Promise<void>; backendError?: string | null }) {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
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
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <SafeAreaView style={styles.safe}><AppFrame><ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
    <View style={[styles.onboardingShell, !wide && styles.onboardingShellStacked]}>
      <LinearGradient colors={[colors.navy, '#1D3D70', '#315A8D']} style={[styles.onboardingGuide, !wide && styles.onboardingGuideCompact]}>
        <View style={styles.brandOrbOne} /><View style={styles.brandOrbTwo} />
        <View style={styles.brandTop}><View style={styles.brandShield}><Ionicons name="shield-checkmark" size={31} color={colors.white} /></View><Text style={styles.authTitle}>HOME <Text style={styles.authTitleAccent}>HERO</Text></Text></View>
        <View style={styles.onboardingGuideCopy}><Text style={styles.onboardingEyebrow}>YOUR FAMILY ADVENTURE</Text><Text style={[styles.onboardingGuideTitle, !wide && styles.onboardingGuideTitleCompact]}>A heroic home starts here.</Text><Text style={styles.brandLead}>Create your household, then invite your Heroes into a safe space built for encouragement and progress.</Text></View>
        {wide && <View style={styles.onboardingSteps}>
          <OnboardingStep number="1" title="Create your household" detail="Give your family hub a familiar name." active />
          <OnboardingStep number="2" title="Enrol your Heroes" detail="Create a username and PIN for each child." />
          <OnboardingStep number="3" title="Choose your quests" detail="Pick age-appropriate habits and rewards." />
        </View>}
      </LinearGradient>
      <View style={[styles.onboardingForm, !wide && styles.onboardingFormStacked]}>
        <View style={styles.onboardingFormHeader}><View style={styles.onboardingStepBadge}><Text style={styles.onboardingStepBadgeText}>STEP 1 OF 3</Text></View><Text style={styles.authHeading}>Create your household</Text><Text style={styles.authCopy}>This name will appear across your Party Leader dashboard and your Heroes’ accounts.</Text></View>
        {visibleMessage && <View accessibilityRole="alert" style={[styles.message, styles.authMessage, visibleMessage.tone === 'success' ? styles.successMessage : styles.errorMessage]}><Ionicons name={visibleMessage.tone === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={19} color={visibleMessage.tone === 'success' ? '#315D1A' : '#9A3528'} /><Text style={[styles.messageText, styles.authMessageText, visibleMessage.tone === 'success' ? styles.successText : styles.errorText]}>{visibleMessage.text}</Text></View>}
        <AuthField label="Household name" icon="home-outline"><TextInput editable={!busy} value={familyName} onChangeText={text => { setFamilyName(text); setMessage(null); }} autoCapitalize="words" placeholder="e.g. The Meresey Family" placeholderTextColor="#9298A8" onSubmitEditing={submit} style={styles.authInput} /></AuthField>
        <View style={styles.timezoneCard}><View style={styles.timezoneIcon}><Ionicons name="globe-outline" size={19} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.timezoneLabel}>YOUR LOCAL TIME ZONE</Text><Text style={styles.timezoneValue}>{timezone}</Text></View><Ionicons name="checkmark-circle" size={20} color={colors.green} /></View>
        <View style={styles.onboardingNotice}><Ionicons name="lock-closed-outline" size={18} color={colors.purple} /><Text style={styles.onboardingNoticeText}>Your household is private. Only Heroes you enrol can join it.</Text></View>
        <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={({ pressed }) => [styles.authPrimary, pressed && styles.authPrimaryPressed, busy && styles.primaryDisabled]}><Text style={styles.authPrimaryText}>{busy ? 'Creating household…' : 'Create household'}</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></Pressable>
        <Pressable disabled={busy} onPress={() => supabase?.auth.signOut()} style={styles.onboardingSignOut}><Ionicons name="log-out-outline" size={16} color={colors.muted} /><Text style={styles.onboardingSignOutText}>Sign out and use another account</Text></Pressable>
      </View>
    </View>
  </ScrollView></AppFrame></SafeAreaView>;
}

function OnboardingStep({ number, title, detail, active = false }: { number: string; title: string; detail: string; active?: boolean }) {
  return <View style={styles.onboardingStep}><View style={[styles.onboardingStepNumber, active && styles.onboardingStepNumberActive]}><Text style={[styles.onboardingStepNumberText, active && styles.onboardingStepNumberTextActive]}>{number}</Text></View><View style={{ flex: 1 }}><Text style={[styles.onboardingStepTitle, active && styles.onboardingStepTitleActive]}>{title}</Text><Text style={styles.onboardingStepDetail}>{detail}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  authPage: { flexGrow: 1, padding: 22, alignItems: 'center', justifyContent: 'center' },
  authShell: { width: '100%', maxWidth: 1040, minHeight: 650, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.white, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(17,36,73,.08)', shadowColor: colors.navy, shadowOffset: { width: 0, height: 18 }, shadowOpacity: .15, shadowRadius: 36, elevation: 7 },
  authShellStacked: { maxWidth: 560, minHeight: 0, flexDirection: 'column' },
  brandPanel: { flex: .92, padding: 42, justifyContent: 'space-between', overflow: 'hidden' },
  brandPanelCompact: { flex: 0, minHeight: 245, padding: 26 },
  brandOrbOne: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,.055)', right: -75, top: -70 },
  brandOrbTwo: { position: 'absolute', width: 185, height: 185, borderRadius: 93, borderWidth: 1, borderColor: 'rgba(243,182,31,.18)', left: -70, bottom: -65 },
  brandTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  brandShield: { width: 54, height: 60, borderRadius: 17, backgroundColor: colors.green, borderWidth: 3, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  authTitle: { color: colors.white, fontSize: 25, fontWeight: '900', letterSpacing: 1.8 },
  authTitleAccent: { color: '#A7D66D' },
  brandCopy: { maxWidth: 390, gap: 13 },
  brandHeadline: { color: colors.white, fontSize: 39, lineHeight: 46, fontWeight: '900', letterSpacing: -.8 },
  brandHeadlineCompact: { fontSize: 27, lineHeight: 33, marginTop: 24 },
  brandLead: { color: '#D7E3F2', fontSize: 14, lineHeight: 23, maxWidth: 380 },
  benefitList: { gap: 13 },
  brandBenefit: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandBenefitIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' },
  brandBenefitText: { color: '#EDF3FA', fontSize: 12, fontWeight: '700' },
  brandFooter: { gap: 9 },
  brandFooterLine: { width: 42, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  brandFooterText: { color: '#AFC1D9', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  authFormPanel: { flex: 1.08, paddingHorizontal: 50, paddingVertical: 42, justifyContent: 'center' },
  authFormPanelStacked: { flex: 0, paddingHorizontal: 24, paddingVertical: 31 },
  authFormHeader: { gap: 6, marginBottom: 20 },
  authEyebrow: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  authHeading: { color: colors.navy, fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -.4 },
  authCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, maxWidth: 440 },
  roleCards: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  roleCard: { flex: 1, minHeight: 67, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FAF9F5', flexDirection: 'row', alignItems: 'center', gap: 9 },
  roleCardActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  roleIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: '#E8EDF5', alignItems: 'center', justifyContent: 'center' },
  roleIconActive: { backgroundColor: 'rgba(255,255,255,.13)' },
  roleTitle: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  roleTitleActive: { color: colors.white },
  roleDescription: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  roleDescriptionActive: { color: '#CAD6E8' },
  fields: { gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  fieldFrame: { minHeight: 51, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 9 },
  authInput: { flex: 1, minWidth: 0, paddingVertical: 13, color: colors.ink, fontSize: 13, outlineStyle: 'none' } as object,
  passwordToggle: { padding: 4 },
  authPrimary: { minHeight: 52, marginTop: 15, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: .18, shadowRadius: 10, elevation: 3 },
  authPrimaryPressed: { transform: [{ translateY: 1 }], opacity: .92 },
  authPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 7 },
  forgotText: { color: colors.green, fontSize: 10, fontWeight: '800' },
  accountPrompt: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 16 },
  accountPromptText: { color: colors.muted, fontSize: 11 },
  accountPromptLink: { color: colors.green, fontSize: 11, fontWeight: '900' },
  heroHelp: { marginTop: 16, padding: 11, borderRadius: 12, backgroundColor: '#F4F1E9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  heroHelpText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  authMessage: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14 },
  authMessageText: { flex: 1 },
  onboardingShell: { width: '100%', maxWidth: 960, minHeight: 570, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.white, flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(17,36,73,.08)', shadowColor: colors.navy, shadowOffset: { width: 0, height: 18 }, shadowOpacity: .15, shadowRadius: 36, elevation: 7 },
  onboardingShellStacked: { maxWidth: 560, minHeight: 0, flexDirection: 'column' },
  onboardingGuide: { flex: .9, padding: 38, justifyContent: 'space-between', overflow: 'hidden' },
  onboardingGuideCompact: { flex: 0, minHeight: 250, padding: 26 },
  onboardingGuideCopy: { gap: 10, maxWidth: 360 },
  onboardingEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  onboardingGuideTitle: { color: colors.white, fontSize: 34, lineHeight: 41, fontWeight: '900', letterSpacing: -.6 },
  onboardingGuideTitleCompact: { fontSize: 27, lineHeight: 33 },
  onboardingSteps: { gap: 17 },
  onboardingStep: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  onboardingStepNumber: { width: 31, height: 31, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,.25)', backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  onboardingStepNumberActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  onboardingStepNumberText: { color: '#C4D1E3', fontSize: 11, fontWeight: '900' },
  onboardingStepNumberTextActive: { color: colors.navy },
  onboardingStepTitle: { color: '#D7E3F2', fontSize: 12, fontWeight: '800' },
  onboardingStepTitleActive: { color: colors.white },
  onboardingStepDetail: { color: '#AFC1D9', fontSize: 9, lineHeight: 14, marginTop: 2 },
  onboardingForm: { flex: 1.1, paddingHorizontal: 48, paddingVertical: 42, justifyContent: 'center' },
  onboardingFormStacked: { flex: 0, paddingHorizontal: 24, paddingVertical: 31 },
  onboardingFormHeader: { gap: 7, marginBottom: 23 },
  onboardingStepBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.greenSoft },
  onboardingStepBadgeText: { color: colors.green, fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  timezoneCard: { marginTop: 14, padding: 13, borderRadius: 14, backgroundColor: '#F8F7F2', borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timezoneIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  timezoneLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  timezoneValue: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 2 },
  onboardingNotice: { marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: '#F3EEFA', flexDirection: 'row', alignItems: 'center', gap: 9 },
  onboardingNoticeText: { flex: 1, color: colors.purple, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  onboardingSignOut: { marginTop: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  onboardingSignOutText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  onboard: { width: '100%', maxWidth: 620, alignSelf: 'center', flex: 1, padding: 28, justifyContent: 'center', alignItems: 'stretch', gap: 16 },
  shield: { fontSize: 58 },
  heading: { fontSize: 25, color: colors.navy, fontWeight: '900', textAlign: 'center' },
  copy: { color: colors.muted, textAlign: 'center', lineHeight: 19 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, fontSize: 15, color: colors.ink },
  primary: { backgroundColor: colors.green, borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryDisabled: { opacity: .65 },
  primaryText: { color: colors.white, fontWeight: '900' },
  message: { borderRadius: 14, borderWidth: 1, padding: 13 },
  successMessage: { backgroundColor: '#EAF5DF', borderColor: '#B9D998' },
  errorMessage: { backgroundColor: '#FCE9E6', borderColor: '#E6A69B' },
  messageText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  successText: { color: '#315D1A' },
  errorText: { color: '#9A3528' },
  link: { color: colors.green, textAlign: 'center', fontWeight: '800', padding: 8 },
});
