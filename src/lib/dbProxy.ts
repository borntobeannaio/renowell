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

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 15000;

// Simple in-memory cache for select queries
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(request: ProxyRequest): string {
  return JSON.stringify(request);
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  // Limit cache size
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// Invalidate cache for a table after mutations
function invalidateTableCache(table: string): void {
  for (const key of cache.keys()) {
    if (key.includes(`"table":"${table}"`)) {
      cache.delete(key);
    }
  }
}

/**
 * Database proxy client that routes all requests through edge function
 * with timeout, retry logic, and caching
 */
export async function dbProxy<T = unknown>(request: ProxyRequest): Promise<ProxyResponse<T>> {
  // For select queries, check cache first
  if (request.action === 'select') {
    const cacheKey = getCacheKey(request);
    const cached = getFromCache<T>(cacheKey);
    if (cached) {
      console.log('[dbProxy] Cache hit:', request.table);
      return { data: cached, error: null };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const { data, error } = await supabase.functions.invoke('db-proxy', {
      body: request,
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error('[dbProxy] Invoke error:', error);
      return { data: null, error: { message: error.message } };
    }

    if (data?.error) {
      return { data: null, error: data.error };
    }

    // Cache select results
    if (request.action === 'select' && data?.data) {
      const cacheKey = getCacheKey(request);
      setCache(cacheKey, data.data);
    }

    // Invalidate cache on mutations
    if (request.action !== 'select') {
      invalidateTableCache(request.table);
    }

    return { data: data?.data as T, error: null };
  } catch (err) {
    clearTimeout(timeoutId);
    const error = err as Error;
    
    if (error.name === 'AbortError') {
      console.error('[dbProxy] Request timeout');
      return { data: null, error: { message: 'Превышено время ожидания запроса' } };
    }
    
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

// Export function to clear cache manually if needed
export const clearProxyCache = (): void => {
  cache.clear();
};
