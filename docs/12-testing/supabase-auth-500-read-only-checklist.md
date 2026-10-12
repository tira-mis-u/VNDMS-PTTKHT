# Read-only diagnosis: Supabase Auth HTTP 500

Observed request: `signInWithPassword` for the configured project returned HTTP 500 with `Database error querying schema`; no session was issued. This symptom does not establish a cause.

Before any change to `auth.users`, `auth.identities`, Auth triggers, or Auth configuration, the project owner should collect the following read-only evidence in the Supabase Dashboard:

1. In **Logs Explorer**, filter Auth/GoTrue logs to the exact UTC time of a reproduced login. Record request ID, status, and the full database error detail; redact password, JWT, refresh token, API keys, and email addresses before sharing.
2. In **Authentication → Providers**, record whether Email is enabled and whether **Confirm email** is enabled. Do not change either setting during diagnosis.
3. In **Database → Triggers**, list triggers on `auth.users`, including function name, timing, and enabled state. Confirm whether any trigger error coincides with the request ID.
4. In **Database → Functions**, inspect only definitions/metadata for functions called by those triggers and check their owner/search path.
5. In a read-only SQL session, export the structure (not credentials or token values) of `auth.users` and `auth.identities`, and count email identities grouped by provider. Compare it with the Auth version in the project logs.
6. Record whether `public.handle_new_user()` failed during a controlled sign-up attempt, including the database error and request ID.

Only after the log identifies a concrete failing object should a narrowly scoped, reviewed migration be proposed. The authorization-hardening migration does not modify `auth.*` and is not a cure for this Auth 500.
