import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve("supabase/migrations/20261013_harden_authorization_and_sessions.sql"),
  "utf8",
);

test("citizen cannot directly elevate role or reactivate itself", () => {
  assert.match(migration, /REVOKE UPDATE ON TABLE public\.profiles FROM authenticated/i);
  assert.match(migration, /GRANT UPDATE \(full_name, display_name, phone, organization\) ON TABLE public\.profiles TO authenticated/i);
  assert.match(migration, /CREATE POLICY "Cập nhật hồ sơ cá nhân an toàn"[\s\S]*USING \(id = auth\.uid\(\)\)[\s\S]*WITH CHECK \(id = auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /GRANT UPDATE \(.*\brole\b/i);
  assert.doesNotMatch(migration, /GRANT UPDATE \(.*\bactive\b/i);
});

test("only the database-admin RPC may change authorization fields", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_update_profile_authorization/i);
  assert.match(migration, /IF public\.current_user_role\(\) IS DISTINCT FROM 'admin'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_update_profile_authorization[\s\S]*FROM PUBLIC/i);
});

test("shelters and location history remain denied to non-operational users", () => {
  const previous = readFileSync(resolve("supabase/migrations/DISABLED__20261012_fix_auth_and_persistence.sql"), "utf8");
  assert.match(previous, /"Cán bộ quản lý điểm sơ tán"[\s\S]*current_user_role\(\) IN \('admin', 'disaster_officer'\)/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.location_history FROM anon, authenticated/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.location_history TO authenticated/i);
  assert.match(migration, /ALTER TABLE public\.location_history ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /FOR SELECT TO authenticated[\s\S]*USING \(public\.is_operational_staff\(\)\)/);
});

test("new migration replaces broad grants and permissive intake checks", () => {
  assert.match(migration, /REVOKE ALL ON TABLE[\s\S]*public\.location_history[\s\S]*FROM authenticated/i);
  assert.match(migration, /REVOKE ALL ON TABLE[\s\S]*FROM anon/i);
  assert.match(migration, /WITH CHECK \(owner_user_id = auth\.uid\(\)::text AND code <> '' AND description <> ''\)/);
  assert.match(migration, /WITH CHECK \(owner_user_id IS NULL AND code <> '' AND description <> ''\)/);
  assert.doesNotMatch(migration, /WITH CHECK \(true\)/i);
  assert.doesNotMatch(migration, /GRANT .* ON ALL TABLES/i);
});

test("authorization helpers have a fixed search path and are not public", () => {
  assert.match(migration, /current_user_role\(\)[\s\S]*SET search_path = public, auth, pg_temp/i);
  assert.match(migration, /is_operational_staff\(\)[\s\S]*SET search_path = public, auth, pg_temp/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.current_user_role\(\) FROM PUBLIC/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.is_operational_staff\(\) FROM PUBLIC/i);
});
