import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      const imageUrl = url.searchParams.get('url');
      
      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing url parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Proxying image:', imageUrl);
      
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch image:', response.status, response.statusText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch image', status: response.status }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const contentType = response.headers.get('Content-Type') || 'image/jpeg';
      const body = await response.arrayBuffer();

      return new Response(body, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        },
      });
    }

    // POST request — list files or get download URL
    if (req.method === 'POST') {
      const { action, publicUrl, path } = await req.json();

      if (action === 'list') {
        // Get list of files from public folder
        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicUrl)}&limit=100&preview_size=L&preview_crop=false`;
        
        console.log('Fetching folder contents:', publicUrl);
        
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Yandex API error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch folder contents', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        
        // Filter only image files
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const items = data._embedded?.items || [];
        
        // Process items and get download URLs for each
        const photos = await Promise.all(
          items
            .filter((item: any) => {
              if (item.type !== 'file') return false;
              const name = item.name.toLowerCase();
              return imageExtensions.some(ext => name.endsWith(ext));
            })
            .map(async (item: any) => {
              // Get download URL for full-size image
              let downloadUrl = null;
              try {
                const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent('/' + item.name)}`;
                const downloadResponse = await fetch(downloadApiUrl);
                if (downloadResponse.ok) {
                  const downloadData = await downloadResponse.json();
                  downloadUrl = downloadData.href;
                }
              } catch (e) {
                console.error('Failed to get download URL for', item.name, e);
              }

              return {
                id: item.resource_id || item.name,
                name: item.name,
                preview: item.preview || null,
                downloadUrl: downloadUrl,
              };
            })
        );

        return new Response(
          JSON.stringify({ photos: photos.filter(p => p.preview || p.downloadUrl) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'download') {
        // Get download URL for a specific file
        const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}&path=${encodeURIComponent(path)}`;
        
        const response = await fetch(downloadApiUrl);
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
