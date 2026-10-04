// TEMPORARY one-off: copies auth.users (with bcrypt hashes) into external renowell_users.
import postgres from "npm:postgres@3.4.4";

Deno.serve(async (req) => {
  if (req.headers.get("x-run") !== "renowell-users-once") return new Response("no", { status: 403 });
  const src = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1 });
  const dst = postgres(Deno.env.get("RENOWELL_DATABASE_URL")!, { max: 1, ssl: "require" });
  try {
    const users = await src`select id, email, encrypted_password, coalesce(raw_user_meta_data,'{}'::jsonb) as meta, created_at, last_sign_in_at from auth.users`;
    for (const u of users) {
      await dst`insert into public.renowell_users (id,email,encrypted_password,raw_user_meta_data,created_at,last_sign_in_at)
        values (${u.id},${String(u.email).toLowerCase()},${u.encrypted_password},${dst.json(u.meta)},${u.created_at},${u.last_sign_in_at})
        on conflict (id) do update set encrypted_password=excluded.encrypted_password, email=excluded.email`;
    }
    return new Response(JSON.stringify({ copied: users.length }));
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  } finally {
    await src.end(); await dst.end();
  }
});
