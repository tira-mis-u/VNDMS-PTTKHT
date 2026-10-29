import assert from "node:assert/strict";
import test from "node:test";
import {
  dutyEntryToRow,
  rowToDutyEntry,
  type DutyLogEntry,
} from "../../src/infrastructure/duty/dutyLogStore";
import {
  auditEventToRow,
  rowToAuditEvent,
  SupabaseAuditAdapter,
} from "../../src/infrastructure/auth/supabaseAuditAdapter";
import type { SecurityAuditEvent } from "../../src/domain/auth/types";
import type { StorageLike } from "../../src/infrastructure/auth/localAuthenticationAdapter";

class MockStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

test("DutyLog: chuyển đổi 2 chiều DutyLogEntry <-> Database Row", () => {
  const original: DutyLogEntry = {
    id: "DUTY-TEST-001",
    at: "2026-10-29T10:00:00.000Z",
    actor: "Trần Quốc Thuận",
    actorRole: "Quản trị viên",
    actorId: "a0000000-0000-0000-0000-000000000001",
    source: "manual",
    kind: "Chỉ đạo",
    text: "Huy động 2 xuồng cứu sinh đến xã An Khánh",
    status: "open",
    taskId: "TASK-001",
    shiftRef: "Ca 1 · 29/10/2026",
    followUp: true,
    handover: {
      toName: "Nguyễn Trung",
      pending: "Theo dõi 2 xuồng cứu hộ",
      receivedBy: "Nguyễn Trung",
      receivedAt: "2026-10-29T14:00:00.000Z",
    },
    link: {
      kind: "task",
      id: "TASK-001",
      code: "TASK-001",
    },
  };

  const row = dutyEntryToRow(original);
  assert.equal(row.id, original.id);
  assert.equal(row.actor, original.actor);
  assert.equal(row.actor_role, original.actorRole);
  assert.equal(row.actor_id, original.actorId);
  assert.equal(row.kind, original.kind);
  assert.equal(row.text, original.text);
  assert.equal(row.status, original.status);
  assert.equal(row.task_id, original.taskId);
  assert.equal(row.follow_up, original.followUp);
  assert.deepEqual(row.handover, original.handover);
  assert.deepEqual(row.link, original.link);

  const restored = rowToDutyEntry(row);
  assert.equal(restored.id, original.id);
  assert.equal(restored.actor, original.actor);
  assert.equal(restored.actorRole, original.actorRole);
  assert.equal(restored.actorId, original.actorId);
  assert.equal(restored.kind, original.kind);
  assert.equal(restored.text, original.text);
  assert.equal(restored.status, original.status);
  assert.equal(restored.taskId, original.taskId);
  assert.equal(restored.followUp, original.followUp);
  assert.deepEqual(restored.handover, original.handover);
  assert.deepEqual(restored.link, original.link);
});

test("SecurityAudit: chuyển đổi 2 chiều SecurityAuditEvent <-> Database Row", () => {
  const event: SecurityAuditEvent = {
    id: "AUDIT-001",
    timestamp: "2026-10-29T12:00:00.000Z",
    actorId: "a0000000-0000-0000-0000-000000000001",
    actorName: "Trần Quốc Thuận",
    role: "admin",
    action: "OPERATIONAL_MUTATION",
    resourceType: "Incident",
    resourceId: "INC-YAGI-001",
    geographicScope: "Tỉnh Lào Cai",
    result: "SUCCESS",
    reason: "Điều động lực lượng cứu hộ khẩn cấp",
  };

  const row = auditEventToRow(event);
  assert.equal(row.id, event.id);
  assert.equal(row.timestamp, event.timestamp);
  assert.equal(row.actor_id, event.actorId);
  assert.equal(row.actor_name, event.actorName);
  assert.equal(row.role, event.role);
  assert.equal(row.action, event.action);
  assert.equal(row.resource_type, event.resourceType);
  assert.equal(row.resource_id, event.resourceId);
  assert.equal(row.geographic_scope, event.geographicScope);
  assert.equal(row.result, event.result);
  assert.equal(row.reason, event.reason);

  const restored = rowToAuditEvent(row);
  assert.equal(restored.id, event.id);
  assert.equal(restored.timestamp, event.timestamp);
  assert.equal(restored.actorId, event.actorId);
  assert.equal(restored.actorName, event.actorName);
  assert.equal(restored.role, event.role);
  assert.equal(restored.action, event.action);
  assert.equal(restored.resourceType, event.resourceType);
  assert.equal(restored.resourceId, event.resourceId);
  assert.equal(restored.geographicScope, event.geographicScope);
  assert.equal(restored.result, event.result);
  assert.equal(restored.reason, event.reason);
});

test("SupabaseAuditAdapter: lưu và đọc sự kiện bộ nhớ đệm an toàn", () => {
  const storage = new MockStorage();
  const adapter = new SupabaseAuditAdapter(storage);

  assert.deepEqual(adapter.load(), []);

  const event1: SecurityAuditEvent = {
    id: "AUDIT-E1",
    timestamp: "2026-10-29T08:00:00.000Z",
    actorId: "u1",
    actorName: "User 1",
    role: "dispatcher",
    action: "LOGIN_SUCCESS",
    resourceType: "Session",
    resourceId: "SES-1",
    geographicScope: "Hà Nội",
    result: "SUCCESS",
    reason: "Đăng nhập thành công",
  };

  const event2: SecurityAuditEvent = {
    id: "AUDIT-E2",
    timestamp: "2026-10-29T08:05:00.000Z",
    actorId: "u2",
    actorName: "User 2",
    role: "admin",
    action: "USER_ACTIVATED",
    resourceType: "User",
    resourceId: "u3",
    geographicScope: "Toàn quốc",
    result: "SUCCESS",
    reason: "Kích hoạt tài khoản điều hành",
  };

  adapter.append(event1);
  adapter.append(event2);

  const loaded = adapter.load();
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, "AUDIT-E2"); // mới nhất trước
  assert.equal(loaded[1].id, "AUDIT-E1");
});

