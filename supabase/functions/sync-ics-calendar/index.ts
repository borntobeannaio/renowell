import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location?: string;
  description?: string;
}

/** Minimal ICS parser — extracts VEVENT blocks */
function parseICS(raw: string): VEvent[] {
  const events: VEvent[] = [];
  
  // Normalize line endings first
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Unfold continuation lines globally (RFC 5545 §3.1)
  const unfolded = normalized.replace(/\n[ \t]/g, "");
  
  const blocks = unfolded.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const get = (key: string): string | undefined => {
      const regex = new RegExp(`^${key}[;:](.*)$`, "m");
      const m = block.match(regex);
      if (!m) return undefined;
      const val = m[1];
      // Strip parameters for date fields (e.g. DTSTART;TZID=...:20250101T090000)
      if (key.startsWith("DT")) {
        const colonIdx = val.lastIndexOf(":");
        return colonIdx > -1 ? val.substring(colonIdx + 1) : val;
      }
      return val.trim();
    };

    const uid = get("UID");
    const summary = get("SUMMARY") || "Без названия";
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");

    if (!uid || !dtstart) {
      console.log(`[sync-ics] Skipping event: uid=${uid}, dtstart=${dtstart}, summary=${summary}`);
      continue;
    }

    events.push({
      uid,
      summary,
      dtstart,
      dtend: dtend || dtstart,
      location: get("LOCATION"),
      description: get("DESCRIPTION"),
    });
  }
  return events;
}

/** Convert ICS date string to ISO 8601 */
function icsDateToISO(d: string): string {
  // Formats: 20250115T090000Z  or  20250115T090000  or  20250115
  if (d.length === 8) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`;
  }
  const base = d.replace("Z", "");
  const iso = `${base.slice(0, 4)}-${base.slice(4, 6)}-${base.slice(6, 8)}T${base.slice(9, 11)}:${base.slice(11, 13)}:${base.slice(13, 15)}`;
  return d.endsWith("Z") ? iso + "Z" : iso + "Z"; // treat naive as UTC
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all profiles with ics_url set
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, ics_url")
      .not("ics_url", "is", null)
      .neq("ics_url", "");

    if (profilesErr) throw profilesErr;
    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No profiles with ICS URLs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { profile_id: string; synced: number; deleted: number; error?: string }[] = [];

    for (const profile of profiles) {
      try {
        // Fetch ICS file
        const resp = await fetch(profile.ics_url, {
          headers: { "User-Agent": "Renowell-Calendar-Sync/1.0" },
        });
        if (!resp.ok) {
          results.push({ profile_id: profile.id, synced: 0, deleted: 0, error: `HTTP ${resp.status}` });
          continue;
        }

        const icsText = await resp.text();
        console.log(`[sync-ics] Profile ${profile.id}: fetched ${icsText.length} bytes, first 200 chars: ${icsText.substring(0, 200)}`);
        const vevents = parseICS(icsText);
        console.log(`[sync-ics] Profile ${profile.id}: parsed ${vevents.length} events`);

        // Upsert events
        let synced = 0;
        const currentUids: string[] = [];

        for (const ev of vevents) {
          currentUids.push(ev.uid);

          const eventData = {
            creator_id: profile.id,
            external_uid: ev.uid,
            title: ev.summary.substring(0, 500),
            description: ev.description?.substring(0, 2000) || null,
            start_time: icsDateToISO(ev.dtstart),
            end_time: icsDateToISO(ev.dtend),
            location: ev.location?.substring(0, 500) || null,
            is_online: false,
            source: "external",
            participant_ids: [],
          };

          const { error: upsertErr } = await supabase
            .from("calendar_events")
            .upsert(eventData, {
              onConflict: "creator_id,external_uid",
              ignoreDuplicates: false,
            });

          if (upsertErr) {
            console.error(`[sync-ics] Upsert error for uid=${ev.uid}:`, upsertErr.message, upsertErr.details, upsertErr.hint);
          } else {
            synced++;
          }
        }

        // Delete events that are no longer in the ICS file
        let deleted = 0;
        if (currentUids.length > 0) {
          const { data: deletedRows } = await supabase
            .from("calendar_events")
            .delete()
            .eq("creator_id", profile.id)
            .eq("source", "external")
            .not("external_uid", "in", `(${currentUids.map((u) => `"${u}"`).join(",")})`)
            .select("id");
          deleted = deletedRows?.length || 0;
        } else {
          // No events in ICS — delete all external events for this user
          const { data: deletedRows } = await supabase
            .from("calendar_events")
            .delete()
            .eq("creator_id", profile.id)
            .eq("source", "external")
            .select("id");
          deleted = deletedRows?.length || 0;
        }

        results.push({ profile_id: profile.id, synced, deleted });
      } catch (err) {
        results.push({
          profile_id: profile.id,
          synced: 0,
          deleted: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
