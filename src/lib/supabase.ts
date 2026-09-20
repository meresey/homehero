import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Expo replaces direct EXPO_PUBLIC_* references when it creates the web/native bundle.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY;
const useSupabase = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';

// Core-feature development runs locally by default. Re-enable the backend only
// when the explicit flag is set as well as the public project settings.
export const backendEnabled = Boolean(useSupabase && url && key);
export const supabase = backendEnabled ? createClient(url!, key!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
}) : null;
