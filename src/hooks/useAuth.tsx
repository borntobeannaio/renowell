import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { proxySignInWithPassword, proxyRefreshSession, isNetworkError } from '@/lib/authProxy';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// За сколько секунд до истечения токена пытаемся обновить сессию вручную
// (раньше встроенного авторефреша supabase-js, чтобы поймать сетевую ошибку и уйти в прокси).
const REFRESH_LEAD_SECONDS = 5 * 60; // 5 минут

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  // Запланировать обновление сессии заранее. Сначала пробуем напрямую,
  // при сетевой ошибке — через auth-proxy (Yandex Cloud).
  const scheduleRefresh = (sess: Session | null) => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!sess?.expires_at || !sess.refresh_token) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const fireInSec = Math.max(5, sess.expires_at - nowSec - REFRESH_LEAD_SECONDS);

    refreshTimerRef.current = window.setTimeout(async () => {
      refreshTimerRef.current = null;
      try {
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: sess.refresh_token,
        });
        if (!error && data.session) return; // onAuthStateChange сам перезапланирует
        if (error && !isNetworkError(error)) {
          console.warn('[auth] refresh error (non-network):', error.message);
          return;
        }
      } catch (e) {
        if (!isNetworkError(e)) {
          console.warn('[auth] refresh threw:', e);
          return;
        }
      }
      // Сетевой сбой — пробуем через прокси
      const { data: proxySess, error: proxyErr } = await proxyRefreshSession(sess.refresh_token);
      if (proxyErr || !proxySess) {
        console.warn('[auth] proxy refresh failed:', proxyErr?.message);
        // Повторим попытку через минуту
        refreshTimerRef.current = window.setTimeout(() => scheduleRefresh(sess), 60_000);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: proxySess.access_token,
        refresh_token: proxySess.refresh_token,
      });
      if (setErr) console.warn('[auth] setSession after proxy refresh failed:', setErr.message);
    }, fireInSec * 1000);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        scheduleRefresh(session);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      scheduleRefresh(session);
    });

    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { error: null };
      if (isNetworkError(error)) {
        const { data: session, error: proxyError } = await proxySignInWithPassword(email, password);
        if (proxyError || !session) {
          return { error: (proxyError ? new Error(proxyError.message) : error) as Error };
        }
        const { error: setErr } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        return { error: setErr as Error | null };
      }
      return { error: error as Error };
    } catch (e) {
      if (isNetworkError(e)) {
        const { data: session, error: proxyError } = await proxySignInWithPassword(email, password);
        if (proxyError || !session) {
          return { error: new Error(proxyError?.message || 'Не удалось войти') };
        }
        const { error: setErr } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        return { error: setErr as Error | null };
      }
      return { error: e as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
