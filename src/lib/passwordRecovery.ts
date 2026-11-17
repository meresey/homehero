import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

const storageKey = 'homehero.password-recovery';
let recoveryUser: string | null = null;
try {
  recoveryUser = typeof window === 'undefined' ? null : window.sessionStorage.getItem(storageKey);
} catch {
  // Password recovery still works when browser storage is restricted.
}

const callback = typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.slice(1));
const recoveryLink = callback?.get('type') === 'recovery';
const expiredEmailLink = callback?.get('error_code') === 'otp_expired';
const native = Platform.OS !== 'web';
type RecoveryState = 'idle' | 'checking' | 'ready' | 'invalid' | 'complete';
let state: RecoveryState = !supabase ? 'idle' : expiredEmailLink ? 'invalid'
  : recoveryLink || recoveryUser || native ? 'checking' : 'idle';
const listeners = new Set<() => void>();

function setState(next: RecoveryState) {
  state = next;
  listeners.forEach(listener => listener());
}

function remember(userId: string | null) {
  recoveryUser = userId;
  try {
    if (typeof window === 'undefined') return;
    if (userId) window.sessionStorage.setItem(storageKey, userId);
    else window.sessionStorage.removeItem(storageKey);
  } catch {
    // The in-memory state is enough until this page is refreshed.
  }
}

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      remember(session.user.id);
      setState('ready');
    } else if (event === 'INITIAL_SESSION' && state === 'checking' && !recoveryLink && !native) {
      if (recoveryUser === session?.user.id) setState('ready');
      else {
        remember(null);
        setState('invalid');
      }
    } else if (event === 'SIGNED_OUT' && state === 'ready') {
      remember(null);
      setState('invalid');
    } else if (state === 'ready' && session && session.user.id !== recoveryUser) {
      remember(null);
      setState('invalid');
    }
  });

  if (native) {
    const auth = supabase.auth;
    async function followLink(url: string | null) {
      if (!url?.startsWith('homehero://')) return false;
      const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
      if (params.get('type') !== 'recovery') return false;
      setState('checking');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) {
        setState('invalid');
        return true;
      }
      const { data, error } = await auth.setSession({ access_token, refresh_token });
      if (error || !data.session) setState('invalid');
      else {
        remember(data.session.user.id);
        setState('ready');
      }
      return true;
    }
    Linking.addEventListener('url', ({ url }) => { void followLink(url); });
    void Linking.getInitialURL().then(followLink).then(handled => {
      if (!handled && state === 'checking') setState('idle');
    }).catch(() => { if (state === 'checking') setState('idle'); });
  }

  if (recoveryLink) {
    void supabase.auth.initialize().then(({ error }) => {
      if ((error || !callback?.has('access_token')) && state === 'checking') setState('invalid');
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function usePasswordRecovery() {
  return useSyncExternalStore<RecoveryState>(subscribe, () => state, () => 'idle');
}

export async function resetRecoveredPassword(password: string) {
  if (!supabase || state !== 'ready' || !recoveryUser) throw new Error('Request a new password reset link.');
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== recoveryUser) {
    setState('invalid');
    throw new Error('Request a new password reset link.');
  }
  const update = await supabase.auth.updateUser({ password });
  if (update.error) throw update.error;
  await leavePasswordRecovery();
  setState('complete');
}

export async function leavePasswordRecovery() {
  if (recoveryUser && supabase) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  remember(null);
  if (typeof window !== 'undefined' && (recoveryLink || expiredEmailLink) && window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  setState('idle');
}
