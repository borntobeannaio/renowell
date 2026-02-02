import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL_USERNAME = "oparinandrey_renowell";

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

    // Handle channel posts (blog posts from the leader's channel)
    const channelPost = update.channel_post;
    if (channelPost) {
      const chat = channelPost.chat;
      console.log("Channel post from:", chat.username);
      
      // Check if it's from our target channel
      if (chat.username === CHANNEL_USERNAME) {
        await processChannelPost(supabase, TELEGRAM_BOT_TOKEN, channelPost);
        console.log("Channel post processed successfully");
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle regular messages (for account linking)
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

// Process channel posts and save to database
async function processChannelPost(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  _botToken: string,
  post: Record<string, unknown>
): Promise<void> {
  const messageId = post.message_id as number;
  const text = (post.text as string) || (post.caption as string) || null;
  const date = new Date((post.date as number) * 1000).toISOString();
  
  console.log(`Processing channel post ${messageId}: ${text?.substring(0, 50)}...`);
  
  // Get photo file_id if present (save stable identifier, not temporary URL)
  let fileId: string | null = null;
  const photo = post.photo as Array<{ file_id: string; width: number; height: number }> | undefined;
  if (photo && photo.length > 0) {
    // Get the largest photo (last in array)
    const largestPhoto = photo[photo.length - 1];
    fileId = largestPhoto.file_id;
    console.log(`Got photo file_id: ${fileId}`);
  }
  
  // Get video file_id if present
  let videoFileId: string | null = null;
  const video = post.video as { file_id: string; thumb?: { file_id: string } } | undefined;
  if (video?.file_id) {
    videoFileId = video.file_id;
    console.log(`Got video file_id: ${videoFileId}`);
  }
  
  // Upsert to database with stable file_id instead of temporary URLs
  const { error } = await supabase
    .from("telegram_posts")
    .upsert({
      message_id: messageId,
      text,
      date,
      file_id: fileId,
      video_file_id: videoFileId,
      image_url: null, // No longer storing temporary URLs
      video_url: null,
      link: `https://t.me/${CHANNEL_USERNAME}/${messageId}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "message_id" });
  
  if (error) {
    console.error("Error upserting channel post:", error);
    throw error;
  }
  
  console.log(`Channel post ${messageId} saved to database`);
}

// Get file URL from Telegram servers
async function getFileUrl(botToken: string, fileId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    
    const data = await response.json();
    
    if (data.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
    }
    
    console.error("Failed to get file path:", data);
    return null;
  } catch (error) {
    console.error("Error getting file URL:", error);
    return null;
  }
}

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
