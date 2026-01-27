import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL not configured");
    }

    // Construct webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

    // Set webhook via Telegram API
    const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;

    const response = await fetch(setWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    });

    const result = await response.json();
    console.log("Telegram setWebhook response:", result);

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }

    // Get webhook info to confirm
    const getInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
    const infoResponse = await fetch(getInfoUrl);
    const webhookInfo = await infoResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Telegram webhook configured successfully",
        webhook_url: webhookUrl,
        webhook_info: webhookInfo.result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Setup error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
