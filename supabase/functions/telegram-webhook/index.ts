import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const update = await req.json();
    console.log("Telegram update received:", JSON.stringify(update));

    // Extract message data
    const message = update.message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    const firstName = message.from?.first_name || "Пользователь";

    // Check if this is a /start command
    if (text === "/start") {
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `👋 Привет, ${firstName}!\n\nДля привязки аккаунта к порталу Renowell:\n\n1. Откройте настройки профиля на портале\n2. Нажмите "Привязать Telegram"\n3. Отправьте мне 6-значный код\n\nПосле привязки вы будете получать уведомления о задачах и упоминаниях.`
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if message is a 6-digit code
    const codeMatch = text.match(/^(\d{6})$/);
    if (!codeMatch) {
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        chatId,
        "❓ Отправьте 6-значный код привязки из портала.\n\nЕсли у вас нет кода, откройте настройки профиля и нажмите 'Привязать Telegram'."
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verificationCode = codeMatch[1];

    // Look for profile with this verification code
    const { data: profiles, error: searchError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, description")
      .like("description", `TELEGRAM_VERIFY:${verificationCode}%`);

    if (searchError) {
      console.error("Error searching profiles:", searchError);
      throw searchError;
    }

    if (!profiles || profiles.length === 0) {
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        chatId,
        "❌ Код не найден или устарел.\n\nПопробуйте получить новый код в настройках профиля на портале."
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = profiles[0];

    // Check if this chat is already linked to another profile
    const { data: existingLink } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("telegram_chat_id", chatId)
      .neq("id", profile.id)
      .single();

    if (existingLink) {
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `⚠️ Этот Telegram уже привязан к другому аккаунту (${existingLink.first_name || ""} ${existingLink.last_name || ""}).\n\nСначала отвяжите его в настройках того профиля.`
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link the Telegram account
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        telegram_chat_id: chatId,
        notify_telegram: true,
        description: null, // Clear verification code
      })
      .eq("id", profile.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      throw updateError;
    }

    const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "пользователь";

    await sendTelegramMessage(
      TELEGRAM_BOT_TOKEN,
      chatId,
      `✅ Telegram успешно привязан!\n\n${userName}, теперь вы будете получать уведомления:\n• О назначенных задачах\n• О приближающихся дедлайнах\n• Об упоминаниях в комментариях\n\nДля отвязки перейдите в настройки профиля на портале.`
    );

    console.log(`Telegram linked: profile ${profile.id} -> chat ${chatId}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
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

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram API error:", errorText);
    throw new Error(`Telegram API error: ${response.status}`);
  }
}
