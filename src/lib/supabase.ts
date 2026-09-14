import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const env = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;
const url = env?.EXPO_PUBLIC_SUPABASE_URL;
const key = env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backendEnabled = Boolean(url && key);
export const supabase = backendEnabled ? createClient(url!, key!) : null;
