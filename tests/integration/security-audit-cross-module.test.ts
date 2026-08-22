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
  const success = await loginUser(auth, "Trần Quốc Thuận", "VNDMS@2026", now);
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
  const local = demoUsers.find((item) => item.username === "Phạm Văn Đam")!;
  const decision = authorize(
    local,
    "recovery_project_approve",
    "Hoàn Kiếm, Hà Nội",
  );
  const event = createSecurityAudit({
    actorId: local.id,
    actorName: local.displayName,
    role: local.role,
    action: "PERMISSION_DENIED",
    resourceType: "RecoveryProject",
    resourceId: "RP-0241",
    timestamp: now().toISOString(),
    geographicScope: local.geographicScope.name,
    result: "DENIED",
    reason: decision.reason,
    permission: decision.permission,
  });
  assert.equal(event.actorId, local.id);
  assert.equal(event.permission, "recovery_project_approve");
  assert.equal(event.result, "DENIED");
  assert.ok(event.reason);
});
test("sensitive mutation authorization audit có attribution", () => {
  const commander = demoUsers.find(
    (item) => item.username === "Trần Quốc Thuận",
  )!;
  const decision = authorize(commander, "simulation_control");
  const event = createSecurityAudit({
    actorId: commander.id,
    actorName: commander.displayName,
    role: commander.role,
    action: "MUTATION_AUTHORIZED",
    resourceType: "PermissionBoundary",
    resourceId: "red-river-flood-hanoi",
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
  assert.equal(parseRoute("/simulation").name, "simulation");
});
