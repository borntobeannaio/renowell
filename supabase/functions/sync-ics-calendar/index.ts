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
  rrule?: string;
  exdates?: string[];
}

interface ExpandedEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location?: string;
  description?: string;
}

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

/** Parse RRULE string into structured params */
function parseRRule(rrule: string): {
  freq: string;
  interval: number;
  count?: number;
  until?: Date;
  byday?: number[];
} {
  const params: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) params[k.toUpperCase()] = v;
  }

  return {
    freq: params.FREQ || "DAILY",
    interval: params.INTERVAL ? parseInt(params.INTERVAL, 10) : 1,
    count: params.COUNT ? parseInt(params.COUNT, 10) : undefined,
    until: params.UNTIL ? parseDateOnly(params.UNTIL) : undefined,
    byday: params.BYDAY
      ? params.BYDAY.split(",").map((d) => DAY_MAP[d.trim().toUpperCase()]).filter((n) => n !== undefined)
      : undefined,
  };
}

/** Parse ICS date to Date object (UTC) */
function parseDateOnly(d: string): Date {
  const base = d.replace("Z", "");
  if (base.length === 8) {
    return new Date(Date.UTC(+base.slice(0, 4), +base.slice(4, 6) - 1, +base.slice(6, 8)));
  }
  return new Date(Date.UTC(
    +base.slice(0, 4), +base.slice(4, 6) - 1, +base.slice(6, 8),
    +base.slice(9, 11), +base.slice(11, 13), +base.slice(13, 15)
  ));
}

/** Format Date to YYYYMMDD */
function formatYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Advance a date by the recurrence rule's frequency */
function advanceDate(d: Date, freq: string, interval: number): Date {
  const next = new Date(d.getTime());
  switch (freq) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + interval);
      break;
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7 * interval);
      break;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + interval);
      break;
    case "YEARLY":
      next.setUTCFullYear(next.getUTCFullYear() + interval);
      break;
  }
  return next;
}

const MAX_INSTANCES = 200;
const HORIZON_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months

/** Expand a recurring event into individual occurrences */
function expandRRule(
  dtstart: string,
  dtend: string,
  rrule: string,
  exdates: string[]
): { dtstart: string; dtend: string; dateSuffix: string }[] {
  const rule = parseRRule(rrule);
  const start = parseDateOnly(dtstart);
  const end = parseDateOnly(dtend);
  const durationMs = end.getTime() - start.getTime();
  const horizon = new Date(Date.now() + HORIZON_MS);

  // Build exdate set (YYYYMMDD)
  const exSet = new Set(exdates.map((e) => formatYMD(parseDateOnly(e))));

  const results: { dtstart: string; dtend: string; dateSuffix: string }[] = [];

  if (rule.freq === "WEEKLY" && rule.byday && rule.byday.length > 0) {
    // For WEEKLY+BYDAY: iterate week by week, emit for each matching day
    let weekStart = new Date(start.getTime());
    // Align weekStart to the start of the week (Sunday)
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    
    let count = 0;
    const maxCount = rule.count;

    outer:
    while (results.length < MAX_INSTANCES) {
      for (const dayNum of rule.byday.sort((a, b) => a - b)) {
        const candidate = new Date(weekStart.getTime());
        candidate.setUTCDate(candidate.getUTCDate() + dayNum);

        // Skip dates before the original start
        if (candidate < start) continue;
        // Check horizon and UNTIL
        if (candidate > horizon) break outer;
        if (rule.until && candidate > rule.until) break outer;
        // Check COUNT
        if (maxCount !== undefined && count >= maxCount) break outer;

        count++;
        const ymd = formatYMD(candidate);
        if (exSet.has(ymd)) continue;

        const instanceEnd = new Date(candidate.getTime() + durationMs);
        results.push({
          dtstart: candidate.toISOString(),
          dtend: instanceEnd.toISOString(),
          dateSuffix: ymd,
        });
      }
      // Advance by interval weeks
      weekStart.setUTCDate(weekStart.getUTCDate() + 7 * rule.interval);
    }
  } else {
    // Simple frequency: DAILY, WEEKLY (no BYDAY), MONTHLY, YEARLY
    let current = new Date(start.getTime());
    let count = 0;

    while (results.length < MAX_INSTANCES) {
      if (current > horizon) break;
      if (rule.until && current > rule.until) break;
      if (rule.count !== undefined && count >= rule.count) break;

      count++;
      const ymd = formatYMD(current);
      if (!exSet.has(ymd)) {
        const instanceEnd = new Date(current.getTime() + durationMs);
        results.push({
          dtstart: current.toISOString(),
          dtend: instanceEnd.toISOString(),
          dateSuffix: ymd,
        });
      }

      current = advanceDate(current, rule.freq, rule.interval);
    }
  }

  return results;
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
      if (key.startsWith("DT") || key === "UNTIL") {
        const colonIdx = val.lastIndexOf(":");
        return colonIdx > -1 ? val.substring(colonIdx + 1) : val;
      }
      return val.trim();
    };

    const uid = get("UID");
    const summary = get("SUMMARY") || "Без названия";
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");
    const rrule = get("RRULE");

    // Collect EXDATE entries (there can be multiple)
    const exdates: string[] = [];
    const exdateRegex = /^EXDATE[;:](.*)$/gm;
    let exMatch;
    while ((exMatch = exdateRegex.exec(block)) !== null) {
      const val = exMatch[1];
      // Strip params, may contain multiple dates comma-separated
      const colonIdx = val.lastIndexOf(":");
      const dateStr = colonIdx > -1 ? val.substring(colonIdx + 1) : val;
      for (const d of dateStr.split(",")) {
        if (d.trim()) exdates.push(d.trim());
      }
    }

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
      rrule: rrule || undefined,
      exdates: exdates.length > 0 ? exdates : undefined,
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
        console.log(`[sync-ics] Profile ${profile.id}: fetched ${icsText.length} bytes`);
        const vevents = parseICS(icsText);
        console.log(`[sync-ics] Profile ${profile.id}: parsed ${vevents.length} VEVENTs (before RRULE expansion)`);

        // Expand events (handle RRULE)
        const expandedEvents: ExpandedEvent[] = [];
        const currentUids: string[] = [];

        for (const ev of vevents) {
          if (ev.rrule) {
            // Expand recurring event
            const instances = expandRRule(ev.dtstart, ev.dtend, ev.rrule, ev.exdates || []);
            console.log(`[sync-ics] Event uid=${ev.uid} RRULE=${ev.rrule}: expanded to ${instances.length} instances`);
            for (const inst of instances) {
              const instanceUid = `${ev.uid}__${inst.dateSuffix}`;
              currentUids.push(instanceUid);
              expandedEvents.push({
                uid: instanceUid,
                summary: ev.summary,
                dtstart: inst.dtstart,
                dtend: inst.dtend,
                location: ev.location,
                description: ev.description,
              });
            }
          } else {
            // Single event
            currentUids.push(ev.uid);
            expandedEvents.push({
              uid: ev.uid,
              summary: ev.summary,
              dtstart: icsDateToISO(ev.dtstart),
              dtend: icsDateToISO(ev.dtend),
              location: ev.location,
              description: ev.description,
            });
          }
        }

        console.log(`[sync-ics] Profile ${profile.id}: ${expandedEvents.length} total events after expansion`);

        // Upsert events
        let synced = 0;

        for (const ev of expandedEvents) {
          const eventData = {
            creator_id: profile.id,
            external_uid: ev.uid,
            title: ev.summary.substring(0, 500),
            description: ev.description?.substring(0, 2000) || null,
            start_time: ev.dtstart,
            end_time: ev.dtend,
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
