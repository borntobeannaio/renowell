// Фолбэк для авторизации через Yandex Cloud прокси,
// если прямой запрос к supabase.co не проходит (Failed to fetch).

const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";
const AUTH_PROXY_TIMEOUT_MS = 15000;

interface ProxyAuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: unknown;
}

interface ProxyAuthResult {
  data: ProxyAuthSession | null;
  error: { message: string } | null;
}

export async function proxySignInWithPassword(
  email: string,
  password: string
): Promise<ProxyAuthResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        _proxyTarget: "auth-proxy",
        action: "password",
        email,
        password,
      }),
    });
    window.clearTimeout(timeoutId);

    const json = await response.json().catch(() => null);
    if (!json) {
      return { data: null, error: { message: "Прокси вернул пустой ответ" } };
    }

    if (json.error) {
      const msg =
        typeof json.error === "string"
          ? json.error
          : json.error.message || "Ошибка авторизации через прокси";
      return { data: null, error: { message: msg } };
    }

    const session = (json.data ?? json) as ProxyAuthSession;
    if (!session?.access_token || !session?.refresh_token) {
      return { data: null, error: { message: "Прокси не вернул сессию" } };
    }
    return { data: session, error: null };
  } catch (e) {
    window.clearTimeout(timeoutId);
    const message = e instanceof Error ? e.message : "Не удалось связаться с прокси";
    return { data: null, error: { message } };
  }
}

export async function proxyRefreshSession(
  refreshToken: string
): Promise<ProxyAuthResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        _proxyTarget: "auth-proxy",
        action: "refresh",
        refresh_token: refreshToken,
      }),
    });
    window.clearTimeout(timeoutId);

    const json = await response.json().catch(() => null);
    if (!json) {
      return { data: null, error: { message: "Прокси вернул пустой ответ" } };
    }
    if (json.error) {
      const msg =
        typeof json.error === "string"
          ? json.error
          : json.error.message || "Ошибка обновления сессии через прокси";
      return { data: null, error: { message: msg } };
    }
    const session = (json.data ?? json) as ProxyAuthSession;
    if (!session?.access_token || !session?.refresh_token) {
      return { data: null, error: { message: "Прокси не вернул сессию" } };
    }
    return { data: session, error: null };
  } catch (e) {
    window.clearTimeout(timeoutId);
    const message = e instanceof Error ? e.message : "Не удалось связаться с прокси";
    return { data: null, error: { message } };
  }
}

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||
    msg.includes("fetch") && msg.includes("abort")
  );
}
