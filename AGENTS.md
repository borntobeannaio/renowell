# Architecture rules

- App data and users live in the external PostgreSQL (secret `RENOWELL_DATABASE_URL`), all tables prefixed `renowell_`; the Lovable Cloud database is legacy and must not be written to. Why: the customer requires their own database.
- Edge functions access data only through `supabase/functions/_shared/renowellDb.ts` (`runQuery` / `db.from()` shim using logical table names). Why: one place for prefixing, identifier validation and PostgREST-style embeds.
- Authentication is custom: `auth-proxy` + `_shared/renowellAuth.ts` (bcrypt in `renowell_users`, HS256 JWT signed with `RENOWELL_JWT_SECRET`, rotating refresh tokens). The browser never calls Supabase Auth. Why: users moved to the external DB.
- The browser reaches the backend only through the Yandex Cloud proxy (`dbProxy`/`proxyInvoke`/`authProxy`), sending the access token in body `_accessToken`. Why: supabase.co is blocked in RF and the proxy strips custom headers.
- Access checks formerly done by RLS are enforced in the app/edge code; DB triggers read the acting user from `current_setting('app.user_id')`, set per transaction by `runQuery`.
- No realtime subscriptions: use polling (`refetchInterval` / `src/lib/poll.ts`). Why: no Supabase Realtime on the external DB.
- File storage stays in Yandex S3 and the existing `avatars` storage bucket (via proxies).
