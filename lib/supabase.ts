import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '../worker/src/types/db';
import { ENV } from './env';

// Supabase JS doesn't auto-detect storage in React Native, and during web
// static export there's no window/localStorage either, so pick explicitly:
// - native (iOS/Android): AsyncStorage
// - web client (browser):  window.localStorage
// - SSR / build:           in-memory shim (no persistence)
type SupabaseStorage = NonNullable<
  Parameters<typeof createClient>[2]
>['auth'] extends infer A
  ? A extends { storage?: infer S }
    ? S
    : never
  : never;

const memoryStorage: Record<string, string> = {};
const memoryAdapter: SupabaseStorage = {
  getItem: async (k) => memoryStorage[k] ?? null,
  setItem: async (k, v) => {
    memoryStorage[k] = v;
  },
  removeItem: async (k) => {
    delete memoryStorage[k];
  },
};

const storage: SupabaseStorage =
  Platform.OS === 'web'
    ? typeof window !== 'undefined' && window.localStorage
      ? (window.localStorage as unknown as SupabaseStorage)
      : memoryAdapter
    : (AsyncStorage as unknown as SupabaseStorage);

export const supabase = createClient<Database>(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
