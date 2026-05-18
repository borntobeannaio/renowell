// Auth proxy — серверный вызов Supabase Auth (для пользователей с заблокированным supabase.co)
// Принимает { action: 'password' | 'refresh', email?, password?, refresh_token? }
// Возвращает сессию { access_token, refresh_token, expires_in, expires_at, token_type, user }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "password";

    let grantType: string;
    let payload: Record<string, unknown>;

    if (action === "password") {
      if (!body?.email || !body?.password) {
        return new Response(
          JSON.stringify({ error: { message: "email и password обязательны" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      grantType = "password";
      payload = { email: String(body.email), password: String(body.password) };
    } else if (action === "refresh") {
      if (!body?.refresh_token) {
        return new Response(
          JSON.stringify({ error: { message: "refresh_token обязателен" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      grantType = "refresh_token";
      payload = { refresh_token: String(body.refresh_token) };
    } else {
      return new Response(
        JSON.stringify({ error: { message: `Неизвестное действие: ${action}` } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const upstream = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text || "Auth upstream error" } };
    }

    if (!upstream.ok) {
      const message =
        (data as { error_description?: string; msg?: string; error?: string })?.error_description ||
        (data as { msg?: string })?.msg ||
        (typeof (data as { error?: unknown })?.error === "string"
          ? (data as { error: string }).error
          : "Auth error");
      return new Response(
        JSON.stringify({ error: { message, status: upstream.status, raw: data } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return new Response(
      JSON.stringify({ error: { message } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
