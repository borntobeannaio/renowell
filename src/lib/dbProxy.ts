import { supabase } from "@/integrations/supabase/client";

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
  onConflict?: string;
}

interface ProxyResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT = 20000;

// Always use Yandex Cloud proxy for better connectivity in RU region
const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ProxyOptions {
  retries?: number;
  timeout?: number;
}

/**
 * Make request via external proxy (Yandex Cloud)
 */
async function callExternalProxy<T>(request: ProxyRequest, timeout: number = DEFAULT_TIMEOUT): Promise<ProxyResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
 * Database proxy client that routes all requests through Yandex Cloud proxy.
 */
export async function dbProxy<T = unknown>(request: ProxyRequest, options?: ProxyOptions): Promise<ProxyResponse<T>> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callExternalProxy<T>(request, timeout);
    } catch (err) {
      lastError = err;
      console.warn(`[dbProxy] Attempt ${attempt + 1}/${retries + 1} failed:`, err);
      if (attempt < retries) {
        const delay = 500 * Math.pow(2, attempt); // Exponential backoff: 500ms, 1000ms, 2000ms...
        console.log(`[dbProxy] Retrying in ${delay}ms...`);
        await sleep(delay);
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
  select?: string,
  options?: ProxyOptions
): Promise<ProxyResponse<T[]>> => {
  return dbProxy<T[]>({
    action: "insert",
    table,
    data,
    select,
  }, options);
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
  options?: { select?: string; onConflict?: string }
): Promise<ProxyResponse<T[]>> => {
  return dbProxy<T[]>({
    action: "upsert",
    table,
    data,
    select: options?.select,
    onConflict: options?.onConflict,
  });
};