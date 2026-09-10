/*
 * V2 (4 vai): username thật; permission cũ (recovery_project_approve, simulation_control)
 * và route /simulation đã xóa → dùng sos_dispatch (công dân bị từ chối) và user_manage
 * (admin được phép); thêm kiểm tra route /simulation trả not-found.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createSecurityAudit,
  loginUser,
  logoutUser,
} from "../../src/application/auth/authUseCases";
import {
  LocalAuthenticationAdapter,
  type StorageLike,
} from "../../src/infrastructure/auth/localAuthenticationAdapter";
import { LocalAuditAdapter } from "../../src/infrastructure/auth/localAuditAdapter";
import { authorize } from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { parseRoute } from "../../src/app/routes/router";
class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
const now = () => new Date("2026-08-21T03:45:00.000Z");
test("audit adapter lưu login success, failed và logout theo thứ tự", async () => {
  const storage = new MemoryStorage();
  const auth = new LocalAuthenticationAdapter(storage, now, () => "token");
  const audit = new LocalAuditAdapter(storage);
  const success = await loginUser(auth, "thuantq", "VNDMS@2026", now);
  audit.append(success.audit);
  const failed = await loginUser(auth, "unknown", "bad", now);
  audit.append(failed.audit);
  audit.append(logoutUser(auth, success.user!, success.session!, now));
  assert.deepEqual(
    audit.load().map((item) => item.action),
    ["LOGOUT", "LOGIN_FAILED", "LOGIN_SUCCESS"],
  );
  assert.ok(audit.load().every((item) => item.timestamp && item.result));
});
test("permission denied có actor, scope, permission và reason", () => {
  const local = demoUsers.find((item) => item.username === "phamdam")!;
  const decision = authorize(local, "sos_dispatch", "Hoàn Kiếm, Hà Nội");
  const event = createSecurityAudit({
    actorId: local.id,
    actorName: local.displayName,
    role: local.role,
    action: "PERMISSION_DENIED",
    resourceType: "SosRequest",
    resourceId: "SOS-YAGI-04",
    timestamp: now().toISOString(),
    geographicScope: local.geographicScope.name,
    result: "DENIED",
    reason: decision.reason,
    permission: decision.permission,
  });
  assert.equal(event.actorId, local.id);
  assert.equal(event.permission, "sos_dispatch");
  assert.equal(event.result, "DENIED");
  assert.ok(event.reason);
});
test("sensitive mutation authorization audit có attribution", () => {
  const commander = demoUsers.find((item) => item.username === "thuantq")!;
  const decision = authorize(commander, "user_manage");
  const event = createSecurityAudit({
    actorId: commander.id,
    actorName: commander.displayName,
    role: commander.role,
    action: "MUTATION_AUTHORIZED",
    resourceType: "PermissionBoundary",
    resourceId: "USR-WHS-001",
    timestamp: now().toISOString(),
    geographicScope: commander.geographicScope.name,
    result: decision.allowed ? "SUCCESS" : "DENIED",
    reason: decision.reason,
    permission: decision.permission,
  });
  assert.equal(event.result, "SUCCESS");
  assert.equal(event.actorName, commander.displayName);
  assert.equal(event.geographicScope, "Toàn quốc");
});
test("router nhận login, protected application và admin routes", () => {
  assert.equal(parseRoute("/login").name, "login");
  assert.equal(parseRoute("/command").name, "command-center");
  assert.equal(parseRoute("/admin/users").name, "admin-users");
  assert.equal(parseRoute("/admin/audit").name, "admin-audit");
  // Module Mô phỏng đã xóa thật: route không còn tồn tại.
  assert.equal(parseRoute("/simulation").name, "not-found");
  assert.equal(parseRoute("/relief/requests").name, "not-found");
  assert.equal(parseRoute("/recovery").name, "not-found");
  assert.equal(parseRoute("/reports").name, "report-list");
});
