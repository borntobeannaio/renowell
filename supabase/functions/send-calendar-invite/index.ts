import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateICS(event: {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_online: boolean;
  organizer_email: string;
  organizer_name: string;
  attendees: { email: string; name: string }[];
  isUpdate?: boolean;
}): string {
  const formatDate = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  // Use event.id as stable UID so mail clients can update existing entries
  const uid = event.id + "@renowell.app";
  const now = formatDate(new Date().toISOString());
  const sequence = event.isUpdate ? 1 : 0;

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Renowell//Calendar//RU
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
SEQUENCE:${sequence}
DTSTAMP:${now}
DTSTART:${formatDate(event.start_time)}
DTEND:${formatDate(event.end_time)}
SUMMARY:${event.title}
ORGANIZER;CN=${event.organizer_name}:mailto:${event.organizer_email}`;

  for (const a of event.attendees) {
    ics += `\nATTENDEE;CN=${a.name};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${a.email}`;
  }

  if (event.description) {
    ics += `\nDESCRIPTION:${event.description.replace(/\n/g, "\\n")}`;
  }
  if (event.location) {
    ics += `\nLOCATION:${event.location}`;
  }

  ics += `\nSTATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  return ics;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_id, update } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isUpdate = !!update;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch event
    const { data: event, error: eventErr } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found", details: eventErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch creator profile
    const { data: creator } = await supabase
      .from("profiles")
      .select("first_name, last_name, user_id")
      .eq("id", event.creator_id)
      .single();

    // Get creator email from auth
    let creatorEmail = "account@renowell.silkagro.ru";
    if (creator?.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(creator.user_id);
      if (authUser?.user?.email) creatorEmail = authUser.user.email;
    }

    const organizerName = creator
      ? [creator.first_name, creator.last_name].filter(Boolean).join(" ") || "Реновель"
      : "Реновель";

    // Get participant emails
    const participantIds: string[] = event.participant_ids || [];
    if (participantIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: participants } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name")
      .in("id", participantIds);

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails from auth
    const emails: { email: string; name: string }[] = [];
    for (const p of participants) {
      if (p.user_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);
        if (authUser?.user?.email) {
          emails.push({
            email: authUser.user.email,
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Коллега",
          });
        }
      }
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format date for email
    const startDate = new Date(event.start_time);
    const formattedDate = startDate.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    const subjectPrefix = isUpdate ? "Обновление" : "Приглашение";

    // Send emails via Resend — one per recipient with personalized ICS
    let sentCount = 0;
    for (let i = 0; i < emails.length; i++) {
      const recipient = emails[i];
      try {
        const ics = generateICS({
          id: event.id,
          title: event.title,
          description: event.description,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          is_online: event.is_online,
          organizer_email: "account@renowell.silkagro.ru",
          organizer_name: organizerName,
          attendees: emails,
          isUpdate,
        });

        const icsBase64 = btoa(unescape(encodeURIComponent(ics)));

        const emailPayload = {
          from: "Реновель Портал <account@renowell.silkagro.ru>",
          to: [recipient.email],
          subject: `${subjectPrefix}: ${event.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">📅 ${event.title}</h2>
              ${isUpdate ? '<p style="color: #e67e22; font-weight: bold;">⚡ Встреча обновлена</p>' : ""}
              <p><strong>Когда:</strong> ${formattedDate}</p>
              ${event.location ? `<p><strong>Где:</strong> ${event.location}</p>` : ""}
              ${event.is_online ? "<p><strong>Формат:</strong> Онлайн</p>" : ""}
              ${event.description ? `<p>${event.description}</p>` : ""}
              <p style="color: #666;">Организатор: ${organizerName}</p>
            </div>
          `,
          attachments: [
            {
              filename: "invite.ics",
              content: icsBase64,
              content_type: "text/calendar; method=REQUEST; charset=UTF-8",
              headers: { "Content-Disposition": 'inline; filename="invite.ics"' },
            },
          ],
        };

        const sendEmail = () =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailPayload),
          });

        let res = await sendEmail();

        // Retry once on rate limit (429)
        if (res.status === 429) {
          console.warn(`Rate limited for ${recipient.email}, retrying in 1.5s...`);
          await res.text();
          await delay(1500);
          res = await sendEmail();
        }

        if (res.ok) {
          sentCount++;
          await res.text();
        } else {
          console.error(`Resend error for ${recipient.email}:`, await res.text());
        }
      } catch (e) {
        console.error(`Failed to send to ${recipient.email}:`, e);
      }

      // Throttle: 600ms pause between sends to stay under 2 req/s
      if (i < emails.length - 1) {
        await delay(600);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: emails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-calendar-invite error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
