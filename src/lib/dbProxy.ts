import { supabase } from "@/integrations/supabase/client";

interface Filter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';
  value: unknown;
}

interface OrderBy {
  column: string;
  ascending?: boolean;
}

interface ProxyRequest {
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
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

/**
 * Database proxy client that routes all requests through edge function
 * Use this instead of direct supabase.from() calls if direct access is blocked
 */
export async function dbProxy<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('db-proxy', {
      body: request,
    });

    if (error) {
      console.error('[dbProxy] Invoke error:', error);
      return { data: null, error: { message: error.message } };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    return { data: data?.data as T, error: null };
  } catch (err) {
    const error = err as Error;
    console.error('[dbProxy] Error:', error);
    return { data: null, error: { message: error.message } };
  }
}

// Helper functions for common operations
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
    action: 'select',
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
    action: 'insert',
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
    action: 'update',
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
    action: 'delete',
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
    action: 'upsert',
    table,
    data,
    select,
  });
};
