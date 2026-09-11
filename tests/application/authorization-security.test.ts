/*
 * V2 (4 vai): các quyền cũ (recovery_project_approve, relief_approve, damage_assessment_edit,
 * warehouse_update, simulation_control) đã xóa cùng module. Test giữ nguyên contract
 * (broad permission, missing permission có lý do, scope địa lý, ownership, inactive,
 * admin use cases) trên permission V2 và tài khoản theo username thật.
 */
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
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
test("Cán bộ PCTT có broad permission và national scope; Quản trị viên toàn quyền nghiệp vụ", () => {
  const officer = authorize(user("nguyentrung"), "task_review", "Bảo Yên, Lào Cai");
  assert.equal(officer.allowed, true);
  const admin = authorize(user("thuantq"), "task_review", "Bảo Yên, Lào Cai");
  assert.equal(admin.allowed, true);
  assert.equal(authorize(user("thuantq"), "user_manage").allowed, true);
  assert.equal(authorize(user("nguyentrung"), "user_manage").allowed, false);
});
test("missing permission trả quyết định có lý do", () => {
  const decision = authorize(user("minhtri"), "sos_dispatch", "Hà Nội");
  assert.equal(decision.allowed, false);
  assert.equal(decision.permission, "sos_dispatch");
  assert.match(decision.reason, /không được cấp quyền/);
});
test("Công dân chỉ thao tác trong địa bàn của mình", () => {
  const local = user("phamdam");
  assert.equal(isWithinGeographicScope(local, "Phường Tứ Liên, Tây Hồ, Hà Nội"), true);
  assert.equal(authorize(local, "sos_create", "Tứ Liên, Tây Hồ, Hà Nội").allowed, true);
  const denied = authorize(local, "sos_create", "Hoàn Kiếm, Hà Nội");
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /ngoài phạm vi/);
});
test("ownership *_own được enforcement theo ownerUserId, không theo kho/đội cũ", () => {
  const former = user("namanh");
  assert.equal(former.role, "citizen");
  assert.equal(former.warehouseId, undefined, "warehouseId cũ đã gỡ khỏi tài khoản");
  assert.equal(authorize(former, "sos_view_own", "Hoàn Kiếm, Hà Nội", former.id).allowed, true);
  assert.equal(authorize(former, "sos_view_own", "Hoàn Kiếm, Hà Nội", "USR-OTHER").allowed, false);
  assert.equal(authorize(former, "sos_view", "Hoàn Kiếm, Hà Nội").allowed, false);
});
test("unauthenticated mutation bị từ chối", () => {
  assert.throws(() => assertAuthorized(null, "dispatch"), /Phiên đăng nhập/);
});
test("inactive user bị từ chối dù role có permission", () => {
  const admin = user("thuantq");
  admin.active = false;
  assert.equal(authorize(admin, "user_manage").allowed, false);
});
test("admin use cases cập nhật active role và scope có validation", () => {
  const admin = user("thuantq");
  let users = structuredClone(demoUsers);
  users = setUserActive(users, "USR-WHS-001", false, admin, "2026-08-21T04:00:00Z");
  assert.equal(users.find((item) => item.id === "USR-WHS-001")?.active, false);
  users = changeUserRole(users, "USR-WHS-001", "disaster_officer", "2026-08-21T04:01:00Z");
  assert.equal(users.find((item) => item.id === "USR-WHS-001")?.role, "disaster_officer");
  users = changeUserScope(
    users,
    "USR-WHS-001",
    { level: "district", name: "Tây Hồ, Hà Nội", code: "HN-TAYHO" },
    "2026-08-21T04:02:00Z",
  );
  assert.equal(users.find((item) => item.id === "USR-WHS-001")?.geographicScope.code, "HN-TAYHO");
  assert.throws(() => setUserActive(users, admin.id, false, admin, "now"), /tự vô hiệu hóa/);
});
