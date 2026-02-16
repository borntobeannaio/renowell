import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { message_id } = await req.json();
    if (!message_id) throw new Error("message_id required");

    // Fetch the support message
    const { data: msg, error: msgErr } = await supabase
      .from("support_messages")
      .select("id, user_profile_id, content, created_at")
      .eq("id", message_id)
      .single();

    if (msgErr || !msg) throw new Error("Message not found");

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", msg.user_profile_id)
      .single();

    const userName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Пользователь"
      : "Пользователь";

    // Get forward chat id (Anna's Telegram)
    const { data: setting } = await supabase
      .from("bot_settings")
      .select("value")
      .eq("key", "forward_chat_id")
      .single();

    if (!setting?.value) {
      console.log("No forward_chat_id configured");
      return new Response(JSON.stringify({ ok: true, sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send message to Anna's Telegram
    const text = `📩 <b>Поддержка</b>\nОт: ${escapeHtml(userName)}\n\n${escapeHtml(msg.content)}`;

    const tgResp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: setting.value,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    if (!tgResp.ok) {
      const errText = await tgResp.text();
      console.error("Telegram send error:", errText);
      throw new Error(`Telegram API error: ${tgResp.status}`);
    }

    const tgResult = await tgResp.json();
    const telegramMessageId = tgResult.result?.message_id;

    // Save mapping for reply routing
    if (telegramMessageId) {
      await supabase.from("support_telegram_map").upsert({
        telegram_message_id: telegramMessageId,
        user_profile_id: msg.user_profile_id,
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("support-notify error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
