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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Database proxy client that routes requests through backend function.
 */
export async function dbProxy<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("db-proxy", {
        body: request,
      });

      if (error) {
        lastError = error;
        throw error;
      }

      if (data?.error) {
        return { data: null, error: { message: data.error.message ?? "Proxy error" } };
      }

      return { data: data?.data as T, error: null };
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
