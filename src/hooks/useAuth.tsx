import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { proxySignInWithPassword, proxyRefreshSession, proxySignOut, type ProxyAuthSession } from '@/lib/authProxy';
import { loadSession, saveSession, clearLegacySessions } from '@/lib/session';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// За сколько секунд до истечения токена обновляем сессию.
const REFRESH_LEAD_SECONDS = 5 * 60;

function toSession(data: ProxyAuthSession, fallbackUser?: User): Session {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = data.expires_in ?? 3600;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: expiresIn,
    expires_at: data.expires_at ?? nowSec + expiresIn,
    token_type: data.token_type ?? 'bearer',
    user: (data.user ?? fallbackUser ?? {}) as User,
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const apply = useCallback((sess: Session | null) => {
    saveSession(sess);
    setSession(sess);
    setUser(sess?.user ?? null);
  }, []);

  const clearTimer = () => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const doRefresh = useCallback(async (sess: Session): Promise<Session | null> => {
    const { data, error } = await proxyRefreshSession(sess.refresh_token);
    if (error || !data) {
      // Недействительный refresh-токен → выходим; сетевую ошибку переживаем.
      if (error && /invalid refresh|not found/i.test(error.message)) {
        apply(null);
        return null;
      }
      return undefined as unknown as null;
    }
    const next = toSession(data, sess.user);
    apply(next);
    return next;
  }, [apply]);

  const scheduleRefresh = useCallback((sess: Session | null) => {
    clearTimer();
    if (!sess?.expires_at || !sess.refresh_token) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const fireInSec = Math.max(5, sess.expires_at - nowSec - REFRESH_LEAD_SECONDS);
    refreshTimerRef.current = window.setTimeout(async () => {
      refreshTimerRef.current = null;
      const next = await doRefresh(sess);
      if (next) scheduleRefresh(next);
      else if (next === undefined) refreshTimerRef.current = window.setTimeout(() => scheduleRefresh(sess), 60_000);
    }, fireInSec * 1000);
  }, [doRefresh]);

  useEffect(() => {
    clearLegacySessions();
    const stored = loadSession();
    (async () => {
      if (!stored) {
        setLoading(false);
        return;
      }
      const nowSec = Math.floor(Date.now() / 1000);
      if (!stored.expires_at || stored.expires_at - nowSec < 60) {
        const next = await doRefresh(stored);
        if (next) scheduleRefresh(next);
        else if (next === undefined) {
          // сеть недоступна — используем сохранённую сессию, обновим позже
          setSession(stored);
          setUser(stored.user);
          scheduleRefresh(stored);
        }
      } else {
        setSession(stored);
        setUser(stored.user);
        scheduleRefresh(stored);
      }
      setLoading(false);
    })();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'renowell-auth-session') return;
      const s = loadSession();
      setSession(s);
      setUser(s?.user ?? null);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearTimer();
    };
  }, [doRefresh, scheduleRefresh]);

  const signUp = async () => {
    // Самостоятельная регистрация отключена: сотрудников создаёт администратор.
    return { error: new Error('Регистрация отключена. Обратитесь к администратору.') };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await proxySignInWithPassword(email.trim(), password);
    if (error || !data) return { error: new Error(error?.message || 'Не удалось войти') };
    const next = toSession(data);
    apply(next);
    scheduleRefresh(next);
    return { error: null };
  };

  const signOut = async () => {
    const rt = session?.refresh_token;
    clearTimer();
    apply(null);
    if (rt) await proxySignOut(rt);
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
