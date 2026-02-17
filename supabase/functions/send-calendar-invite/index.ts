import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateICS(event: {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_online: boolean;
  organizer_email: string;
  organizer_name: string;
  attendees: { email: string; name: string }[];
}): string {
  const formatDate = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const uid = crypto.randomUUID() + "@renowell.app";
  const now = formatDate(new Date().toISOString());

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Renowell//Calendar//RU
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Send emails via Resend — one per recipient with personalized ICS
    let sentCount = 0;
    for (const recipient of emails) {
      try {
        // Generate ICS with all attendees for each recipient
        const ics = generateICS({
          title: event.title,
          description: event.description,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
          is_online: event.is_online,
          organizer_email: "account@renowell.silkagro.ru",
          organizer_name: organizerName,
          attendees: emails,
        });

        const icsBase64 = btoa(unescape(encodeURIComponent(ics)));

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Реновель Портал <account@renowell.silkagro.ru>",
            to: [recipient.email],
            subject: `Приглашение: ${event.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">📅 ${event.title}</h2>
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
                headers: {
                  "Content-Disposition": 'inline; filename="invite.ics"',
                },
              },
            ],
          }),
        });

        if (res.ok) sentCount++;
        else console.error(`Resend error for ${recipient.email}:`, await res.text());
      } catch (e) {
        console.error(`Failed to send to ${recipient.email}:`, e);
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
