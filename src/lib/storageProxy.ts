interface StorageRequest {
  action: "upload" | "download" | "delete" | "getPublicUrl" | "list";
  bucket: string;
  path?: string;
  fileBase64?: string;
  contentType?: string;
  upsert?: boolean;
  paths?: string[];
}

interface StorageResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

const RETRIES = 2;

// Use Yandex Cloud proxy for better connectivity in RU region
const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Direct Supabase edge function URL as fallback
const STORAGE_PROXY_URL = `${SUPABASE_URL}/functions/v1/storage-proxy`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Convert File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Make request to storage proxy via Yandex Cloud
 */
async function callStorageProxy<T>(request: StorageRequest): Promise<StorageResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    // Try Yandex proxy first (wraps storage-proxy edge function)
    const response = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Tell Yandex proxy to forward to storage-proxy instead of db-proxy
        _proxyTarget: "storage-proxy",
        ...request,
      }),
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
 * Fallback: call storage-proxy edge function directly
 */
async function callStorageProxyDirect<T>(request: StorageRequest): Promise<StorageResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(STORAGE_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (data?.error) {
      return { data: null, error: { message: data.error.message ?? data.error ?? "Storage error" } };
    }

    return { data: data?.data as T, error: null };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Storage proxy client with retry logic
 */
export async function storageProxy<T = unknown>(request: StorageRequest): Promise<StorageResponse<T>> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      // Try Yandex Cloud proxy first (bypasses Supabase block)
      return await callStorageProxy<T>(request);
    } catch {
      try {
        // Fallback to direct Supabase edge function
        return await callStorageProxyDirect<T>(request);
      } catch (err) {
        lastError = err;
        if (attempt < RETRIES) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        const e = lastError as { message?: string };
        return { data: null, error: { message: e?.message || "Ошибка прокси-запроса" } };
      }
    }
  }

  return { data: null, error: { message: "Ошибка прокси-запроса" } };
}

/**
 * Upload a file to storage via proxy
 */
export async function proxyUpload(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<StorageResponse<{ path: string }>> {
  const fileBase64 = await fileToBase64(file);
  
  return storageProxy<{ path: string }>({
    action: "upload",
    bucket,
    path,
    fileBase64,
    contentType: file.type,
    upsert: options?.upsert ?? true,
  });
}

/**
 * Delete files from storage via proxy
 */
export async function proxyDelete(
  bucket: string,
  paths: string[]
): Promise<StorageResponse<null>> {
  return storageProxy<null>({
    action: "delete",
    bucket,
    paths,
  });
}

/**
 * Get public URL for a file
 */
export async function proxyGetPublicUrl(
  bucket: string,
  path: string
): Promise<StorageResponse<{ publicUrl: string }>> {
  return storageProxy<{ publicUrl: string }>({
    action: "getPublicUrl",
    bucket,
    path,
  });
}

/**
 * List files in a bucket/folder
 */
export async function proxyList(
  bucket: string,
  path?: string
): Promise<StorageResponse<Array<{ name: string; id: string }>>> {
  return storageProxy<Array<{ name: string; id: string }>>({
    action: "list",
    bucket,
    path,
  });
}
