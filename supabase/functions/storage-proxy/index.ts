import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StorageRequest {
  action: 'upload' | 'download' | 'delete' | 'getPublicUrl' | 'list';
  bucket: string;
  path?: string;
  fileBase64?: string;
  contentType?: string;
  upsert?: boolean;
  paths?: string[];
}

// Create client once at module level for connection reuse
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

console.log('[storage-proxy] Module initialized');

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: StorageRequest = await req.json();
    const { action, bucket, path, fileBase64, contentType, upsert, paths } = body;

    console.log(`[storage-proxy] ${action} ${bucket}/${path || ''}`);
    
    let result: { data: unknown; error: unknown } = { data: null, error: null };
    
    switch (action) {
      case 'upload': {
        if (!path || !fileBase64) {
          throw new Error('Missing path or fileBase64 for upload');
        }
        
        // Decode base64 to Uint8Array
        const binaryString = atob(fileBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, bytes, {
            contentType: contentType || 'application/octet-stream',
            upsert: upsert ?? true,
          });
        
        result = { data, error };
        break;
      }
      
      case 'download': {
        if (!path) {
          throw new Error('Missing path for download');
        }
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(path);
        
        if (data) {
          // Convert blob to base64
          const arrayBuffer = await data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          result = { data: { base64, contentType: data.type }, error: null };
        } else {
          result = { data: null, error };
        }
        break;
      }
      
      case 'delete': {
        if (!paths || paths.length === 0) {
          throw new Error('Missing paths for delete');
        }
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .remove(paths);
        
        result = { data, error };
        break;
      }
      
      case 'getPublicUrl': {
        if (!path) {
          throw new Error('Missing path for getPublicUrl');
        }
        
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);
        
        result = { data, error: null };
        break;
      }
      
      case 'list': {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list(path || '');
        
        result = { data, error };
        break;
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    const duration = Date.now() - startTime;
    
    if (result.error) {
      console.error(`[storage-proxy] Error (${duration}ms):`, result.error);
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[storage-proxy] OK ${action} ${bucket}/${path || ''} (${duration}ms)`);
    
    return new Response(JSON.stringify({ data: result.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    const error = err as Error;
    const duration = Date.now() - startTime;
    console.error(`[storage-proxy] Error (${duration}ms):`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
