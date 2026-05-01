// Reads EXPO_PUBLIC_* env vars set by Expo at bundle time.
// Both `_KEY` and `_ANON_KEY` accepted for Supabase, since `.env.example`
// uses `_ANON_KEY` but the user's `.env.local` uses `_KEY`.

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  '';

// Default to localhost worker; override in .env.local for device testing
// (e.g. http://192.168.1.x:3000).
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[env] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY/KEY — Supabase calls will fail.',
  );
}

export const ENV = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  API_URL,
};
