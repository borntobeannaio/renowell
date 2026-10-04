// Авторизация портала: все вызовы идут через Yandex Cloud прокси в функцию auth-proxy,
// которая проверяет пользователей во внешней базе Renowell.

const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";
const AUTH_PROXY_TIMEOUT_MS = 15000;

export interface ProxyAuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: unknown;
}

interface ProxyResult<T> {
  data: T | null;
  error: { message: string } | null;
}

async function callAuth<T>(payload: Record<string, unknown>): Promise<ProxyResult<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ _proxyTarget: "auth-proxy", ...payload }),
    });
    window.clearTimeout(timeoutId);
    const json = await response.json().catch(() => null);
    if (!json) return { data: null, error: { message: "Прокси вернул пустой ответ" } };
    if (json.error) {
      const msg = typeof json.error === "string" ? json.error : json.error.message || "Ошибка авторизации";
      return { data: null, error: { message: msg } };
    }
    return { data: (json.data ?? json) as T, error: null };
  } catch (e) {
    window.clearTimeout(timeoutId);
    const message = e instanceof Error ? e.message : "Не удалось связаться с прокси";
    return { data: null, error: { message } };
  }
}

function checkSession(r: ProxyResult<ProxyAuthSession>): ProxyResult<ProxyAuthSession> {
  if (r.error) return r;
  if (!r.data?.access_token || !r.data?.refresh_token) return { data: null, error: { message: "Прокси не вернул сессию" } };
  return r;
}

export async function proxySignInWithPassword(email: string, password: string) {
  return checkSession(await callAuth<ProxyAuthSession>({ action: "password", email, password }));
}

export async function proxyRefreshSession(refreshToken: string) {
  return checkSession(await callAuth<ProxyAuthSession>({ action: "refresh", refresh_token: refreshToken }));
}

export async function proxySignOut(refreshToken?: string) {
  return callAuth<{ ok: boolean }>({ action: "logout", refresh_token: refreshToken });
}

export async function proxyUpdatePassword(accessToken: string, password: string, currentPassword?: string) {
  return callAuth<{ ok: boolean }>({
    action: "update_password",
    _accessToken: accessToken,
    password,
    ...(currentPassword !== undefined ? { current_password: currentPassword } : {}),
  });
}

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||
    (msg.includes("fetch") && msg.includes("abort"))
  );
}
