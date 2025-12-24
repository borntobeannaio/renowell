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
}

interface ProxyResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

const RETRIES = 2;

// External proxy URL (Yandex Cloud, etc.) - set via localStorage or env
const getExternalProxyUrl = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("EXTERNAL_PROXY_URL");
  }
  return null;
};

// Check if we should use external proxy (for problematic regions)
const shouldUseExternalProxy = (): boolean => {
  return !!getExternalProxyUrl();
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Make request via external proxy (Yandex Cloud, etc.)
 */
async function callExternalProxy<T>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  const proxyUrl = getExternalProxyUrl();
  if (!proxyUrl) {
    throw new Error("External proxy URL not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(proxyUrl, {
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
 * Make request via Supabase edge function
 */
async function callSupabaseProxy<T>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  const { data, error } = await supabase.functions.invoke("db-proxy", {
    body: request,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    return { data: null, error: { message: data.error.message ?? "Proxy error" } };
  }

  return { data: data?.data as T, error: null };
}

/**
 * Database proxy client that routes requests through backend function.
 * Supports external proxy for problematic regions.
 */
export async function dbProxy<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  let lastError: unknown = null;
  const useExternal = shouldUseExternalProxy();

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      if (useExternal) {
        return await callExternalProxy<T>(request);
      } else {
        return await callSupabaseProxy<T>(request);
      }
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

/**
 * Set external proxy URL (e.g., Yandex Cloud Function URL)
 */
export const setExternalProxyUrl = (url: string | null) => {
  if (typeof window !== "undefined") {
    if (url) {
      localStorage.setItem("EXTERNAL_PROXY_URL", url);
    } else {
      localStorage.removeItem("EXTERNAL_PROXY_URL");
    }
  }
};

/**
 * Get current external proxy URL
 */
export const getConfiguredProxyUrl = (): string | null => {
  return getExternalProxyUrl();
};

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