import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Panel } from './components';
import { supabase } from './lib/supabase';
import { colors } from './theme';

type Leader = { user_id: string; display_name: string; email: string; is_owner: boolean; joined_at: string };
type Invitation = { id: string; invited_email: string; created_at: string; expires_at: string };

export function PartyLeaders({ householdId, currentUserId }: { householdId: string; currentUserId: string }) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Leader | null>(null);
  const isOwner = leaders.some(leader => leader.user_id === currentUserId && leader.is_owner);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: loadError } = await supabase.rpc('list_household_party_leaders', { p_household_id: householdId });
    if (loadError) { setError(loadError.message); return; }
    const nextLeaders = (data ?? []) as Leader[];
    setLeaders(nextLeaders);
    if (nextLeaders.some(leader => leader.user_id === currentUserId && leader.is_owner)) {
      const { data: pending, error: pendingError } = await supabase.rpc('list_parent_invitations', { p_household_id: householdId });
      if (pendingError) setError(pendingError.message);
      else setInvitations((pending ?? []) as Invitation[]);
    }
  }, [householdId, currentUserId]);

  useEffect(() => { void load(); }, [load]);

  const invite = async () => {
    if (!supabase || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true); setError(null); setNewCode(null);
    const { data, error: inviteError } = await supabase.rpc('create_parent_invitation', { p_household_id: householdId, p_email: email.trim() });
    setBusy(false);
    if (inviteError) { setError(inviteError.message); return; }
    setNewCode(data as string);
    setEmail('');
    await load();
  };

  const revoke = async (id: string) => {
    if (!supabase || busy) return;
    setBusy(true); setError(null);
    const { error: revokeError } = await supabase.rpc('revoke_parent_invitation', { p_invitation_id: id });
    setBusy(false);
    if (revokeError) setError(revokeError.message);
    else { setNewCode(null); await load(); }
  };

  const remove = async () => {
    if (!supabase || busy || !confirmRemove) return;
    setBusy(true); setError(null);
    const { error: removeError } = await supabase.rpc('remove_household_party_leader', { p_household_id: householdId, p_user_id: confirmRemove.user_id });
    setBusy(false); setConfirmRemove(null);
    if (removeError) setError(removeError.message);
    else await load();
  };

  const copyCode = async () => {
    if (newCode && typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(newCode); }
      catch { setError('Could not copy automatically. Select the code below to copy it.'); }
    }
  };

  return <Panel>
    <View style={styles.header}><View style={styles.headerIcon}><Ionicons name="people-outline" size={21} color={colors.navy} /></View><View style={styles.headerCopy}><Text style={styles.title}>Party Leaders</Text><Text style={styles.description}>Adults who can manage your household, Heroes, quests, and rewards.</Text></View></View>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {leaders.map(leader => <View key={leader.user_id} style={styles.row}><View style={styles.leaderCopy}><Text style={styles.name}>{leader.display_name} {leader.is_owner ? '· Owner' : ''}{leader.user_id === currentUserId ? ' · You' : ''}</Text><Text style={styles.subtle}>{leader.email}</Text></View>{isOwner && !leader.is_owner && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${leader.display_name}`} onPress={() => setConfirmRemove(leader)} style={styles.textButton}><Text style={styles.danger}>Remove</Text></Pressable>}</View>)}
    {isOwner && <>
      <Text style={styles.sectionTitle}>Invite another Party Leader</Text>
      <Text style={styles.subtle}>Create a one-time code for their email address. They must sign in with that verified email to join. The code expires in 7 days.</Text>
      <View style={styles.inviteForm}><TextInput accessibilityLabel="Invitee email address" editable={!busy} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} placeholder="another.adult@example.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={styles.input} /><Pressable accessibilityRole="button" disabled={busy} onPress={invite} style={[styles.primaryButton, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Working…' : 'Create invite'}</Text></Pressable></View>
      {newCode && <View style={styles.codeBox}><Text style={styles.codeLabel}>SHARE THIS CODE PRIVATELY — SHOWN ONLY ONCE</Text><Text selectable style={styles.code}>{newCode}</Text><Pressable accessibilityRole="button" onPress={copyCode}><Text style={styles.link}>Copy code</Text></Pressable></View>}
      {invitations.length > 0 && <View style={styles.pending}><Text style={styles.sectionTitle}>Pending invitations</Text>{invitations.map(invitation => <View key={invitation.id} style={styles.row}><View style={styles.leaderCopy}><Text style={styles.name}>{invitation.invited_email}</Text><Text style={styles.subtle}>Expires {new Date(invitation.expires_at).toLocaleDateString()}</Text></View><Pressable accessibilityRole="button" onPress={() => revoke(invitation.id)} disabled={busy} style={styles.textButton}><Text style={styles.danger}>Revoke</Text></Pressable></View>)}</View>}
    </>}
    {confirmRemove && <View style={styles.confirmBox}><Text style={styles.name}>Remove {confirmRemove.display_name}?</Text><Text style={styles.subtle}>They will lose access to this household. Their account and past activity remain intact.</Text><View style={styles.confirmActions}><Pressable onPress={() => setConfirmRemove(null)} disabled={busy} style={styles.textButton}><Text style={styles.link}>Cancel</Text></Pressable><Pressable onPress={remove} disabled={busy} style={styles.textButton}><Text style={styles.danger}>Yes, remove</Text></Pressable></View></View>}
  </Panel>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EDF2FA', justifyContent: 'center', alignItems: 'center' },
  headerCopy: { flex: 1 }, title: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  description: { color: colors.muted, marginTop: 2, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EDE9E0', paddingVertical: 12, gap: 8 },
  leaderCopy: { flex: 1 }, name: { color: colors.navy, fontWeight: '700', fontSize: 15 }, subtle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.navy, fontSize: 16, fontWeight: '800', marginTop: 17, marginBottom: 5 },
  inviteForm: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  input: { flexGrow: 1, minWidth: 205, borderWidth: 1, borderColor: '#DDD8CE', backgroundColor: colors.white, color: colors.navy, borderRadius: 12, paddingHorizontal: 14, height: 45 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 16, height: 45, justifyContent: 'center' }, primaryText: { color: colors.white, fontWeight: '800' }, disabled: { opacity: .55 },
  codeBox: { marginTop: 13, padding: 15, borderRadius: 13, backgroundColor: '#FFF7DD', gap: 8 }, codeLabel: { color: '#85600A', fontSize: 11, fontWeight: '800' }, code: { color: colors.navy, fontWeight: '800', fontSize: 17, letterSpacing: 1 }, link: { color: colors.green, fontWeight: '800' },
  pending: { marginTop: 4 }, textButton: { padding: 8 }, danger: { color: '#9A3528', fontWeight: '800' },
  error: { color: '#9A3528', backgroundColor: '#FFF0EF', padding: 10, borderRadius: 9, marginBottom: 8 },
  confirmBox: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F2C6C0', backgroundColor: '#FFF7F5', padding: 14, gap: 4 }, confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 7 },
});
