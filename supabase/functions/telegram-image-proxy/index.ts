import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveFileUrl(fileId: string): Promise<{ fileUrl: string; contentType: string }> {
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }

  const getFileResponse = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );

  if (!getFileResponse.ok) {
    throw new Error("Failed to get file from Telegram");
  }

  const getFileData = await getFileResponse.json();

  if (!getFileData.ok || !getFileData.result?.file_path) {
    throw new Error("File not found in Telegram");
  }

  const filePath = getFileData.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

  // Guess content type from extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", mp4: "video/mp4",
  };
  const contentType = mimeMap[ext || ""] || "image/jpeg";

  return { fileUrl, contentType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST mode: return base64-encoded data (for Yandex Cloud proxy routing)
    if (req.method === "POST") {
      const body = await req.json();
      const fileId = body.file_id || body.fileId;

      if (!fileId) {
        return new Response(
          JSON.stringify({ error: "file_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[POST] Proxying Telegram file: ${fileId}`);

      const { fileUrl, contentType } = await resolveFileUrl(fileId);
      const imageResponse = await fetch(fileUrl);

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const base64 = base64Encode(new Uint8Array(arrayBuffer));

      return new Response(
        JSON.stringify({ base64, contentType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET mode: stream binary data directly (legacy, used when Supabase is accessible)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const fileId = url.searchParams.get("file_id");

      if (!fileId) {
        return new Response(
          JSON.stringify({ error: "file_id parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[GET] Proxying Telegram file: ${fileId}`);

      const { fileUrl } = await resolveFileUrl(fileId);
      const imageResponse = await fetch(fileUrl);

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const responseContentType = imageResponse.headers.get("Content-Type") || "image/jpeg";

      return new Response(imageResponse.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": responseContentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Telegram image proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
