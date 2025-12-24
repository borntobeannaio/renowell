import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secret key to protect this endpoint (set in env or hardcode for one-time use)
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") || "create-users-secret-2024";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Simple auth check via header
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { password } = await req.json();
    
    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all employees without profile_id and with email
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("id, full_name, email")
      .is("profile_id", null)
      .not("email", "is", null);

    if (empError) throw empError;

    const results: { employee: string; email: string; status: string; error?: string }[] = [];

    for (const emp of employees || []) {
      if (!emp.email) continue;

      // Parse full_name into first_name and last_name (format: "Фамилия Имя")
      const nameParts = emp.full_name.trim().split(/\s+/);
      const lastName = nameParts[0] || "";
      const firstName = nameParts.slice(1).join(" ") || "";

      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: emp.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          }
        });

        if (authError) {
          results.push({ employee: emp.full_name, email: emp.email, status: "error", error: authError.message });
          continue;
        }

        // The trigger handle_new_user should create the profile automatically
        // Wait a bit for trigger to execute
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the created profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", authData.user.id)
          .single();

        if (profileError || !profile) {
          // If trigger didn't create profile, create it manually
          const { data: newProfile, error: insertError } = await supabase
            .from("profiles")
            .insert({
              user_id: authData.user.id,
              first_name: firstName,
              last_name: lastName,
            })
            .select("id")
            .single();

          if (insertError) {
            results.push({ employee: emp.full_name, email: emp.email, status: "user_created_profile_failed", error: insertError.message });
            continue;
          }

          // Link employee to profile
          await supabase
            .from("employees")
            .update({ profile_id: newProfile.id })
            .eq("id", emp.id);

          results.push({ employee: emp.full_name, email: emp.email, status: "success" });
        } else {
          // Link employee to profile
          await supabase
            .from("employees")
            .update({ profile_id: profile.id })
            .eq("id", emp.id);

          results.push({ employee: emp.full_name, email: emp.email, status: "success" });
        }
      } catch (e) {
        results.push({ employee: emp.full_name, email: emp.email, status: "error", error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} employees`,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
