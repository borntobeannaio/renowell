import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Resend
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

interface NotificationPayload {
  notification_id: string;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface ChatAttachment {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

// Notification type icons for Telegram
const typeEmojis: Record<string, string> = {
  task_assigned: "📋",
  deadline_week: "📅",
  deadline_day: "⏰",
  mention: "💬",
  chat_message: "💬",
  chat_created: "👥",
};

function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(
  chatId: string,
  title: string,
  body: string,
  link: string | null
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const emoji = typeEmojis[title] || "🔔";
    let text = `${emoji} *${escapeMarkdown(title)}*\n\n${escapeMarkdown(body)}`;

    if (link) {
      text += `\n\n[Открыть →](${link})`;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "MarkdownV2",
          disable_web_page_preview: true,
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
      return false;
    }

    console.log("Telegram message sent successfully to:", chatId);
    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption: string | null
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption || undefined,
          parse_mode: "HTML",
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram sendPhoto error:", result);
      return false;
    }

    console.log("Telegram photo sent successfully to:", chatId);
    return true;
  } catch (error) {
    console.error("Error sending Telegram photo:", error);
    return false;
  }
}

async function sendTelegramDocument(
  chatId: string,
  documentUrl: string,
  fileName: string,
  caption: string | null
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          document: documentUrl,
          caption: caption || undefined,
          parse_mode: "HTML",
        }),
      }
    );

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram sendDocument error:", result);
      return false;
    }

    console.log("Telegram document sent successfully to:", chatId);
    return true;
  } catch (error) {
    console.error("Error sending Telegram document:", error);
    return false;
  }
}

async function sendTelegramNotification(
  chatId: string,
  title: string,
  body: string,
  link: string | null,
  attachments: ChatAttachment[] | null
): Promise<boolean> {
  // If no attachments, send regular text message
  if (!attachments || attachments.length === 0) {
    return await sendTelegramMessage(chatId, title, body, link);
  }

  // Build HTML caption for media messages
  const emoji = typeEmojis[title] || "🔔";
  let caption = `${emoji} <b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
  if (link) {
    caption += `\n\n<a href="${link}">Открыть →</a>`;
  }

  // Telegram caption limit is 1024 characters
  if (caption.length > 1024) {
    caption = caption.substring(0, 1020) + "...";
  }

  // Send first attachment with caption
  const first = attachments[0];
  let success = false;

  if (first.contentType.startsWith("image/")) {
    success = await sendTelegramPhoto(chatId, first.url, caption);
  } else {
    success = await sendTelegramDocument(chatId, first.url, first.fileName, caption);
  }

  // Send remaining attachments without caption
  for (let i = 1; i < attachments.length; i++) {
    const att = attachments[i];
    if (att.contentType.startsWith("image/")) {
      await sendTelegramPhoto(chatId, att.url, null);
    } else {
      await sendTelegramDocument(chatId, att.url, att.fileName, null);
    }
  }

  return success;
}

async function sendEmail(
  to: string,
  title: string,
  body: string,
  link: string | null
): Promise<boolean> {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #052A6E; font-size: 20px; margin: 0 0 16px 0; }
            p { color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0; }
            .button { display: inline-block; background: #052A6E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
            .footer { text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <h1>${title}</h1>
              <p>${body}</p>
              ${link ? `<a href="${link}" class="button">Открыть в портале</a>` : ""}
            </div>
            <div class="footer">
              <p>Реновель — Внутренний портал</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Реновель Портал <account@renowell.silkagro.ru>",
      to: [to],
      subject: title,
      html: htmlContent,
    });

    console.log("Email sent successfully to:", to, emailResponse);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// Web Push implementation - temporarily disabled due to Deno compatibility issues
async function sendPushNotification(
  subscription: PushSubscription,
  title: string,
  body: string,
  link: string | null
): Promise<boolean> {
  console.log("Push notification requested (currently disabled):", {
    endpoint: subscription.endpoint,
    title,
    body,
    link,
  });
  
  console.warn(
    "Web Push notifications are temporarily disabled. " +
    "Please use Telegram or email notifications instead."
  );
  
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notification_id } = (await req.json()) as NotificationPayload;

    if (!notification_id) {
      return new Response(
        JSON.stringify({ error: "notification_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key for full access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the notification with attachments
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("id, recipient_id, type, title, body, link, attachments")
      .eq("id", notification_id)
      .single();

    if (notifError || !notification) {
      console.error("Error fetching notification:", notifError);
      return new Response(
        JSON.stringify({ error: "Notification not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipient's profile with notification settings
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, telegram_chat_id, notify_telegram, notify_email, notify_push, push_subscription")
      .eq("id", notification.recipient_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch employee email if email notifications are enabled
    let employeeEmail: string | null = null;
    if (profile.notify_email) {
      const { data: employee } = await supabase
        .from("employees")
        .select("email")
        .eq("profile_id", profile.id)
        .single();

      employeeEmail = employee?.email || null;
    }

    // Build full link URL - use custom domain from environment or default
    const baseUrl = Deno.env.get("APP_URL") || "https://renowell.silkagro.ru";
    
    // Handle chat links specially - they use #chat:id format which should open in-app
    let fullLink: string | null = null;
    if (notification.link) {
      if (notification.link.startsWith("#chat:")) {
        // Chat links should redirect to the main app which will handle opening the chat
        fullLink = `${baseUrl}/?open_chat=${notification.link.replace("#chat:", "")}`;
      } else {
        fullLink = `${baseUrl}${notification.link}`;
      }
    }

    const results = {
      telegram: false,
      email: false,
      push: false,
    };

    // Parse attachments
    const attachments = notification.attachments as ChatAttachment[] | null;

    // Send Telegram notification with attachments support
    if (profile.notify_telegram && profile.telegram_chat_id) {
      results.telegram = await sendTelegramNotification(
        profile.telegram_chat_id,
        notification.title,
        notification.body,
        fullLink,
        attachments
      );
    }

    // Send Email notification (without attachments - just link to chat)
    if (profile.notify_email && employeeEmail) {
      results.email = await sendEmail(
        employeeEmail,
        notification.title,
        notification.body,
        fullLink
      );
    }

    // Send Push notification
    if (profile.notify_push && profile.push_subscription) {
      results.push = await sendPushNotification(
        profile.push_subscription as PushSubscription,
        notification.title,
        notification.body,
        fullLink
      );
    }

    console.log("External notifications sent:", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-external-notification:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});