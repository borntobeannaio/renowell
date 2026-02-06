import { useState, useEffect } from "react";

const EXTERNAL_PROXY_URL = "https://functions.yandexcloud.net/d4ed338dbl81ecrk8g0t";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// In-memory cache for blob URLs
const blobUrlCache = new Map<string, string>();

/**
 * Extract bucket and path from a Supabase Storage URL.
 * Returns null if the URL is not a Supabase Storage URL.
 */
function parseStorageUrl(rawUrl: string): { bucket: string; path: string } | null {
  const pattern = /supabase\.co\/storage\/v1\/object\/public\/([^/]+)\/(.+)/;
  const match = rawUrl.match(pattern);
  if (!match) return null;
  return { bucket: match[1], path: match[2].split('?')[0] };
}

/**
 * Check if a URL is a Supabase Storage URL that needs proxying.
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /supabase\.co\/storage\/v1\/object\/public\//.test(url);
}

/**
 * Fetch an avatar image via storage-proxy (through Yandex Cloud proxy)
 * and return a blob URL for use in <img> tags.
 */
async function fetchProxiedAvatar(rawUrl: string): Promise<string> {
  // Check cache first
  const cached = blobUrlCache.get(rawUrl);
  if (cached) return cached;

  const parsed = parseStorageUrl(rawUrl);
  if (!parsed) return rawUrl;

  const request = {
    _proxyTarget: "storage-proxy",
    action: "download",
    bucket: parsed.bucket,
    path: parsed.path,
  };

  let base64Data: string | null = null;
  let contentType = "image/jpeg";

  // Try Yandex proxy first
  try {
    const res = await fetch(EXTERNAL_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const json = await res.json();
    if (json?.data?.base64) {
      base64Data = json.data.base64;
      contentType = json.data.contentType || contentType;
    }
  } catch {
    // Fallback to direct
  }

  // Fallback to direct Supabase call
  if (!base64Data) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/storage-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "download",
          bucket: parsed.bucket,
          path: parsed.path,
        }),
      });
      const json = await res.json();
      if (json?.data?.base64) {
        base64Data = json.data.base64;
        contentType = json.data.contentType || contentType;
      }
    } catch {
      // Give up, return original URL
      return rawUrl;
    }
  }

  if (!base64Data) return rawUrl;

  // Convert base64 to blob URL
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  const blobUrl = URL.createObjectURL(blob);

  blobUrlCache.set(rawUrl, blobUrl);
  return blobUrl;
}

/**
 * React hook that returns a proxied avatar URL.
 * If the URL points to Supabase Storage, it fetches via storage-proxy
 * and returns a blob URL. Otherwise returns the original URL.
 */
export function useProxiedAvatarUrl(rawUrl: string | null | undefined): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!rawUrl) {
      setResolvedUrl(null);
      return;
    }

    if (!isSupabaseStorageUrl(rawUrl)) {
      setResolvedUrl(rawUrl);
      return;
    }

    // Check cache synchronously
    const cached = blobUrlCache.get(rawUrl);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }

    let cancelled = false;
    fetchProxiedAvatar(rawUrl).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });

    return () => { cancelled = true; };
  }, [rawUrl]);

  return resolvedUrl;
}
