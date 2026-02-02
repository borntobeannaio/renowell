import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id");

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "file_id parameter is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Proxying Telegram file: ${fileId}`);

    // 1. Get fresh file_path from Telegram Bot API
    const getFileResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    );

    if (!getFileResponse.ok) {
      console.error("Failed to get file from Telegram:", await getFileResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to get file from Telegram" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const getFileData = await getFileResponse.json();

    if (!getFileData.ok || !getFileData.result?.file_path) {
      console.error("Telegram API error:", getFileData);
      return new Response(
        JSON.stringify({ error: "File not found in Telegram" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const filePath = getFileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

    console.log(`Fetching file from: ${fileUrl}`);

    // 2. Fetch the actual image
    const imageResponse = await fetch(fileUrl);

    if (!imageResponse.ok) {
      console.error("Failed to fetch image:", imageResponse.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch image from Telegram" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Determine content type
    const contentType = imageResponse.headers.get("Content-Type") || "image/jpeg";

    // 4. Stream the response with caching
    return new Response(imageResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error: unknown) {
    console.error("Telegram image proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
