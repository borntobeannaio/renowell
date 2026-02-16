import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL_USERNAME = "oparinandrey_renowell";
const FORWARD_TARGET_USERNAME = "anna_sirum";

serve(async (req) => {
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

    // Handle channel posts
    const channelPost = update.channel_post;
    if (channelPost) {
      const chat = channelPost.chat;
      console.log("Channel post from:", chat.username);
      if (chat.username === CHANNEL_USERNAME) {
        await processChannelPost(supabase, TELEGRAM_BOT_TOKEN, channelPost);
        console.log("Channel post processed successfully");
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle regular messages
    const message = update.message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    const firstName = message.from?.first_name || "Пользователь";
    const username = message.from?.username;

    // Auto-detect forward target by username
    if (username === FORWARD_TARGET_USERNAME) {
      await saveForwardChatId(supabase, chatId);
      console.log(`Saved forward_chat_id: ${chatId} for @${FORWARD_TARGET_USERNAME}`);

      // Check if this is a reply to a support message
      const replyTo = message.reply_to_message as { message_id: number } | undefined;
      if (replyTo?.message_id && text) {
        const handled = await handleSupportReply(supabase, replyTo.message_id, text);
        if (handled) {
          console.log("Support reply handled successfully");
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Forward message to admin (unless it's from admin herself)
    if (username !== FORWARD_TARGET_USERNAME) {
      await forwardMessageToAdmin(supabase, TELEGRAM_BOT_TOKEN, message);
    }

    // Process commands and linking as before
    await handleUserMessage(supabase, TELEGRAM_BOT_TOKEN, chatId, text, firstName, message);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Forwarding logic ---

async function saveForwardChatId(supabase: ReturnType<typeof createClient>, chatId: string) {
  const { error } = await supabase
    .from("bot_settings")
    .upsert({ key: "forward_chat_id", value: chatId }, { onConflict: "key" });
  if (error) console.error("Error saving forward_chat_id:", error);
}

async function getForwardChatId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from("bot_settings")
    .select("value")
    .eq("key", "forward_chat_id")
    .single();
  if (error || !data) return null;
  return data.value;
}

async function forwardMessageToAdmin(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  message: Record<string, unknown>
) {
  try {
    const forwardChatId = await getForwardChatId(supabase);
    if (!forwardChatId) {
      console.log("No forward_chat_id configured, skipping forwarding");
      return;
    }

    const chatId = (message.chat as { id: number }).id;
    const messageId = message.message_id as number;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/forwardMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: forwardChatId,
          from_chat_id: chatId,
          message_id: messageId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Forward message error:", errorText);
    } else {
      console.log(`Message forwarded to ${forwardChatId}`);
    }
  } catch (err) {
    console.error("Error forwarding message:", err);
  }
}

// --- User message handling ---

async function handleUserMessage(
  supabase: ReturnType<typeof createClient>,
  botToken: string,
  chatId: string,
  text: string,
  firstName: string,
  _message: Record<string, unknown>
) {
  if (text === "/start") {
    await sendTelegramMessage(
      botToken,
      chatId,
      `👋 Привет, ${firstName}!\n\nДля привязки аккаунта к порталу Renowell:\n\n1. Откройте настройки профиля на портале\n2. Нажмите "Привязать Telegram"\n3. Отправьте мне 6-значный код\n\nПосле привязки вы будете получать уведомления о задачах и упоминаниях.`
    );
    return;
  }

  const codeMatch = text.match(/^(\d{6})$/);
  if (!codeMatch) {
    await sendTelegramMessage(
      botToken,
      chatId,
      "❓ Отправьте 6-значный код привязки из портала.\n\nЕсли у вас нет кода, откройте настройки профиля и нажмите 'Привязать Telegram'."
    );
    return;
  }

  const verificationCode = codeMatch[1];

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
      botToken,
      chatId,
      "❌ Код не найден или устарел.\n\nПопробуйте получить новый код в настройках профиля на портале."
    );
    return;
  }

  const profile = profiles[0];

  const { data: existingLink } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("telegram_chat_id", chatId)
    .neq("id", profile.id)
    .single();

  if (existingLink) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `⚠️ Этот Telegram уже привязан к другому аккаунту (${existingLink.first_name || ""} ${existingLink.last_name || ""}).\n\nСначала отвяжите его в настройках того профиля.`
    );
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      telegram_chat_id: chatId,
      notify_telegram: true,
      description: null,
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Error updating profile:", updateError);
    throw updateError;
  }

  const userName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "пользователь";

  await sendTelegramMessage(
    botToken,
    chatId,
    `✅ Telegram успешно привязан!\n\n${userName}, теперь вы будете получать уведомления:\n• О назначенных задачах\n• О приближающихся дедлайнах\n• Об упоминаниях в комментариях\n\nДля отвязки перейдите в настройки профиля на портале.`
  );

  console.log(`Telegram linked: profile ${profile.id} -> chat ${chatId}`);
}

// --- Channel post processing ---

async function processChannelPost(
  supabase: ReturnType<typeof createClient>,
  _botToken: string,
  post: Record<string, unknown>
): Promise<void> {
  const messageId = post.message_id as number;
  const text = (post.text as string) || (post.caption as string) || null;
  const date = new Date((post.date as number) * 1000).toISOString();

  console.log(`Processing channel post ${messageId}: ${text?.substring(0, 50)}...`);

  let fileId: string | null = null;
  const photo = post.photo as Array<{ file_id: string; width: number; height: number }> | undefined;
  if (photo && photo.length > 0) {
    fileId = photo[photo.length - 1].file_id;
    console.log(`Got photo file_id: ${fileId}`);
  }

  let videoFileId: string | null = null;
  const video = post.video as { file_id: string } | undefined;
  if (video?.file_id) {
    videoFileId = video.file_id;
    console.log(`Got video file_id: ${videoFileId}`);
  }

  const { error } = await supabase
    .from("telegram_posts")
    .upsert({
      message_id: messageId,
      text,
      date,
      file_id: fileId,
      video_file_id: videoFileId,
      image_url: null,
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

// --- Support reply handling ---

async function handleSupportReply(
  supabase: ReturnType<typeof createClient>,
  replyToMessageId: number,
  text: string
): Promise<boolean> {
  try {
    // Look up the mapping
    const { data: mapping, error } = await supabase
      .from("support_telegram_map")
      .select("user_profile_id")
      .eq("telegram_message_id", replyToMessageId)
      .single();

    if (error || !mapping) {
      console.log("No support mapping found for message_id:", replyToMessageId);
      return false;
    }

    // Insert incoming support message
    const { error: insertError } = await supabase
      .from("support_messages")
      .insert({
        user_profile_id: mapping.user_profile_id,
        direction: "incoming",
        content: text,
      });

    if (insertError) {
      console.error("Error inserting support reply:", insertError);
      return false;
    }

    console.log(`Support reply inserted for profile ${mapping.user_profile_id}`);
    return true;
  } catch (err) {
    console.error("handleSupportReply error:", err);
    return false;
  }
}

// --- Telegram API helpers ---

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram API error:", errorText);
    throw new Error(`Telegram API error: ${response.status}`);
  }
}
