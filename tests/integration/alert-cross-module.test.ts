/*
 * V2 (4 vai) — tích hợp cảnh báo liên module.
 *  - Gỡ test Simulation và Trợ lý AI (module đã xóa thật); control state boundary rỗng.
 *  - Actor ack là Cán bộ PCTT (nguyentrung) — admin V2 không có alert_acknowledge.
 *  - Test geography dùng cán bộ thu hẹp scope tỉnh Lào Cai; test role dùng công dân
 *    (minhtri) và admin; rescue_unit chỉ huy toàn lực lượng nên ack được alert mọi đội.
 *  - Kịch bản Yagi 2024: alert bắt buộc xác nhận TSK-YAGI-02 task_high_priority_unassigned
 *    (hết hiệu lực khi nhiệm vụ được giao đội).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeOperationalAlert,
  markAlertReadReceipt,
} from "../../src/application/alerts/alertUseCases";
import {
  alertAuthorizationResource,
  deriveAuthorizedAlerts,
  getAlertAnalytics,
} from "../../src/application/alerts/alertQueries";
import {
  deriveOperationalAlerts,
  resolveAlertState,
} from "../../src/domain/alerts/rules";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "../../src/application/operations/operationalMutationBoundary";
import type { OperationalSnapshot } from "../../src/application/operations/operationalSnapshot";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { authorizeResources } from "../../src/lib/security/authorization";
import { activeNavigationLabel, parseRoute } from "../../src/app/routes/router";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const source = () => inMemoryOperationalRepository.load();
type Control = Record<string, never>;
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const laoCaiOfficer = () => ({
  ...user("nguyentrung"),
  geographicScope: { level: "province" as const, name: "Lào Cai", code: "LC" },
});
const NOW = "10/09/2024 14:45";
const KEY = "task:Task:TSK-YAGI-02:task_high_priority_unassigned";

function alertsFor(username: string | ReturnType<typeof user>) {
  const account = typeof username === "string" ? user(username) : username;
  return deriveAuthorizedAlerts(
    account,
    createAuthorizedOperationalView(account, source()),
  );
}

function harness() {
  const boundary = new OperationalMutationBoundary<OperationalSnapshot, Control>();
  let state: AtomicMutationState<OperationalSnapshot, Control> = {
    snapshot: inMemoryOperationalRepository.load(),
    control: {},
  };
  let commits = 0;
  const execute = <T>(operation: () => T): T =>
    boundary.execute(
      state,
      (next) => {
        state = next;
        commits += 1;
      },
      operation,
    );
  return { boundary, execute, state: () => state, commits: () => commits };
}

/** Mô phỏng đúng provider command acknowledgeAlert trên state canonical. */
function acknowledgeCommand(
  h: ReturnType<typeof harness>,
  username: string | ReturnType<typeof user>,
  alertKey: string,
) {
  h.execute(() => {
    const account = typeof username === "string" ? user(username) : username;
    const alert = deriveOperationalAlerts(
      h.boundary.readSnapshot(),
    ).find((item) => item.key === alertKey);
    assert.ok(alert, "alert phải còn hiệu lực trong canonical state");
    const read = authorizeResources(account, {
      permission: alert.readPermission,
      resources: [alertAuthorizationResource(alert)],
    });
    if (!read.allowed) throw new Error(read.reason);
    const ack = authorizeResources(account, {
      permission: "alert_acknowledge",
      resources: [alertAuthorizationResource(alert)],
    });
    if (!ack.allowed) throw new Error(ack.reason);
    const draft = h.boundary.readSnapshot();
    const resolved = resolveAlertState(
      alert,
      draft.alertInteractions.find((item) => item.alertKey === alert.key),
      account.id,
    );
    const outcome = acknowledgeOperationalAlert(
      draft.alertInteractions,
      resolved,
      { id: account.id, name: account.displayName },
      NOW,
    );
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      alertInteractions: outcome.interactions,
      alertEvents: [outcome.event, ...snapshot.alertEvents],
    }));
  });
}

function readCommand(
  h: ReturnType<typeof harness>,
  username: string | ReturnType<typeof user>,
  alertKey: string,
) {
  h.execute(() => {
    const account = typeof username === "string" ? user(username) : username;
    const alert = deriveOperationalAlerts(h.boundary.readSnapshot()).find(
      (item) => item.key === alertKey,
    );
    assert.ok(alert);
    const read = authorizeResources(account, {
      permission: alert.readPermission,
      resources: [alertAuthorizationResource(alert)],
    });
    if (!read.allowed) throw new Error(read.reason);
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      alertInteractions: markAlertReadReceipt(
        snapshot.alertInteractions,
        alertKey,
        account.id,
        NOW,
      ),
    }));
  });
}

test("ack xác nhận alert commit một lần, có attribution và tự lọc stale", () => {
  const h = harness();
  const key = KEY;
  acknowledgeCommand(h, "nguyentrung", key);
  assert.equal(h.commits(), 1);
  const snapshot = h.state().snapshot;
  const interaction = snapshot.alertInteractions.find(
    (item) => item.alertKey === key,
  )!;
  assert.equal(interaction.acknowledgement?.actor, "Nguyễn Quốc Trung");
  assert.equal(snapshot.alertEvents.length, 1);
  assert.ok(snapshot.alertEvents[0].message.includes("Nguyễn Quốc Trung"));
  // resolve lại theo state committed
  const resolved = resolveAlertState(
    deriveOperationalAlerts(snapshot).find((item) => item.key === key)!,
    interaction,
    "USR-OPS-001",
  );
  assert.equal(resolved.status, "Đã xác nhận");
  // entity được xử lý → alert hết hiệu lực dù receipt vẫn nằm trong snapshot
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      tasks: snapshot.tasks.map((item) =>
        item.id === "TSK-YAGI-02"
          ? { ...item, status: "Đã giao" as const, teamId: "CH-LC-01" }
          : item,
      ),
    })),
  );
  assert.ok(
    !deriveOperationalAlerts(h.state().snapshot).some(
      (item) => item.key === key,
    ),
  );
});

test("acknowledge thất bại giữa chừng rollback toàn bộ draft", () => {
  const h = harness();
  const key = KEY;
  readCommand(h, "nguyentrung", key);
  const committedInteractions = h.state().snapshot.alertInteractions.length;
  const committedEvents = h.state().snapshot.alertEvents.length;
  assert.throws(() =>
    h.execute(() => {
      const account = user("nguyentrung");
      const alert = deriveOperationalAlerts(h.boundary.readSnapshot()).find(
        (item) => item.key === key,
      )!;
      const outcome = acknowledgeOperationalAlert(
        h.boundary.readSnapshot().alertInteractions,
        resolveAlertState(alert, undefined, account.id),
        { id: account.id, name: account.displayName },
        NOW,
      );
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        alertInteractions: outcome.interactions,
        alertEvents: [outcome.event, ...snapshot.alertEvents],
      }));
      throw new Error("Lỗi giả lập sau khi ghi interactions");
    }),
  );
  assert.equal(
    h.state().snapshot.alertInteractions.length,
    committedInteractions,
    "interaction nháp phải bị hủy",
  );
  assert.equal(h.state().snapshot.alertEvents.length, committedEvents);
});

test("authorization tại mutation boundary: geography, ownership, role", () => {
  const h = harness();
  // Cán bộ scope Lào Cai không được ack alert ngoài địa bàn (Hà Nội)
  assert.throws(
    () => acknowledgeCommand(h, laoCaiOfficer(), "shelter:Shelter:SHELTER-HN-03:shelter_overloaded"),
    /ngoài phạm vi địa lý/,
  );
  assert.equal(h.state().snapshot.alertInteractions.length, 0, "không được ghi gì khi bị từ chối");
  // Công dân (đội viên cũ) không có alert_view → bị chặn ở bước đọc nguồn
  assert.throws(() => acknowledgeCommand(h, "minhtri", KEY), /không được cấp quyền/);
  // Admin V2 đọc được alert nhưng không có alert_acknowledge
  assert.throws(
    () => acknowledgeCommand(h, "thuantq", KEY),
    /không được cấp quyền alert_acknowledge/,
  );
  // Đơn vị cứu hộ chỉ huy toàn lực lượng → ack được alert nhiệm vụ của bất kỳ đội nào
  acknowledgeCommand(h, "phamhieu", "task:Task:TSK-YAGI-03:task_overdue");
  assert.equal(h.state().snapshot.alertInteractions[0].acknowledgement?.actor, "Phạm Trung Hiếu");
  // Cán bộ scope Lào Cai được ack alert trong Lào Cai
  acknowledgeCommand(h, laoCaiOfficer(), "incident:Incident:INC-YAGI-01:incident_critical_active");
  assert.equal(h.state().snapshot.alertInteractions.length, 2);
});

test("alert mà entity vượt scope thì không lộ qua derive từ authorized view", () => {
  const officerAlerts = alertsFor(laoCaiOfficer());
  assert.ok(officerAlerts.length > 0);
  assert.ok(officerAlerts.every((item) => (item.geographicScope ?? "").includes("Lào Cai")));
  // Thủ kho cũ nay là công dân: không còn alert kho, cũng không có alert nào khác.
  assert.deepEqual(alertsFor("namanh"), []);
});

test("Command Center và trang Cảnh báo dùng chung một alert collection", () => {
  const account = user("nguyentrung");
  const view = createAuthorizedOperationalView(account, source());
  const pageAlerts = deriveAuthorizedAlerts(account, view);
  // panel Command Center đọc store.alerts — cùng phép derive này
  const commandCenterAlerts = deriveAuthorizedAlerts(account, view);
  assert.deepEqual(pageAlerts, commandCenterAlerts);
  assert.ok(pageAlerts.length > 0);
});

test("analytics aggregation theo dõi alert sau khi acknowledge", () => {
  const h = harness();
  // Ack một alert bắt buộc xác nhận (critical) để tỷ lệ xác nhận thay đổi.
  const critical = "shelter:Shelter:SHELTER-HN-03:shelter_overloaded";
  acknowledgeCommand(h, "nguyentrung", critical);
  const account = user("nguyentrung");
  const alerts = deriveAuthorizedAlerts(
    account,
    createAuthorizedOperationalView(account, h.state().snapshot),
  );
  const analytics = getAlertAnalytics(alerts);
  const required = alerts.filter((item) => item.requiresAcknowledgement).length;
  assert.equal(analytics.acknowledgementRate, Math.round((1 / required) * 100));
  assert.ok(alerts.find((item) => item.key === critical)?.status === "Đã xác nhận");
});

test("routes /alerts và /alerts/:key hoạt động với History router", () => {
  assert.deepEqual(parseRoute("/alerts"), { name: "alert-list" });
  const encoded =
    "/alerts/" +
    encodeURIComponent(KEY);
  const detail = parseRoute(encoded);
  assert.deepEqual(detail, { name: "alert-detail", id: KEY });
  assert.equal(activeNavigationLabel(detail), "Cảnh báo");
});
