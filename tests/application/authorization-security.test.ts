import assert from "node:assert/strict";
import test from "node:test";
import {
  authorize,
  assertAuthorized,
  isWithinGeographicScope,
} from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import {
  changeUserRole,
  changeUserScope,
  setUserActive,
} from "../../src/application/auth/authUseCases";
const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
test("Commander có broad permission và national scope", () => {
  const decision = authorize(
    user("Trần Quốc Thuận"),
    "recovery_project_approve",
    "Tây Hồ, Hà Nội",
  );
  assert.equal(decision.allowed, true);
});
test("missing permission trả quyết định có lý do", () => {
  const decision = authorize(
    user("Lê Nguyễn Minh Trí"),
    "relief_approve",
    "Hà Nội",
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.permission, "relief_approve");
  assert.match(decision.reason, /không được cấp quyền/);
});
test("Local Officer chỉ thao tác trong Tây Hồ", () => {
  const local = user("Phạm Văn Đam");
  assert.equal(
    isWithinGeographicScope(local, "Phường Tứ Liên, Tây Hồ, Hà Nội"),
    true,
  );
  const denied = authorize(
    local,
    "damage_assessment_edit",
    "Hoàn Kiếm, Hà Nội",
  );
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /ngoài phạm vi/);
});
test("warehouse ownership được enforcement", () => {
  const warehouse = user("Nguyễn Nam Anh");
  assert.equal(
    authorize(warehouse, "warehouse_update", "Hoàn Kiếm, Hà Nội", "KHO-01")
      .allowed,
    true,
  );
  assert.equal(
    authorize(warehouse, "warehouse_update", "Tây Hồ, Hà Nội", "KHO-02")
      .allowed,
    false,
  );
});
test("unauthenticated mutation bị từ chối", () => {
  assert.throws(
    () => assertAuthorized(null, "simulation_control"),
    /Phiên đăng nhập/,
  );
});
test("inactive user bị từ chối dù role có permission", () => {
  const commander = user("Trần Quốc Thuận");
  commander.active = false;
  assert.equal(authorize(commander, "user_manage").allowed, false);
});
test("admin use cases cập nhật active role và scope có validation", () => {
  const commander = user("Trần Quốc Thuận");
  let users = structuredClone(demoUsers);
  users = setUserActive(
    users,
    "USR-WHS-001",
    false,
    commander,
    "2026-08-21T04:00:00Z",
  );
  assert.equal(users.find((item) => item.id === "USR-WHS-001")?.active, false);
  users = changeUserRole(
    users,
    "USR-WHS-001",
    "operator",
    "2026-08-21T04:01:00Z",
  );
  assert.equal(
    users.find((item) => item.id === "USR-WHS-001")?.role,
    "operator",
  );
  users = changeUserScope(
    users,
    "USR-WHS-001",
    { level: "district", name: "Tây Hồ, Hà Nội", code: "HN-TAYHO" },
    "2026-08-21T04:02:00Z",
  );
  assert.equal(
    users.find((item) => item.id === "USR-WHS-001")?.geographicScope.code,
    "HN-TAYHO",
  );
  assert.throws(
    () => setUserActive(users, commander.id, false, commander, "now"),
    /tự vô hiệu hóa/,
  );
});
