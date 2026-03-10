import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { full_name, position, email, phone } = await req.json();

    // Generate password
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    for (let i = 0; i < 12; i++) {
      password += chars[array[i] % chars.length];
    }

    const nameParts = full_name.trim().split(/\s+/);
    const lastName = nameParts[0] || "";
    const firstName = nameParts.slice(1).join(" ") || "";

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (createError || !authData.user) {
      return new Response(JSON.stringify({ error: createError?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: profile } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, position })
      .eq("user_id", userId)
      .select("id")
      .single();

    if (profile) {
      await supabase.from("employees").insert({
        full_name, position, email, phone: phone || null,
        profile_id: profile.id,
      });
    }

    return new Response(JSON.stringify({ success: true, password, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
