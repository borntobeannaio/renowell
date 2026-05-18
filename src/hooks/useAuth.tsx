import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { proxySignInWithPassword, proxyRefreshSession, isNetworkError } from '@/lib/authProxy';
import { proxyInvoke } from '@/lib/dbProxy';

// ВРЕМЕННО: автовход без формы (для встречи). Удалить когда логин вернётся.
const DEV_AUTO_LOGIN = true;

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
const AUTH_DIRECT_TIMEOUT_MS = 4000;
const AUTH_PROXY_RETRY_MS = 1500;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

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
        const { data, error } = await withTimeout(
          supabase.auth.refreshSession({ refresh_token: sess.refresh_token }),
          AUTH_DIRECT_TIMEOUT_MS,
          'refreshSession',
        );
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
      const { error: setErr } = await withTimeout(
        supabase.auth.setSession({
          access_token: proxySess.access_token,
          refresh_token: proxySess.refresh_token,
        }),
        AUTH_DIRECT_TIMEOUT_MS,
        'setSession',
      );
      if (setErr) console.warn('[auth] setSession after proxy refresh failed:', setErr.message);
    }, fireInSec * 1000);
  };

  useEffect(() => {
    let initialized = false;
    const markInitialized = () => {
      if (initialized) return;
      initialized = true;
      setLoading(false);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        markInitialized();
        scheduleRefresh(session);
      }
    );

    // THEN check for existing session
    withTimeout(supabase.auth.getSession(), AUTH_DIRECT_TIMEOUT_MS, 'getSession').then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      markInitialized();
      scheduleRefresh(session);
    }).catch((e) => {
      console.warn('[auth] getSession failed:', e);
      markInitialized();
    });

    // Страховка: если getSession завис (сеть до auth.supabase.co заблокирована
    // и идёт молчаливый refresh) — через 4с пробуем восстановить сессию через
    // auth-proxy по сохранённому refresh_token, иначе хотя бы показываем форму логина.
    const fallbackTimer = window.setTimeout(async () => {
      if (initialized) return;
      try {
        // Достаём сохранённый refresh_token из localStorage supabase-js
        let refreshToken: string | null = null;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            if (parsed?.refresh_token) {
              refreshToken = parsed.refresh_token;
              break;
            }
          } catch {}
        }
        if (refreshToken) {
          console.warn('[auth] getSession hang — пробуем refresh через auth-proxy');
          const { data: proxySess } = await proxyRefreshSession(refreshToken);
          if (proxySess) {
            const { error: setErr } = await withTimeout(
              supabase.auth.setSession({
                access_token: proxySess.access_token,
                refresh_token: proxySess.refresh_token,
              }),
              AUTH_DIRECT_TIMEOUT_MS,
              'setSession',
            );
            if (!setErr) {
              setSession(proxySess as Session);
              setUser(proxySess.user as User);
            }
            markInitialized();
            return;
          }
        }
      } catch (e) {
        console.warn('[auth] fallback refresh failed:', e);
      }
      markInitialized();
    }, 4000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(fallbackTimer);
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
    // Порог: если supabase-auth ответил invalid_credentials быстрее 5 мс,
    // это почти наверняка IP-рейтлимит, а не реально неверный пароль.
    // В таком случае пробуем через auth-proxy (другой IP, отдельный счётчик).
    const RATE_LIMIT_MS = 5;

    const applyProxySession = async (
      proxyEmail: string,
      proxyPassword: string,
      fallbackError: Error,
    ): Promise<{ error: Error | null }> => {
      const { data: session, error: proxyError } = await proxySignInWithPassword(
        proxyEmail,
        proxyPassword,
      );
      if (proxyError || !session) {
        return { error: (proxyError ? new Error(proxyError.message) : fallbackError) };
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      return { error: setErr as Error | null };
    };

    try {
      const startedAt = performance.now();
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_DIRECT_TIMEOUT_MS,
        'signInWithPassword',
      );
      const elapsedMs = performance.now() - startedAt;

      if (!error) return { error: null };

      if (isNetworkError(error)) {
        return await applyProxySession(email, password, error as Error);
      }

      const msg = (error.message || '').toLowerCase();
      const looksLikeInvalidCreds =
        msg.includes('invalid login credentials') || msg.includes('invalid_credentials');

      // Мгновенный invalid_credentials → подозрение на IP-рейтлимит, ретрай через прокси
      if (looksLikeInvalidCreds && elapsedMs < AUTH_PROXY_RETRY_MS) {
        console.warn(`[auth] invalid_credentials за ${elapsedMs.toFixed(1)}ms — ретрай через auth-proxy`);
        const proxyResult = await applyProxySession(email, password, error as Error);
        if (!proxyResult.error) return proxyResult;
        // Если прокси тоже вернул invalid — пароль реально неверный, отдаём исходную ошибку
        return { error: error as Error };
      }

      return { error: error as Error };
    } catch (e) {
      if (isNetworkError(e)) {
        return await applyProxySession(email, password, e as Error);
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
