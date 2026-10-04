// db-proxy — data access for the web app against the external Renowell PostgreSQL.
// Request format is unchanged (action/table/filters/select/order/limit/data/onConflict).
import { runQuery, type QueryRequest } from "../_shared/renowellDb.ts";
import { verifyAccessToken, extractToken } from "../_shared/renowellAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Tables that must never be reachable from the browser.
const BLOCKED = new Set(["users", "refresh_tokens", "bot_settings", "support_telegram_map"]);

console.log("[db-proxy] Module initialized (external PG)");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();
  try {
    const body = await req.json();
    if (body?.action === "ping") return json({ data: "ok" });

    const user = await verifyAccessToken(extractToken(req, body));
    if (!user) return json({ error: { message: "Не авторизован", code: "401" } }, 401);

    const table = String(body?.table ?? "").replace(/^renowell_/, "");
    if (!table) throw new Error("Missing table");
    if (BLOCKED.has(table)) return json({ error: { message: "Forbidden table" } }, 403);

    const request: QueryRequest = {
      action: body.action,
      table,
      data: body.data,
      filters: body.filters,
      select: body.select,
      order: body.order,
      limit: body.limit,
      onConflict: body.onConflict ?? (table === "form_drafts" && body.action === "upsert" ? "user_id,form_type,entity_id" : undefined),
    };
    const r = await runQuery(request, user.id);
    if (r.error) {
      console.error(`[db-proxy] ${body.action} ${table} error (${Date.now() - started}ms):`, r.error.message);
      return json({ error: r.error }, 400);
    }
    return json({ data: r.data });
  } catch (e) {
    console.error("[db-proxy] error:", (e as Error).message);
    return json({ error: { message: (e as Error).message } }, 500);
  }
});
