// Хранилище сессии портала (собственная авторизация через auth-proxy).
import type { Session } from '@supabase/supabase-js';

export const SESSION_KEY = 'renowell-auth-session';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(sess: Session | null): void {
  try {
    if (sess) localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Текущий access token для запросов через прокси. */
export function getAccessToken(): string | null {
  return loadSession()?.access_token ?? null;
}

/** Удаляет старые сессии прежней системы входа. */
export function clearLegacySessions(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
