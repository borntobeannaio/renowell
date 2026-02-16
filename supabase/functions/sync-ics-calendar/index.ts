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
  dtstartTzid?: string;
  dtendTzid?: string;
  location?: string;
  description?: string;
  rrule?: string;
  exdates?: string[];
  organizer?: string;
  attendees?: { name: string; email: string; status: string }[];
  url?: string;
  attachments?: { filename: string; url: string }[];
}

interface ExpandedEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location?: string;
  description?: string;
  organizer?: string;
  attendees?: { name: string; email: string; status: string }[];
  url?: string;
  attachments?: { filename: string; url: string }[];
}

// ── Timezone offset map ──────────────────────────────────────────
const FIXED_TZ_OFFSETS: Record<string, number> = {
  "Europe/Moscow": 3,
  "Europe/Minsk": 3,
  "Europe/Kirov": 3,
  "Europe/Simferopol": 3,
  "Europe/Volgograd": 3,
  "Asia/Yekaterinburg": 5,
  "Asia/Omsk": 6,
  "Asia/Novosibirsk": 7,
  "Asia/Barnaul": 7,
  "Asia/Tomsk": 7,
  "Asia/Krasnoyarsk": 7,
  "Asia/Irkutsk": 8,
  "Asia/Yakutsk": 9,
  "Asia/Chita": 9,
  "Asia/Vladivostok": 10,
  "Asia/Magadan": 11,
  "Asia/Kamchatka": 12,
  "UTC": 0,
  "GMT": 0,
};

// DST-aware zones (EU rules: last Sunday of March → +1h, last Sunday of October → back)
const DST_ZONES: Record<string, { standard: number; summer: number }> = {
  "Europe/London": { standard: 0, summer: 1 },
  "Europe/Berlin": { standard: 1, summer: 2 },
  "Europe/Paris": { standard: 1, summer: 2 },
  "Europe/Rome": { standard: 1, summer: 2 },
  "Europe/Madrid": { standard: 1, summer: 2 },
  "Europe/Warsaw": { standard: 1, summer: 2 },
  "Europe/Kiev": { standard: 2, summer: 3 },
  "Europe/Kyiv": { standard: 2, summer: 3 },
  "Europe/Helsinki": { standard: 2, summer: 3 },
  "Europe/Bucharest": { standard: 2, summer: 3 },
  "Europe/Athens": { standard: 2, summer: 3 },
  "Europe/Istanbul": { standard: 3, summer: 3 }, // Turkey no DST since 2016
};

function lastSundayOfMonth(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  const day = d.getUTCDay(); // 0=Sun
  return d.getUTCDate() - day;
}

function isEuropeanDST(date: Date): boolean {
  const y = date.getUTCFullYear();
  const marchSwitch = Date.UTC(y, 2, lastSundayOfMonth(y, 2), 1, 0, 0); // 01:00 UTC
  const octoberSwitch = Date.UTC(y, 9, lastSundayOfMonth(y, 9), 1, 0, 0);
  const t = date.getTime();
  return t >= marchSwitch && t < octoberSwitch;
}

function getTzOffsetHours(tzid: string, date: Date): number | undefined {
  if (FIXED_TZ_OFFSETS[tzid] !== undefined) return FIXED_TZ_OFFSETS[tzid];
  const dst = DST_ZONES[tzid];
  if (dst) return isEuropeanDST(date) ? dst.summer : dst.standard;
  // Try common aliases
  const lower = tzid.toLowerCase();
  if (lower === "utc" || lower === "gmt") return 0;
  return undefined; // unknown timezone
}

// ── Date parsing with TZID ───────────────────────────────────────
function parseIcsDateWithTz(dateStr: string, tzid?: string, customTzMap?: Record<string, number>): string {
  const base = dateStr.replace("Z", "");
  let year: number, month: number, day: number, hour = 0, min = 0, sec = 0;

  if (base.length === 8) {
    year = +base.slice(0, 4); month = +base.slice(4, 6) - 1; day = +base.slice(6, 8);
  } else {
    year = +base.slice(0, 4); month = +base.slice(4, 6) - 1; day = +base.slice(6, 8);
    hour = +base.slice(9, 11); min = +base.slice(11, 13); sec = +base.slice(13, 15);
  }

  // Already UTC
  if (dateStr.endsWith("Z")) {
    return new Date(Date.UTC(year, month, day, hour, min, sec)).toISOString();
  }

  // Has timezone info
  if (tzid) {
    const localDate = new Date(Date.UTC(year, month, day, hour, min, sec));
    // Try standard IANA zones first
    let offset = getTzOffsetHours(tzid, localDate);
    // Fallback to custom VTIMEZONE map
    if (offset === undefined && customTzMap && customTzMap[tzid] !== undefined) {
      offset = customTzMap[tzid];
    }
    if (offset !== undefined) {
      const utc = new Date(localDate.getTime() - offset * 3600_000);
      return utc.toISOString();
    }
    console.log(`[sync-ics] Unknown TZID: ${tzid}, treating as UTC`);
  }

  // No timezone — treat as UTC (legacy behavior)
  return new Date(Date.UTC(year, month, day, hour, min, sec)).toISOString();
}

// ── RRULE ────────────────────────────────────────────────────────
const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

function parseRRule(rrule: string) {
  const params: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) params[k.toUpperCase()] = v;
  }
  return {
    freq: params.FREQ || "DAILY",
    interval: params.INTERVAL ? parseInt(params.INTERVAL, 10) : 1,
    count: params.COUNT ? parseInt(params.COUNT, 10) : undefined,
    until: params.UNTIL ? new Date(parseIcsDateWithTz(params.UNTIL)) : undefined,
    byday: params.BYDAY
      ? params.BYDAY.split(",").map((d) => DAY_MAP[d.trim().toUpperCase()]).filter((n) => n !== undefined)
      : undefined,
  };
}

function formatYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function advanceDate(d: Date, freq: string, interval: number): Date {
  const next = new Date(d.getTime());
  switch (freq) {
    case "DAILY": next.setUTCDate(next.getUTCDate() + interval); break;
    case "WEEKLY": next.setUTCDate(next.getUTCDate() + 7 * interval); break;
    case "MONTHLY": next.setUTCMonth(next.getUTCMonth() + interval); break;
    case "YEARLY": next.setUTCFullYear(next.getUTCFullYear() + interval); break;
  }
  return next;
}

const MAX_INSTANCES = 200;
const HORIZON_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function expandRRule(
  dtstart: string,
  dtend: string,
  rrule: string,
  exdates: string[]
): { dtstart: string; dtend: string; dateSuffix: string }[] {
  const rule = parseRRule(rrule);
  const start = new Date(dtstart);
  const end = new Date(dtend);
  const durationMs = end.getTime() - start.getTime();
  const horizon = new Date(Date.now() + HORIZON_MS);

  const exSet = new Set(exdates.map((e) => {
    const parsed = parseIcsDateWithTz(e);
    return formatYMD(new Date(parsed));
  }));

  const results: { dtstart: string; dtend: string; dateSuffix: string }[] = [];

  if (rule.freq === "WEEKLY" && rule.byday && rule.byday.length > 0) {
    let weekStart = new Date(start.getTime());
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    let count = 0;

    outer:
    while (results.length < MAX_INSTANCES) {
      for (const dayNum of rule.byday.sort((a, b) => a - b)) {
        const candidate = new Date(weekStart.getTime());
        candidate.setUTCDate(candidate.getUTCDate() + dayNum);
        if (candidate < start) continue;
        if (candidate > horizon) break outer;
        if (rule.until && candidate > rule.until) break outer;
        if (rule.count !== undefined && count >= rule.count) break outer;
        count++;
        const ymd = formatYMD(candidate);
        if (exSet.has(ymd)) continue;
        const instanceEnd = new Date(candidate.getTime() + durationMs);
        results.push({ dtstart: candidate.toISOString(), dtend: instanceEnd.toISOString(), dateSuffix: ymd });
      }
      weekStart.setUTCDate(weekStart.getUTCDate() + 7 * rule.interval);
    }
  } else {
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
        results.push({ dtstart: current.toISOString(), dtend: instanceEnd.toISOString(), dateSuffix: ymd });
      }
      current = advanceDate(current, rule.freq, rule.interval);
    }
  }
  return results;
}

// ── VTIMEZONE parser ─────────────────────────────────────────────
/** Parse VTIMEZONE blocks to build custom TZID → offset map */
function parseVTimezones(raw: string): Record<string, number> {
  const tzMap: Record<string, number> = {};
  const blocks = raw.split("BEGIN:VTIMEZONE");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VTIMEZONE")[0];
    const tzidMatch = block.match(/^TZID:(.+)$/m);
    if (!tzidMatch) continue;
    const tzid = tzidMatch[1].trim();

    // Look for STANDARD section's TZOFFSETTO (the "normal" offset)
    // Format: TZOFFSETTO:+0300 or TZOFFSETTO:-0500
    let offset: number | undefined;
    
    // Prefer STANDARD offset
    const standardBlock = block.split("BEGIN:STANDARD")[1]?.split("END:STANDARD")[0];
    if (standardBlock) {
      const offsetMatch = standardBlock.match(/TZOFFSETTO:([+-]?\d{4})/);
      if (offsetMatch) {
        offset = parseUtcOffset(offsetMatch[1]);
      }
    }
    
    // Fallback: any TZOFFSETTO in the block
    if (offset === undefined) {
      const offsetMatch = block.match(/TZOFFSETTO:([+-]?\d{4})/);
      if (offsetMatch) {
        offset = parseUtcOffset(offsetMatch[1]);
      }
    }

    if (offset !== undefined) {
      tzMap[tzid] = offset;
      console.log(`[sync-ics] VTIMEZONE: ${tzid} → UTC${offset >= 0 ? "+" : ""}${offset}`);
    }
  }
  return tzMap;
}

/** Parse "+0300" or "-0500" to hours offset */
function parseUtcOffset(s: string): number {
  const sign = s.startsWith("-") ? -1 : 1;
  const abs = s.replace(/[+-]/, "");
  const hours = parseInt(abs.slice(0, 2), 10);
  const minutes = parseInt(abs.slice(2, 4), 10);
  return sign * (hours + minutes / 60);
}

// ── ICS Parser ───────────────────────────────────────────────────
function extractTzid(line: string): string | undefined {
  const m = line.match(/TZID=([^;:]+)/i);
  return m ? m[1] : undefined;
}

function extractCN(params: string): string {
  // Handle CN="Name", CN='Name', CN=Name
  const m = params.match(/CN=["']?([^;:"']+)["']?/i);
  return m ? m[1].replace(/"/g, "").replace(/'/g, "").trim() : "";
}

function extractEmail(value: string): string {
  // Try mailto: first
  const m = value.match(/mailto:([^\s;>"']+)/i);
  if (m) return m[1].trim();
  // Fallback: find email pattern directly
  const emailMatch = value.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return emailMatch ? emailMatch[1].trim() : "";
}

function extractPartstat(params: string): string {
  const m = params.match(/PARTSTAT=([^;:]+)/i);
  return m ? m[1].toLowerCase().trim() : "needs-action";
}

function parseICS(raw: string): { events: VEvent[]; vtimezones: Record<string, number> } {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const unfolded = normalized.replace(/\n[ \t]/g, "");

  // Parse VTIMEZONE blocks first
  const vtimezones = parseVTimezones(unfolded);

  const events: VEvent[] = [];
  const blocks = unfolded.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const lines = block.split("\n");

    let uid = "", summary = "Без названия", dtstart = "", dtend = "";
    let dtstartTzid: string | undefined, dtendTzid: string | undefined;
    let location: string | undefined, description: string | undefined;
    let rrule: string | undefined, url: string | undefined;
    let organizer: string | undefined;
    const attendees: { name: string; email: string; status: string }[] = [];
    const attachments: { filename: string; url: string }[] = [];
    const exdates: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("UID:")) {
        uid = trimmed.substring(4).trim();
      } else if (trimmed.startsWith("SUMMARY:") || trimmed.startsWith("SUMMARY;")) {
        const colonIdx = trimmed.indexOf(":");
        summary = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : "";
      } else if (trimmed.startsWith("DTSTART")) {
        dtstartTzid = extractTzid(trimmed);
        const colonIdx = trimmed.indexOf(":", trimmed.indexOf("DTSTART") + 7);
        dtstart = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : "";
      } else if (trimmed.startsWith("DTEND")) {
        dtendTzid = extractTzid(trimmed);
        const colonIdx = trimmed.indexOf(":", trimmed.indexOf("DTEND") + 5);
        dtend = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : "";
      } else if (trimmed.startsWith("RRULE:")) {
        rrule = trimmed.substring(6).trim();
      } else if (trimmed.startsWith("LOCATION:") || trimmed.startsWith("LOCATION;")) {
        const colonIdx = trimmed.indexOf(":");
        location = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : "";
      } else if (trimmed.startsWith("DESCRIPTION:") || trimmed.startsWith("DESCRIPTION;")) {
        const colonIdx = trimmed.indexOf(":");
        description = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : "";
      } else if (trimmed.startsWith("URL:") || trimmed.startsWith("URL;")) {
        const colonIdx = trimmed.indexOf(":");
        url = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : "";
        if (url && !url.startsWith("http")) {
          const httpIdx = trimmed.indexOf("http");
          if (httpIdx > -1) url = trimmed.substring(httpIdx).trim();
        }
      } else if (trimmed.startsWith("ORGANIZER")) {
        console.log(`[sync-ics] Raw ORGANIZER: ${trimmed.substring(0, 200)}`);
        const cn = extractCN(trimmed);
        const email = extractEmail(trimmed);
        organizer = cn ? (email ? `${cn} <${email}>` : cn) : email || undefined;
      } else if (trimmed.startsWith("ATTENDEE")) {
        console.log(`[sync-ics] Raw ATTENDEE: ${trimmed.substring(0, 200)}`);
        const cn = extractCN(trimmed);
        const email = extractEmail(trimmed);
        const status = extractPartstat(trimmed);
        // Fallback: use email prefix as name if CN is missing
        const name = cn || (email ? email.split("@")[0] : "");
        if (email || name) {
          attendees.push({ name, email, status });
        }
      } else if (trimmed.startsWith("ATTACH")) {
        const httpIdx = trimmed.indexOf("http");
        if (httpIdx > -1) {
          const attachUrl = trimmed.substring(httpIdx).trim();
          const filename = attachUrl.split("/").pop() || "attachment";
          attachments.push({ filename, url: attachUrl });
        }
      } else if (trimmed.startsWith("EXDATE")) {
        const colonIdx = trimmed.lastIndexOf(":");
        const dateStr = colonIdx > -1 ? trimmed.substring(colonIdx + 1) : trimmed.substring(7);
        for (const d of dateStr.split(",")) {
          if (d.trim()) exdates.push(d.trim());
        }
      }
    }

    if (!uid || !dtstart) {
      console.log(`[sync-ics] Skipping event: uid=${uid}, dtstart=${dtstart}, summary=${summary}`);
      continue;
    }

    if (attendees.length > 0 || organizer) {
      console.log(`[sync-ics] Event "${summary}": ${attendees.length} attendees, organizer=${organizer || 'none'}`);
    }

    events.push({
      uid, summary, dtstart, dtend: dtend || dtstart,
      dtstartTzid, dtendTzid,
      location, description,
      rrule: rrule || undefined,
      exdates: exdates.length > 0 ? exdates : undefined,
      organizer,
      attendees: attendees.length > 0 ? attendees : undefined,
      url,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }
  return { events, vtimezones };
}

// ── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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
        const resp = await fetch(profile.ics_url, {
          headers: { "User-Agent": "Renowell-Calendar-Sync/1.0" },
        });
        if (!resp.ok) {
          results.push({ profile_id: profile.id, synced: 0, deleted: 0, error: `HTTP ${resp.status}` });
          continue;
        }

        const icsText = await resp.text();
        console.log(`[sync-ics] Profile ${profile.id}: fetched ${icsText.length} bytes`);
        const { events: vevents, vtimezones } = parseICS(icsText);
        console.log(`[sync-ics] Profile ${profile.id}: parsed ${vevents.length} VEVENTs, ${Object.keys(vtimezones).length} VTIMEZONEs`);

        const expandedEvents: ExpandedEvent[] = [];
        const currentUids: string[] = [];

        for (const ev of vevents) {
          const startIso = parseIcsDateWithTz(ev.dtstart, ev.dtstartTzid, vtimezones);
          const endIso = parseIcsDateWithTz(ev.dtend, ev.dtendTzid || ev.dtstartTzid, vtimezones);

          if (ev.rrule) {
            const instances = expandRRule(startIso, endIso, ev.rrule, ev.exdates || []);
            console.log(`[sync-ics] Event uid=${ev.uid} RRULE=${ev.rrule}: ${instances.length} instances`);
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
                organizer: ev.organizer,
                attendees: ev.attendees,
                url: ev.url,
                attachments: ev.attachments,
              });
            }
          } else {
            currentUids.push(ev.uid);
            expandedEvents.push({
              uid: ev.uid,
              summary: ev.summary,
              dtstart: startIso,
              dtend: endIso,
              location: ev.location,
              description: ev.description,
              organizer: ev.organizer,
              attendees: ev.attendees,
              url: ev.url,
              attachments: ev.attachments,
            });
          }
        }

        console.log(`[sync-ics] Profile ${profile.id}: ${expandedEvents.length} total events`);

        let synced = 0;
        for (const ev of expandedEvents) {
          const eventData: Record<string, unknown> = {
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
            organizer: ev.organizer?.substring(0, 500) || null,
            attendees: ev.attendees || [],
            url: ev.url?.substring(0, 1000) || null,
            attachments: ev.attachments || [],
          };

          const { error: upsertErr } = await supabase
            .from("calendar_events")
            .upsert(eventData, { onConflict: "creator_id,external_uid", ignoreDuplicates: false });

          if (upsertErr) {
            console.error(`[sync-ics] Upsert error uid=${ev.uid}:`, upsertErr.message);
          } else {
            synced++;
          }
        }

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
          profile_id: profile.id, synced: 0, deleted: 0,
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
