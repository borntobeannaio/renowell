

interface Filter {
  column: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is";
  value: unknown;
}

interface OrderBy {
  column: string;
  ascending?: boolean;
}

interface ProxyRequest {
  action: "ping" | "select" | "insert" | "update" | "delete" | "upsert";
  table?: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  select?: string;
  order?: OrderBy[];
  limit?: number;
}

interface ProxyResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

const RETRIES = 2;

// Prefer built-in backend proxy (proper UTF-8), fall back to external proxy if needed
const INTERNAL_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-proxy`;
const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Make request via proxy endpoint.
 */
async function callProxyUrl<T>(url: string, request: ProxyRequest): Promise<ProxyResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Publishable key is safe on the client and is required for calling backend functions.
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (data?.error) {
      return { data: null, error: { message: data.error.message ?? data.error ?? "Proxy error" } };
    }

    return { data: data?.data as T, error: null };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Try internal proxy first (stable UTF-8), fall back to external proxy.
 */
async function callExternalProxy<T>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  try {
    return await callProxyUrl<T>(INTERNAL_PROXY_URL, request);
  } catch {
    return await callProxyUrl<T>(EXTERNAL_PROXY_URL, request);
  }
}

/**
 * Database proxy client that routes all requests through Yandex Cloud proxy.
 */
export async function dbProxy<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await callExternalProxy<T>(request);
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      const e = lastError as { message?: string };
      return { data: null, error: { message: e?.message || "Ошибка прокси-запроса" } };
    }
  }

  return { data: null, error: { message: "Ошибка прокси-запроса" } };
}

export const proxyPing = () => dbProxy<string>({ action: "ping" });

export const proxySelect = <T = unknown>(
  table: string,
  options?: {
    select?: string;
    filters?: Filter[];
    order?: OrderBy[];
    limit?: number;
  }
): Promise<ProxyResponse<T[]>> => {
  return dbProxy<T[]>({
    action: "select",
    table,
    ...options,
  });
};

export const proxyInsert = <T = unknown>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  select?: string
): Promise<ProxyResponse<T[]>> => {
  return dbProxy<T[]>({
    action: "insert",
    table,
    data,
    select,
  });
};

export const proxyUpdate = <T = unknown>(
  table: string,
  data: Record<string, unknown>,
  filters: Filter[],
  select?: string
): Promise<ProxyResponse<T[]>> => {
  return dbProxy<T[]>({
    action: "update",
    table,
    data,
    filters,
    select,
  });
};

export const proxyDelete = (
  table: string,
  filters: Filter[]
): Promise<ProxyResponse<null>> => {
  return dbProxy<null>({
    action: "delete",
    table,
    filters,
  });
};

export const proxyUpsert = <T = unknown>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  select?: string
): Promise<ProxyResponse<T[]>> => {
  return dbProxy<T[]>({
    action: "upsert",
    table,
    data,
    select,
  });
};