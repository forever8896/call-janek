import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Role = 'reporter' | 'admin' | null;

type AuthCtx = {
  session: Session | null;
  role: Role;
  isReady: boolean;
  // Admin
  signInAdmin: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  role: null,
  isReady: false,
  signInAdmin: async () => ({ error: 'no provider' }),
  signOut: async () => {},
});

function deriveRole(session: Session | null): Role {
  if (!session) return null;
  const userMeta = session.user?.user_metadata as Record<string, unknown> | undefined;
  if (userMeta && userMeta.role === 'admin') return 'admin';
  return 'reporter';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const ensuredAnon = useRef(false);

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
        // Auto-sign-in as anonymous reporter so reports.reporter_id is set
        // and RLS lets reporters see their own past tips.
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

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      role: deriveRole(session),
      isReady,
      async signInAdmin(email: string) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, isReady],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
