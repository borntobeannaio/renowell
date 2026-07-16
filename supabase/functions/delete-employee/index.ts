import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Читаем токен и из Authorization, и из body._accessToken (Yandex proxy не пробрасывает кастомные заголовки)
    const bodyJson = await req.json().catch(() => ({} as Record<string, unknown>));
    const authHeader = req.headers.get("Authorization");
    const headerToken = authHeader ? authHeader.replace("Bearer ", "") : "";
    const token = headerToken || (typeof bodyJson._accessToken === "string" ? bodyJson._accessToken : "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.warn("[delete-employee] getClaims failed:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid token", details: claimsError?.message ?? null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claims = claimsData.claims as Record<string, unknown>;
    const callerEmail = (
      (claims.email as string | undefined) ??
      ((claims.user_metadata as { email?: string } | undefined)?.email) ??
      ""
    ).toLowerCase();

    const hrAdmins = ["sonya369@gmail.com", "astashkina495@gmail.com", "anna.rum91@gmail.com", "oparin@renowell.ru"];
    if (!callerEmail || !hrAdmins.includes(callerEmail)) {
      return new Response(
        JSON.stringify({ error: "Forbidden - only HR admins can delete employees" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employee_id = bodyJson.employee_id as string | undefined;

    if (!employee_id) {
      return new Response(
        JSON.stringify({ error: "Missing employee_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee to find profile_id
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, profile_id, full_name")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user_id from profile if profile exists
    let userId: string | null = null;
    if (employee.profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", employee.profile_id)
        .single();

      userId = profile?.user_id || null;
    }

    // 1. Delete employee record
    const { error: deleteEmpError } = await supabase
      .from("employees")
      .delete()
      .eq("id", employee_id);

    if (deleteEmpError) {
      console.error("Error deleting employee:", deleteEmpError);
      return new Response(
        JSON.stringify({ error: "Failed to delete employee: " + deleteEmpError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Delete auth user (this cascades to profile via ON DELETE CASCADE)
    if (userId) {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error("Error deleting auth user:", deleteUserError);
        // Employee is already deleted, log but don't fail
      }
    }

    console.log("Successfully deleted employee:", employee.full_name, "user:", userId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-employee:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
