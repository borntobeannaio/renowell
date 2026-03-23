import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DADATA_API_KEY = Deno.env.get("DADATA_API_KEY");
    if (!DADATA_API_KEY) {
      throw new Error("DADATA_API_KEY is not configured");
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${DADATA_API_KEY}`,
        },
        body: JSON.stringify({ query: query.trim(), count: 8 }),
      }
    );

    if (!res.ok) {
      throw new Error(`DaData API error [${res.status}]: ${await res.text()}`);
    }

    const data = await res.json();

    const suggestions = (data.suggestions || []).map((s: any) => ({
      inn: s.data?.inn || null,
      name: s.value || "",
      full_name: s.data?.name?.full_with_opf || s.value || "",
      ogrn: s.data?.ogrn || null,
      address: s.data?.address?.unrestricted_value || s.data?.address?.value || null,
    }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("DaData suggest error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
