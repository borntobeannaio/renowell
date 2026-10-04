// Auth proxy — own authentication against external Renowell PostgreSQL.
// Actions: password | refresh | logout | user | update_password
import { signInWithPassword, refreshSession, signOut, verifyAccessToken, extractToken, getUserById, updatePassword, verifyPassword } from "../_shared/renowellAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (message: string) => json({ error: { message } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "password";

    if (action === "password") {
      if (!body?.email || !body?.password) return fail("email и password обязательны");
      try { return json({ data: await signInWithPassword(String(body.email).trim(), String(body.password)) }); }
      catch { return fail("Неверный email или пароль"); }
    }
    if (action === "refresh") {
      if (!body?.refresh_token) return fail("refresh_token обязателен");
      try { return json({ data: await refreshSession(String(body.refresh_token)) }); }
      catch (e) { return fail((e as Error).message); }
    }
    if (action === "logout") {
      await signOut(body?.refresh_token ? String(body.refresh_token) : undefined);
      return json({ data: { ok: true } });
    }
    const who = await verifyAccessToken(extractToken(req, body));
    if (!who) return fail("Не авторизован");
    if (action === "user") return json({ data: await getUserById(who.id) });
    if (action === "update_password") {
      const pwd = String(body?.password ?? "");
      if (pwd.length < 6) return fail("Пароль должен быть не короче 6 символов");
      if (body?.current_password !== undefined && !(await verifyPassword(who.id, String(body.current_password)))) {
        return fail("Неверный текущий пароль");
      }
      await updatePassword(who.id, pwd);
      return json({ data: { ok: true } });
    }
    return fail(`Неизвестное действие: ${action}`);
  } catch (e) {
    return json({ error: { message: e instanceof Error ? e.message : "Internal error" } }, 500);
  }
});
