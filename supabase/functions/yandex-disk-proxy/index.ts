import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Browser-like headers to avoid 403 from Yandex
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://disk.yandex.ru/',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // GET request — proxy image binary data
    if (req.method === 'GET') {
      const publicUrl = url.searchParams.get('publicUrl');
      const path = url.searchParams.get('path');
      const mode = url.searchParams.get('mode') || 'preview';
      const legacyUrl = url.searchParams.get('url');

      // Legacy mode: direct URL proxy (for backward compatibility)
      if (legacyUrl && !publicUrl) {
        console.log('Legacy mode: proxying URL directly:', legacyUrl);
        return await proxyImageUrl(legacyUrl);
      }

      // New mode: get fresh URL from Yandex API then proxy
      if (!publicUrl || !path) {
        return new Response(
          JSON.stringify({ error: 'Missing publicUrl or path parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`New mode: ${mode} for path: ${path}`);

      let imageUrl: string;

      if (mode === 'download') {
        // Get fresh download URL
        const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`;
        console.log('Fetching download URL from:', downloadApiUrl);
        
        const downloadResponse = await fetch(downloadApiUrl, { headers: browserHeaders });
        
        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          console.error('Failed to get download URL:', downloadResponse.status, errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to get download URL', 
              status: downloadResponse.status,
              details: errorText.substring(0, 200)
            }),
            { status: downloadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const downloadData = await downloadResponse.json();
        imageUrl = downloadData.href;
        
        if (!imageUrl) {
          return new Response(
            JSON.stringify({ error: 'No download href in response' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Get fresh preview URL
        const resourceApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}&preview_size=L&preview_crop=false`;
        console.log('Fetching resource info from:', resourceApiUrl);
        
        const resourceResponse = await fetch(resourceApiUrl, { headers: browserHeaders });
        
        if (!resourceResponse.ok) {
          const errorText = await resourceResponse.text();
          console.error('Failed to get resource info:', resourceResponse.status, errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to get resource info', 
              status: resourceResponse.status,
              details: errorText.substring(0, 200)
            }),
            { status: resourceResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const resourceData = await resourceResponse.json();
        imageUrl = resourceData.preview;
        
        if (!imageUrl) {
          // Fallback to download if no preview available
          console.log('No preview available, falling back to download');
          const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`;
          const downloadResponse = await fetch(downloadApiUrl, { headers: browserHeaders });
          
          if (downloadResponse.ok) {
            const downloadData = await downloadResponse.json();
            imageUrl = downloadData.href;
          }
          
          if (!imageUrl) {
            return new Response(
              JSON.stringify({ error: 'No preview or download URL available' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      console.log('Proxying image from:', imageUrl.substring(0, 100) + '...');
      return await proxyImageUrl(imageUrl);
    }

    // POST request — list files or get download URL
    if (req.method === 'POST') {
      const { action, publicUrl, path: subPath } = await req.json();

      if (action === 'list') {
        // Get list of files from public folder (with optional subpath)
        let apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&limit=100&preview_size=L&preview_crop=false`;
        if (subPath) {
          apiUrl += `&path=${encodeURIComponent(subPath)}`;
        }
        
        console.log('Fetching folder contents:', publicUrl, subPath || '(root)');
        
        const response = await fetch(apiUrl, { headers: browserHeaders });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Yandex API error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch folder contents', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        
        // Filter for image files and folders
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        const items = data._embedded?.items || [];
        
        const photos = items
          .filter((item: any) => {
            if (item.type === 'dir') return false; // Handle folders separately
            if (item.type !== 'file') return false;
            // Check by mime_type first (more reliable)
            if (item.mime_type && imageMimeTypes.some(mt => item.mime_type.startsWith(mt.split('/')[0]))) {
              return true;
            }
            // Fallback to extension check
            const name = item.name.toLowerCase();
            return imageExtensions.some(ext => name.endsWith(ext));
          })
          .map((item: any) => ({
            id: item.resource_id || item.name,
            name: item.name,
            path: item.path || `/${item.name}`,
            mimeType: item.mime_type,
            size: item.size,
          }));

        // Get subfolders
        const folders = items
          .filter((item: any) => item.type === 'dir')
          .map((item: any) => ({
            id: item.resource_id || item.name,
            name: item.name,
            path: item.path || `/${item.name}`,
          }));

        return new Response(
          JSON.stringify({ photos, folders }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'download') {
        // Get download URL for a specific file (legacy, but kept for compatibility)
        const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(subPath || '/')}`;
        
        const response = await fetch(downloadApiUrl, { headers: browserHeaders });
        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to get download URL' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ downloadUrl: data.href }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to proxy image with streaming (no memory buffering)
async function proxyImageUrl(imageUrl: string): Promise<Response> {
  const response = await fetch(imageUrl, { headers: browserHeaders });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error');
    console.error('Failed to fetch image:', response.status, errorText.substring(0, 200));
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch image', 
        status: response.status,
        details: errorText.substring(0, 200)
      }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const contentType = response.headers.get('Content-Type') || 'image/jpeg';

  // Stream the response body directly without buffering
  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
}
