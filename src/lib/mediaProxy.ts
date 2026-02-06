import { useState, useEffect } from "react";

const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// In-memory cache for blob URLs
const blobCache = new Map<string, string>();

/**
 * Call a Supabase edge function through the Yandex Cloud proxy.
 * Falls back to direct Supabase call if proxy fails.
 */
export async function proxyEdgeFunction<T = unknown>(
  target: string,
  body: Record<string, unknown>
): Promise<T> {
  // Try Yandex proxy first
  try {
    const response = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _proxyTarget: target, ...body }),
    });
    const json = await response.json();
    if (json?.error) {
      throw new Error(typeof json.error === "string" ? json.error : json.error.message || "Proxy error");
    }
    return (json?.data ?? json) as T;
  } catch (proxyErr) {
    console.warn(`[mediaProxy] Yandex proxy failed for ${target}, trying direct:`, proxyErr);
  }

  // Fallback to direct Supabase call
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${target}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (json?.error) {
    throw new Error(typeof json.error === "string" ? json.error : json.error.message || "Direct call error");
  }
  return json as T;
}

/**
 * Fetch a Telegram image as a blob URL, routed through the Yandex proxy.
 */
export async function fetchTelegramImageBlob(fileId: string): Promise<string | null> {
  const cacheKey = `tg:${fileId}`;
  const cached = blobCache.get(cacheKey);
  if (cached) return cached;

  try {
    const result = await proxyEdgeFunction<{ base64: string; contentType: string }>(
      "telegram-image-proxy",
      { file_id: fileId }
    );

    if (!result?.base64) return null;

    const binary = atob(result.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: result.contentType || "image/jpeg" });
    const blobUrl = URL.createObjectURL(blob);
    blobCache.set(cacheKey, blobUrl);
    return blobUrl;
  } catch (err) {
    console.error("[mediaProxy] Failed to fetch Telegram image:", err);
    return null;
  }
}

/**
 * React hook that returns a blob URL for a Telegram image,
 * fetched through the Yandex Cloud proxy.
 */
export function useTelegramImageUrl(fileId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!fileId) return null;
    return blobCache.get(`tg:${fileId}`) || null;
  });

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }

    const cached = blobCache.get(`tg:${fileId}`);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    fetchTelegramImageBlob(fileId).then((blobUrl) => {
      if (!cancelled && blobUrl) setUrl(blobUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return url;
}
