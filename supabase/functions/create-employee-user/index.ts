import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { db } from "../_shared/renowellDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeRequest {
  full_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  position: string;
  email: string;
  phone?: string;
  department?: string;
  birthday?: string;
}

// Generate a random password
function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {

    // Read body once — нужен и для токена-fallback, и для данных сотрудника
    const body: CreateEmployeeRequest & { _accessToken?: string } = await req.json();

    // Verify the caller is an HR admin (токен из заголовка или из тела — при вызове через Yandex Cloud proxy)
    const authHeader = req.headers.get("Authorization");
    const headerToken = authHeader ? authHeader.replace("Bearer ", "") : "";
    // Через Yandex proxy в Authorization может прийти служебный anon-token без sub.
    // Настоящий пользовательский JWT прокидываем в body._accessToken и берём его первым.
    const token = (body._accessToken ?? "") || headerToken;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const who = await verifyAccessToken(token);
    if (!who) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerEmail = who.email.toLowerCase();

    // Check if caller is HR admin
    const hrAdmins = ["sonya369@gmail.com", "astashkina495@gmail.com", "anna.rum91@gmail.com", "oparin@renowell.ru"];
    if (!callerEmail || !hrAdmins.includes(callerEmail)) {
      return new Response(
        JSON.stringify({ error: "Forbidden - only HR admins can create employees" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { full_name, position, email, phone, department, birthday, middle_name } = body;

    // Support both old (full_name) and new (first_name/last_name) formats
    let firstName = body.first_name || "";
    let lastName = body.last_name || "";
    
    if (!firstName && !lastName && full_name) {
      const nameParts = full_name.trim().split(/\s+/);
      lastName = nameParts[0] || "";
      firstName = nameParts.slice(1).join(" ") || "";
    }

    if (!full_name || !position || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: full_name, position, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (await getUserByEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Пользователь с таким email уже существует" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate password
    const password = generatePassword();

    // Create user (also creates the profile row)
    let userId: string;
    try {
      userId = (await createUser(email, password, { first_name: firstName, last_name: lastName })).id;
    } catch (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: (createError as Error).message || "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = { ...(db as any), auth: { admin: { deleteUser: (id: string) => deleteUser(id) } } };

    // Get profile created by trigger and update it with additional data
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        middle_name: middle_name || null,
        position,
        birthday: birthday || null,
      })
      .eq("user_id", userId)
      .select("id")
      .single();

    if (profileError || !profile) {
      console.error("Error updating profile:", profileError);
      // Try to clean up auth user
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to update profile: " + (profileError?.message || "Profile not found") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create employee record linked to profile
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .insert({
        full_name,
        first_name: firstName || null,
        last_name: lastName || null,
        position,
        email,
        phone: phone || null,
        department: department || null,
        birthday: birthday || null,
        profile_id: profile.id,
        middle_name: middle_name || null,
      })
      .select()
      .single();

    if (employeeError) {
      console.error("Error creating employee:", employeeError);
      // Clean up profile and auth user
      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to create employee: " + employeeError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully created employee:", employee.id, "with user:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        employee,
        password, // Return generated password to show to admin
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-employee-user:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
