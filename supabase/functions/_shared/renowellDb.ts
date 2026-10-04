// Shared access layer to the external Renowell PostgreSQL.
// All tables live in schema public with prefix `renowell_`. Callers use logical
// names (e.g. "tasks"); this module maps them, validates identifiers, builds
// parameterized SQL and emulates the subset of PostgREST that the app uses
// (filters, order, limit, embedded selects like "*, author:profiles!fk(cols)").
import postgres from "npm:postgres@3.4.4";

const PREFIX = "renowell_";
const IDENT = /^[a-z_][a-z0-9_]*$/;

function parseTs(x: string): string {
  // "2026-10-04 19:38:00.123+00" -> "2026-10-04T19:38:00.123+00:00"
  let s = x.replace(" ", "T");
  if (/[+-]\d\d$/.test(s)) s += ":00";
  return s;
}

export const sql = postgres(Deno.env.get("RENOWELL_DATABASE_URL")!, {
  max: 4,
  ssl: "require",
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 15,
  types: {
    rnwDate: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
    rnwTs: { to: 1184, from: [1184], serialize: (x: unknown) => String(x), parse: parseTs },
    rnwTsNoTz: { to: 1114, from: [1114], serialize: (x: unknown) => String(x), parse: (x: string) => x.replace(" ", "T") },
    rnwBig: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
    rnwNum: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
  },
});

// ---------- metadata ----------
interface ColInfo { type: string; udt: string; isArray: boolean }
interface FkInfo { name: string; fromTable: string; fromCol: string; toTable: string; toCol: string }
interface Meta { cols: Map<string, Map<string, ColInfo>>; fks: FkInfo[]; pks: Map<string, string[]> }
let metaPromise: Promise<Meta> | null = null;

function loadMeta(): Promise<Meta> {
  if (!metaPromise) {
    metaPromise = (async () => {
      const cols = await sql`select table_name, column_name, data_type, udt_name from information_schema.columns
        where table_schema='public' and table_name like 'renowell\\_%'`;
      const fks = await sql`select tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name as to_table, ccu.column_name as to_col
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema
        join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
        where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public' and tc.table_name like 'renowell\\_%'`;
      const pks = await sql`select tc.table_name, kcu.column_name from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema
        where tc.constraint_type='PRIMARY KEY' and tc.table_schema='public' and tc.table_name like 'renowell\\_%'`;
      const m: Meta = { cols: new Map(), fks: [], pks: new Map() };
      for (const c of cols) {
        if (!m.cols.has(c.table_name)) m.cols.set(c.table_name, new Map());
        const isArray = c.data_type === "ARRAY";
        m.cols.get(c.table_name)!.set(c.column_name, {
          type: c.data_type, udt: isArray ? String(c.udt_name).slice(1) : c.udt_name, isArray,
        });
      }
      for (const f of fks) m.fks.push({ name: f.constraint_name, fromTable: f.table_name, fromCol: f.column_name, toTable: f.to_table, toCol: f.to_col });
      for (const p of pks) { const a = m.pks.get(p.table_name) ?? []; a.push(p.column_name); m.pks.set(p.table_name, a); }
      return m;
    })().catch((e) => { metaPromise = null; throw e; });
  }
  return metaPromise;
}

export function physical(table: string): string {
  const t = table.startsWith(PREFIX) ? table : PREFIX + table;
  if (!IDENT.test(t)) throw new Error(`Invalid table: ${table}`);
  return t;
}
function logical(t: string) { return t.startsWith(PREFIX) ? t.slice(PREFIX.length) : t; }
function q(id: string) { if (!IDENT.test(id)) throw new Error(`Invalid identifier: ${id}`); return `"${id}"`; }

function arrayLiteral(arr: unknown[]): string {
  return "{" + arr.map((v) => v === null || v === undefined ? "NULL" : '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"').join(",") + "}";
}

// ---------- param builder ----------
class Params {
  values: (string | null)[] = [];
  add(val: unknown, col?: ColInfo, forceArray = false): string {
    if (val === null || val === undefined) { this.values.push(null); return `$${this.values.length}` + (col ? this.cast(col, forceArray) : ""); }
    let s: string;
    if (col && col.udt === "jsonb" && !forceArray) s = typeof val === "string" && col.isArray === false && looksJson(val) ? val : JSON.stringify(val);
    else if (Array.isArray(val)) s = arrayLiteral(val);
    else if (typeof val === "object") s = JSON.stringify(val);
    else s = String(val);
    this.values.push(s);
    return `$${this.values.length}` + (col ? this.cast(col, forceArray) : "");
  }
  cast(col: ColInfo, forceArray: boolean) {
    const base = col.udt;
    return (col.isArray || forceArray) ? `::${base}[]` : `::${base}`;
  }
}
function looksJson(s: string) { const t = s.trim(); return t.startsWith("{") || t.startsWith("["); }

export interface Filter { column: string; operator: string; value: unknown }
export interface OrderBy { column: string; ascending?: boolean; nullsFirst?: boolean }

function parseInList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const s = String(v).trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!s) return [];
  return s.split(",").map((x) => x.trim().replace(/^"(.*)"$/, "$1"));
}

function buildWhere(table: string, filters: Filter[] | undefined, p: Params, meta: Meta): string {
  if (!filters?.length) return "";
  const cols = meta.cols.get(table);
  const parts: string[] = [];
  for (const f of filters) {
    let op = f.operator;
    let negate = false;
    if (op.startsWith("not.")) { negate = true; op = op.slice(4); }
    const col = cols?.get(f.column);
    if (!col) throw new Error(`Unknown column ${f.column} on ${logical(table)}`);
    const c = q(f.column);
    let expr: string;
    switch (op) {
      case "eq": expr = f.value === null ? `${c} is null` : `${c} = ${p.add(f.value, col)}`; break;
      case "neq": expr = `${c} <> ${p.add(f.value, col)}`; break;
      case "gt": expr = `${c} > ${p.add(f.value, col)}`; break;
      case "gte": expr = `${c} >= ${p.add(f.value, col)}`; break;
      case "lt": expr = `${c} < ${p.add(f.value, col)}`; break;
      case "lte": expr = `${c} <= ${p.add(f.value, col)}`; break;
      case "like": expr = `${c}::text like ${p.add(f.value)}`; break;
      case "ilike": expr = `${c}::text ilike ${p.add(f.value)}`; break;
      case "in": {
        const list = parseInList(f.value);
        expr = list.length ? `${c} = any(${p.add(list, { ...col, isArray: false }, true)})` : "false";
        break;
      }
      case "is": {
        const v = f.value;
        if (v === null || v === "null") expr = `${c} is null`;
        else if (v === true || v === "true") expr = `${c} is true`;
        else if (v === false || v === "false") expr = `${c} is false`;
        else throw new Error("Bad is value");
        break;
      }
      case "cs": case "cd": case "ov": {
        const sym = op === "cs" ? "@>" : op === "cd" ? "<@" : "&&";
        if (col.udt === "jsonb") expr = `${c} ${sym} ${p.add(typeof f.value === "string" ? f.value : JSON.stringify(f.value))}::jsonb`;
        else {
          const val = typeof f.value === "string" ? f.value : arrayLiteral(f.value as unknown[]);
          p.values.push(val);
          expr = `${c} ${sym} $${p.values.length}::${col.udt}[]`;
        }
        break;
      }
      default: throw new Error(`Unsupported operator ${op}`);
    }
    parts.push(negate ? `not (${expr})` : expr);
  }
  return " where " + parts.join(" and ");
}

// ---------- select parsing ----------
interface Embed { alias: string; table: string; hint?: string; inner: SelectSpec }
interface SelectSpec { star: boolean; cols: { name: string; alias: string }[]; embeds: Embed[] }

function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0; let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseSelect(s: string | undefined): SelectSpec {
  const spec: SelectSpec = { star: false, cols: [], embeds: [] };
  const items = splitTop((s ?? "*").replace(/\s+/g, " "));
  for (const it of items) {
    const paren = it.indexOf("(");
    if (paren > 0 && it.endsWith(")")) {
      const head = it.slice(0, paren).trim();
      const inner = it.slice(paren + 1, -1);
      let alias = head, rest = head;
      if (head.includes(":")) { [alias, rest] = head.split(":").map((x) => x.trim()); }
      let table = rest, hint: string | undefined;
      if (rest.includes("!")) { [table, hint] = rest.split("!").map((x) => x.trim()); }
      if (!head.includes(":")) alias = table;
      spec.embeds.push({ alias, table, hint, inner: parseSelect(inner) });
    } else if (it === "*") spec.star = true;
    else {
      let alias = it, name = it;
      if (it.includes(":")) [alias, name] = it.split(":").map((x) => x.trim());
      name = name.replace(/::\w+$/, "");
      spec.cols.push({ name, alias });
    }
  }
  if (!spec.star && spec.cols.length === 0 && spec.embeds.length === 0) spec.star = true;
  return spec;
}

function selectList(table: string, spec: SelectSpec, meta: Meta, extra: string[]): string {
  if (spec.star) return "*";
  const cols = meta.cols.get(table)!;
  const parts = spec.cols.map((c) => {
    if (!cols.has(c.name)) throw new Error(`Unknown column ${c.name} on ${logical(table)}`);
    return c.alias === c.name ? q(c.name) : `${q(c.name)} as ${q(c.alias)}`;
  });
  for (const e of extra) if (!spec.cols.some((c) => c.name === e)) parts.push(q(e));
  return parts.join(", ");
}

function findFk(base: string, target: string, hint: string | undefined, meta: Meta): { fk: FkInfo; manyToOne: boolean } {
  const hintName = hint ? (hint.startsWith(PREFIX) ? hint : PREFIX + hint) : undefined;
  const cands = meta.fks.filter((f) => (f.fromTable === base && f.toTable === target) || (f.fromTable === target && f.toTable === base));
  let fk = hintName ? cands.find((f) => f.name === hintName || f.fromCol === hint) : undefined;
  if (!fk) fk = cands.find((f) => f.fromTable === base) ?? cands[0];
  if (!fk) throw new Error(`No relationship between ${logical(base)} and ${logical(target)}`);
  return { fk, manyToOne: fk.fromTable === base && fk.toTable === target };
}

async function resolveEmbeds(tx: postgres.Sql, base: string, rows: Record<string, unknown>[], spec: SelectSpec, meta: Meta) {
  for (const e of spec.embeds) {
    const target = physical(e.table);
    if (!meta.cols.has(target)) throw new Error(`Unknown table ${e.table}`);
    const { fk, manyToOne } = findFk(base, target, e.hint, meta);
    const localCol = manyToOne ? fk.fromCol : fk.toCol;
    const remoteCol = manyToOne ? fk.toCol : fk.fromCol;
    const keys = [...new Set(rows.map((r) => r[localCol]).filter((v) => v !== null && v !== undefined).map(String))];
    let related: Record<string, unknown>[] = [];
    if (keys.length) {
      const p = new Params();
      const rc = meta.cols.get(target)!.get(remoteCol)!;
      const list = selectList(target, e.inner, meta, [remoteCol, ...embedKeys(target, e.inner, meta)]);
      related = await tx.unsafe(`select ${list} from public.${q(target)} where ${q(remoteCol)} = any(${p.add(keys, { ...rc, isArray: false }, true)})`, p.values) as unknown as Record<string, unknown>[];
      related = related.map((r) => ({ ...r }));
      await resolveEmbeds(tx, target, related, e.inner, meta);
    }
    for (const r of rows) {
      const k = r[localCol];
      if (manyToOne) r[e.alias] = k == null ? null : related.find((x) => String(x[remoteCol]) === String(k)) ?? null;
      else r[e.alias] = related.filter((x) => String(x[remoteCol]) === String(k));
    }
  }
}

function embedKeys(table: string, spec: SelectSpec, meta: Meta): string[] {
  const out: string[] = [];
  for (const e of spec.embeds) {
    const { fk, manyToOne } = findFk(table, physical(e.table), e.hint, meta);
    out.push(manyToOne ? fk.fromCol : fk.toCol);
  }
  return out;
}

// ---------- execution ----------
export interface QueryRequest {
  action: "select" | "insert" | "update" | "delete" | "upsert";
  table: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  select?: string;
  returning?: boolean;
  order?: OrderBy[];
  limit?: number;
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export interface QueryResult<T = unknown> { data: T | null; error: { message: string; code?: string; details?: string } | null }

export async function runQuery<T = Record<string, unknown>[]>(req: QueryRequest, userId?: string | null): Promise<QueryResult<T>> {
  try {
    const meta = await loadMeta();
    const table = physical(req.table);
    const cols = meta.cols.get(table);
    if (!cols) throw new Error(`Unknown table ${req.table}`);
    const spec = parseSelect(req.select);
    const callerWantsRows = req.action === "select" || req.returning || !!req.select;
    const isNotifInsert = table === "renowell_notifications" && (req.action === "insert" || req.action === "upsert");
    const wantRows = callerWantsRows || isNotifInsert;

    const rows = await sql.begin(async (tx) => {
      if (userId) await tx`select set_config('app.user_id', ${userId}, true)`;
      const p = new Params();
      let text = "";
      const ret = wantRows ? ` returning ${selectList(table, spec, meta, embedKeys(table, spec, meta))}` : "";
      switch (req.action) {
        case "select": {
          text = `select ${selectList(table, spec, meta, embedKeys(table, spec, meta))} from public.${q(table)}` + buildWhere(table, req.filters, p, meta);
          if (req.order?.length) text += " order by " + req.order.map((o) => {
            if (!cols.has(o.column)) throw new Error(`Unknown column ${o.column}`);
            const asc = o.ascending ?? true;
            const nulls = o.nullsFirst === undefined ? (asc ? "nulls last" : "nulls first") : (o.nullsFirst ? "nulls first" : "nulls last");
            return `${q(o.column)} ${asc ? "asc" : "desc"} ${nulls}`;
          }).join(", ");
          if (req.limit) text += ` limit ${Math.max(0, Math.floor(Number(req.limit)))}`;
          break;
        }
        case "insert": case "upsert": {
          const list = (Array.isArray(req.data) ? req.data : [req.data ?? {}]) as Record<string, unknown>[];
          if (!list.length) return [];
          const keys = [...new Set(list.flatMap((r) => Object.keys(r)))].filter((k) => cols.has(k));
          if (!keys.length) { text = `insert into public.${q(table)} default values${ret}`; break; }
          const values = list.map((r) => "(" + keys.map((k) => k in r ? p.add(r[k], cols.get(k)) : "default").join(", ") + ")").join(", ");
          text = `insert into public.${q(table)} (${keys.map(q).join(", ")}) values ${values}`;
          if (req.action === "upsert") {
            const conflict = (req.onConflict ? req.onConflict.split(",").map((s) => s.trim()) : (meta.pks.get(table) ?? ["id"]));
            conflict.forEach(q);
            const upd = keys.filter((k) => !conflict.includes(k));
            text += ` on conflict (${conflict.map(q).join(", ")}) ` + (req.ignoreDuplicates || !upd.length ? "do nothing" : "do update set " + upd.map((k) => `${q(k)} = excluded.${q(k)}`).join(", "));
          }
          text += ret;
          break;
        }
        case "update": {
          const d = (req.data ?? {}) as Record<string, unknown>;
          const keys = Object.keys(d).filter((k) => cols.has(k));
          if (!keys.length) throw new Error("Nothing to update");
          if (!req.filters?.length) throw new Error("Update requires filters");
          text = `update public.${q(table)} set ` + keys.map((k) => `${q(k)} = ${p.add(d[k], cols.get(k))}`).join(", ") + buildWhere(table, req.filters, p, meta) + ret;
          break;
        }
        case "delete": {
          if (!req.filters?.length) throw new Error("Delete requires filters");
          text = `delete from public.${q(table)}` + buildWhere(table, req.filters, p, meta) + ret;
          break;
        }
        default: throw new Error(`Unknown action ${req.action}`);
      }
      const r = await tx.unsafe(text, p.values) as unknown as Record<string, unknown>[];
      const plain = r.map((x) => ({ ...x }));
      if (wantRows && spec.embeds.length) await resolveEmbeds(tx, table, plain, spec, meta);
      return plain;
    });

    if (isNotifInsert && rows.length) {
      // replaces DB trigger notify_external_channels
      const job = dispatchExternalNotifications(rows.map((r) => String(r.id))).catch((e) => console.warn("[renowellDb] notify dispatch failed", e));
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(job);
    }
    return { data: (callerWantsRows ? rows : null) as T, error: null };
  } catch (e) {
    const err = e as { message?: string; code?: string; detail?: string };
    console.error("[renowellDb]", req.action, req.table, err.message);
    return { data: null, error: { message: err.message ?? String(e), code: err.code, details: err.detail } };
  }
}

// ---------- notifications dispatch (ex-trigger) ----------
async function dispatchExternalNotifications(ids: string[]) {
  const mskHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Moscow" }).format(new Date()));
  if (mskHour >= 21 || mskHour < 9) {
    await sql`update public.renowell_notifications set send_after =
      (date_trunc('day', now() at time zone 'Europe/Moscow') + case when ${mskHour} >= 21 then interval '1 day' else interval '0' end + interval '9 hours') at time zone 'Europe/Moscow'
      where id = any(${ids}::uuid[])`;
    return;
  }
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-external-notification`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  for (const id of ids) {
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ notification_id: id }) });
      await sql`update public.renowell_notifications set external_sent = true where id = ${id}::uuid`;
    } catch (e) { console.warn("[renowellDb] external notification failed", id, e); }
  }
}

// ---------- supabase-js-like fluent client for edge functions ----------
type Thenable<T> = PromiseLike<QueryResult<T>>;

class Builder<T = any> implements Thenable<T> {
  private req: QueryRequest;
  private mode: "many" | "single" | "maybe" = "many";
  constructor(table: string, private userId?: string | null) {
    this.req = { action: "select", table, filters: [] };
  }
  select(cols = "*", _opts?: unknown) { if (this.req.action === "select") this.req.select = cols; else { this.req.select = cols; this.req.returning = true; } return this; }
  insert(data: any, _opts?: unknown) { this.req.action = "insert"; this.req.data = data; return this; }
  upsert(data: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.req.action = "upsert"; this.req.data = data; this.req.onConflict = opts?.onConflict; this.req.ignoreDuplicates = opts?.ignoreDuplicates; return this; }
  update(data: any) { this.req.action = "update"; this.req.data = data; return this; }
  delete() { this.req.action = "delete"; return this; }
  private f(column: string, operator: string, value: unknown) { this.req.filters!.push({ column, operator, value }); return this; }
  eq(c: string, v: unknown) { return this.f(c, "eq", v); }
  neq(c: string, v: unknown) { return this.f(c, "neq", v); }
  gt(c: string, v: unknown) { return this.f(c, "gt", v); }
  gte(c: string, v: unknown) { return this.f(c, "gte", v); }
  lt(c: string, v: unknown) { return this.f(c, "lt", v); }
  lte(c: string, v: unknown) { return this.f(c, "lte", v); }
  like(c: string, v: unknown) { return this.f(c, "like", v); }
  ilike(c: string, v: unknown) { return this.f(c, "ilike", v); }
  in(c: string, v: unknown[]) { return this.f(c, "in", v); }
  is(c: string, v: unknown) { return this.f(c, "is", v); }
  contains(c: string, v: unknown) { return this.f(c, "cs", v); }
  containedBy(c: string, v: unknown) { return this.f(c, "cd", v); }
  overlaps(c: string, v: unknown) { return this.f(c, "ov", v); }
  not(c: string, op: string, v: unknown) { return this.f(c, "not." + op, v); }
  filter(c: string, op: string, v: unknown) { return this.f(c, op, v); }
  match(obj: Record<string, unknown>) { for (const [k, v] of Object.entries(obj)) this.f(k, "eq", v); return this; }
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) { (this.req.order ??= []).push({ column, ascending: opts?.ascending, nullsFirst: opts?.nullsFirst }); return this; }
  limit(n: number) { this.req.limit = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  private async exec(): Promise<QueryResult<T>> {
    const r = await runQuery<any[]>(this.req, this.userId);
    if (r.error || this.mode === "many") return r as QueryResult<T>;
    const rows = r.data ?? [];
    if (this.mode === "single" && rows.length !== 1) return { data: null, error: { message: rows.length ? "Multiple rows returned" : "No rows found", code: "PGRST116" } };
    return { data: (rows[0] ?? null) as T, error: null };
  }
  then<A = QueryResult<T>, B = never>(ok?: ((v: QueryResult<T>) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.exec().then(ok, fail);
  }
}

export function createDb(userId?: string | null) {
  return { from: <T = any>(table: string) => new Builder<T>(table, userId) };
}
export const db = createDb();
