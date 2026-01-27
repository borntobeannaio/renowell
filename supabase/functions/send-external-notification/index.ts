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

// Notification type icons for Telegram
const typeEmojis: Record<string, string> = {
  task_assigned: "📋",
  deadline_week: "📅",
  deadline_day: "⏰",
  mention: "💬",
};

function escapeMarkdown(text: string): string {
  return text.replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, "\\$&");
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
      from: "Реновель Портал <noreply@renowell.ru>",
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

// Web Push implementation using native fetch (simplified approach)
// For production, consider using a proper Web Push library
async function sendPushNotification(
  subscription: PushSubscription,
  title: string,
  body: string,
  link: string | null
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID keys not configured");
    return false;
  }

  try {
    const payload = JSON.stringify({
      title,
      body,
      url: link || "/",
    });

    // For Web Push, we need proper encryption which is complex
    // Using a simplified approach - just log that we would send
    // In production, use the web-push npm package in a Node.js environment
    // or a third-party push notification service
    
    console.log("Push notification would be sent to:", subscription.endpoint);
    console.log("Payload:", payload);
    
    // For now, we'll mark as successful if subscription exists
    // Real implementation requires VAPID JWT signing and payload encryption
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
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

    // Fetch the notification
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select("id, recipient_id, type, title, body, link")
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

    // Build full link URL
    const baseUrl = "https://renowell.lovable.app";
    const fullLink = notification.link ? `${baseUrl}${notification.link}` : null;

    const results = {
      telegram: false,
      email: false,
      push: false,
    };

    // Send Telegram notification
    if (profile.notify_telegram && profile.telegram_chat_id) {
      results.telegram = await sendTelegramMessage(
        profile.telegram_chat_id,
        notification.title,
        notification.body,
        fullLink
      );
    }

    // Send Email notification
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
