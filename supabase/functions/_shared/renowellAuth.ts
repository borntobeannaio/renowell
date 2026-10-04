// Own authentication for Renowell on top of the external PostgreSQL.
// Users live in renowell_users (bcrypt hashes), refresh tokens in renowell_refresh_tokens.
import { SignJWT, jwtVerify } from "npm:jose@5.9.6";
import bcrypt from "npm:bcryptjs@2.4.3";
import { sql } from "./renowellDb.ts";

const ACCESS_TTL = 60 * 60; // 1h
const REFRESH_TTL_DAYS = 30;
const secret = () => new TextEncoder().encode(Deno.env.get("RENOWELL_JWT_SECRET")!);

export interface AppUser {
  id: string; email: string; aud: string; role: string;
  user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown>;
  created_at: string; last_sign_in_at?: string | null;
}

function toUser(r: Record<string, any>): AppUser {
  return {
    id: r.id, email: r.email, aud: "authenticated", role: "authenticated",
    user_metadata: r.raw_user_meta_data ?? {}, app_metadata: { provider: "email", providers: ["email"] },
    created_at: r.created_at, last_sign_in_at: r.last_sign_in_at ?? null,
  };
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(48));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function issueSession(u: Record<string, any>) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = await new SignJWT({ email: u.email, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(u.id).setIssuedAt(now).setExpirationTime(now + ACCESS_TTL).setIssuer("renowell")
    .sign(secret());
  const refresh_token = randomToken();
  await sql`insert into public.renowell_refresh_tokens (user_id, token_hash, expires_at)
    values (${u.id}::uuid, ${await sha256(refresh_token)}, now() + ${REFRESH_TTL_DAYS + " days"}::interval)`;
  return { access_token, refresh_token, token_type: "bearer", expires_in: ACCESS_TTL, expires_at: now + ACCESS_TTL, user: toUser(u) };
}

export async function signInWithPassword(email: string, password: string) {
  const rows = await sql`select * from public.renowell_users where lower(email) = lower(${email}) limit 1`;
  const u = rows[0];
  if (!u?.encrypted_password || !bcrypt.compareSync(password, u.encrypted_password)) {
    throw new Error("Invalid login credentials");
  }
  await sql`update public.renowell_users set last_sign_in_at = now() where id = ${u.id}`;
  return issueSession(u);
}

export async function refreshSession(refreshToken: string) {
  const h = await sha256(refreshToken);
  const rows = await sql`delete from public.renowell_refresh_tokens where token_hash = ${h} returning user_id, expires_at`;
  const t = rows[0];
  if (!t || new Date(t.expires_at).getTime() < Date.now()) throw new Error("Invalid Refresh Token");
  const u = (await sql`select * from public.renowell_users where id = ${t.user_id}`)[0];
  if (!u) throw new Error("User not found");
  await sql`delete from public.renowell_refresh_tokens where user_id = ${u.id} and expires_at < now()`;
  return issueSession(u);
}

export async function signOut(refreshToken?: string) {
  if (refreshToken) await sql`delete from public.renowell_refresh_tokens where token_hash = ${await sha256(refreshToken)}`;
}

/** Returns user id (sub) for a valid access token, else null. */
export async function verifyAccessToken(token?: string | null): Promise<{ id: string; email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "renowell" });
    return payload.sub ? { id: payload.sub, email: String(payload.email ?? "") } : null;
  } catch { return null; }
}

/** Extracts token from Authorization header or body._accessToken (Yandex proxy strips headers). */
export function extractToken(req: Request, body?: Record<string, unknown> | null): string | null {
  const h = req.headers.get("authorization") ?? "";
  const fromHeader = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  const fromBody = typeof body?._accessToken === "string" ? body._accessToken : "";
  // Prefer body token: header may carry the anon key added by the proxy.
  return fromBody || fromHeader || null;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const r = (await sql`select * from public.renowell_users where id = ${id}::uuid`)[0];
  return r ? toUser(r) : null;
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const r = (await sql`select * from public.renowell_users where lower(email) = lower(${email})`)[0];
  return r ? toUser(r) : null;
}

export async function createUser(email: string, password: string, meta: Record<string, unknown> = {}): Promise<AppUser> {
  const hash = bcrypt.hashSync(password, 10);
  const r = (await sql`insert into public.renowell_users (email, encrypted_password, raw_user_meta_data)
    values (${email.toLowerCase()}, ${hash}, ${sql.json(meta as any)}) returning *`)[0];
  // replaces auth trigger handle_new_user
  await sql`insert into public.renowell_profiles (user_id, first_name, last_name)
    values (${r.id}::uuid, ${(meta.first_name as string) ?? null}, ${(meta.last_name as string) ?? null})`;
  return toUser(r);
}

export async function updatePassword(userId: string, password: string) {
  await sql`update public.renowell_users set encrypted_password = ${bcrypt.hashSync(password, 10)} where id = ${userId}::uuid`;
  await sql`delete from public.renowell_refresh_tokens where user_id = ${userId}::uuid`;
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const r = (await sql`select encrypted_password from public.renowell_users where id = ${userId}::uuid`)[0];
  return !!r?.encrypted_password && bcrypt.compareSync(password, r.encrypted_password);
}

export async function deleteUser(userId: string) {
  await sql`delete from public.renowell_users where id = ${userId}::uuid`;
}
