import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Role = 'reporter' | 'admin' | null;

const BIOMETRIC_KEY = 'hg.biometric.enabled';

type AuthCtx = {
  session: Session | null;
  role: Role;
  isReady: boolean;

  // Biometric gate (only relevant for the admin flow)
  biometricUnlocked: boolean;
  biometricEnabled: boolean;
  biometricSupported: boolean;
  unlockWithBiometric: () => Promise<{ ok: boolean; error?: string }>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;

  // Sign-in / sign-out
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  role: null,
  isReady: false,
  biometricUnlocked: false,
  biometricEnabled: false,
  biometricSupported: false,
  unlockWithBiometric: async () => ({ ok: false, error: 'no provider' }),
  setBiometricEnabled: async () => {},
  signInWithPassword: async () => ({ error: 'no provider' }),
  signOut: async () => {},
});

function deriveRole(session: Session | null): Role {
  if (!session) return null;
  const meta = session.user?.user_metadata as Record<string, unknown> | undefined;
  if (meta && meta.role === 'admin') return 'admin';
  return 'reporter';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const ensuredAnon = useRef(false);

  // Probe device biometric support + persisted opt-in once
  useEffect(() => {
    (async () => {
      try {
        const [hasHw, enrolled, savedFlag] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem(BIOMETRIC_KEY),
        ]);
        setBiometricSupported(hasHw && enrolled);
        setBiometricEnabledState(savedFlag === '1');
      } catch {
        // best-effort; never block startup on this
      }
    })();
  }, []);

  // Restore session + ensure anonymous reporter session for tipline use
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
        setIsReady(true);
      } else if (!ensuredAnon.current) {
        ensuredAnon.current = true;
        const { data: anon, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.warn('[auth] anonymous sign-in failed:', error.message);
        }
        if (mounted) {
          setSession(anon.session ?? null);
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock the newsroom',
        fallbackLabel: 'Use device passcode',
        disableDeviceFallback: false,
      });
      if (res.success) {
        setBiometricUnlocked(true);
        return { ok: true };
      }
      return {
        ok: false,
        error:
          'error' in res
            ? (res.error as string | undefined) ?? 'Authentication cancelled'
            : 'Authentication cancelled',
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    if (enabled) {
      await AsyncStorage.setItem(BIOMETRIC_KEY, '1');
    } else {
      await AsyncStorage.removeItem(BIOMETRIC_KEY);
      setBiometricUnlocked(false);
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      role: deriveRole(session),
      isReady,
      biometricUnlocked,
      biometricEnabled,
      biometricSupported,
      unlockWithBiometric,
      setBiometricEnabled,
      async signInWithPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { error: error.message };
        // Fresh password sign-in counts as an unlock for this session
        setBiometricUnlocked(true);
        return { error: null };
      },
      async signOut() {
        await supabase.auth.signOut();
        setBiometricUnlocked(false);
      },
    }),
    [
      session,
      isReady,
      biometricUnlocked,
      biometricEnabled,
      biometricSupported,
      unlockWithBiometric,
      setBiometricEnabled,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
