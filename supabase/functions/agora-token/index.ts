import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple RTC token generator for Agora
// For production, use the official Agora token builder
function generateSimpleToken(appId: string, channelName: string, uid: number): string {
  // This is a simplified approach - for production, implement full RtcTokenBuilder
  // or use Agora's token server
  return `${appId}_${channelName}_${uid}_${Date.now()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelName, uid } = await req.json();
    
    const appId = Deno.env.get('AGORA_APP_ID');
    
    if (!appId) {
      throw new Error('AGORA_APP_ID not configured');
    }

    if (!channelName) {
      throw new Error('Channel name is required');
    }

    // For App ID only mode (no certificate), we don't need a token
    // Just return the app ID and channel info
    return new Response(
      JSON.stringify({
        appId,
        channelName,
        uid: uid || 0,
        token: null, // No token needed for App ID only mode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
