/*
 * V2 (4 vai): quy tắc cảnh báo cho các nguồn evacuation/relief/playbook/recovery đã xóa cùng
 * module. Bộ key kỳ vọng và số lượng cập nhật theo kịch bản Yagi 2024 với 5 nguồn canonical.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeAlert,
  alertClock,
  assertAlertCanAcknowledge,
  compareAlerts,
  deriveOperationalAlerts,
  markAlertRead,
  markAlertUnread,
  resolveAlertState,
  resolveAlertsForUser,
} from "../../src/domain/alerts/rules";
import { alertSeverityRank } from "../../src/domain/alerts/types";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const load = () => inMemoryOperationalRepository.load();
const derive = () => deriveOperationalAlerts(load());

test("derive cảnh báo baseline deterministic từ canonical seed", () => {
  const alerts = derive();
  assert.equal(alerts.length, 25);
  const keys = alerts.map((alert) => alert.key);
  assert.equal(new Set(keys).size, keys.length, "không được có key trùng");
  for (const expected of [
    "shelter:Shelter:SHELTER-HN-03:shelter_overloaded",
    "incident:Incident:INC-YAGI-01:incident_critical_active",
    "sos:SOS:SOS-YAGI-04:sos_waiting_too_long",
    "task:Task:TSK-YAGI-02:task_overdue",
    "task:Task:TSK-YAGI-02:task_high_priority_unassigned",
    "team:Team:CH-QN-01:team_communication_lost",
    "shelter:Shelter:SHELTER-HN-01:shelter_near_capacity",
    "shelter:Shelter:SHELTER-HN-PHUDIEN:shelter_inaccessible",
    "incident:Incident:INC-YAGI-04:incident_high_early_stage",
    "incident:Incident:INC-YAGI-05:incident_no_team",
    "task:Task:TSK-YAGI-06:task_stalled",
  ])
    assert.ok(keys.includes(expected), `thiếu alert ${expected}`);
  // Không còn nguồn của module đã xóa.
  for (const prefix of ["evacuation:", "relief:", "playbook:", "recovery:"])
    assert.ok(!keys.some((key) => key.startsWith(prefix)), `còn alert nguồn ${prefix}`);
});

test("derive hai lần cho kết quả hoàn toàn giống nhau", () => {
  assert.deepEqual(derive(), derive());
});

test("mỗi alert chỉ reference entity nguồn, không sao chép entity", () => {
  const alert = derive().find(
    (item) => item.condition === "sos_waiting_too_long",
  )!;
  assert.equal(alert.source.type, "SOS");
  assert.equal(alert.source.id, "SOS-YAGI-04");
  assert.equal(alert.source.path, "/sos/SOS-YAGI-04");
  assert.equal(alert.readPermission, "sos_view");
  assert.equal((alert as Record<string, unknown>).sosRequests, undefined);
});

test("severity mapping và cờ yêu cầu xác nhận", () => {
  const alerts = derive();
  const critical = alerts.filter((item) => item.severity === "critical");
  assert.equal(critical.length, 8);
  for (const alert of critical)
    assert.equal(alert.requiresAcknowledgement, true);
  const nearCapacity = alerts.find(
    (item) => item.key === "shelter:Shelter:SHELTER-HN-01:shelter_near_capacity",
  )!;
  assert.equal(nearCapacity.severity, "high");
  assert.equal(nearCapacity.requiresAcknowledgement, false);
  const stalled = alerts.find(
    (item) => item.key === "task:Task:TSK-YAGI-06:task_stalled",
  )!;
  assert.equal(stalled.severity, "medium");
});

test("sắp xếp theo severity rồi thời điểm ghi nhận", () => {
  const alerts = derive();
  for (let index = 1; index < alerts.length; index++)
    assert.ok(
      alertSeverityRank[alerts[index - 1].severity] >=
        alertSeverityRank[alerts[index].severity],
      "severity phải giảm dần",
    );
  assert.deepEqual([...alerts].sort(compareAlerts), alerts);
});

test("điều kiện không còn đúng thì alert biến mất (không stale)", () => {
  const snapshot = load();
  const assigned = {
    ...snapshot,
    sosRequests: snapshot.sosRequests.map((item) =>
      item.id === "SOS-YAGI-04" ? { ...item, status: "Đang cứu hộ" as const, assignedTeamId: "CH-LC-01" } : item,
    ),
  };
  assert.ok(
    !deriveOperationalAlerts(assigned).some(
      (item) => item.key === "sos:SOS:SOS-YAGI-04:sos_waiting_too_long",
    ),
  );
  const fixedShelter = {
    ...snapshot,
    shelters: snapshot.shelters.map((item) =>
      item.id === "SHELTER-HN-03"
        ? { ...item, currentOccupancy: 10, status: "Đang tiếp nhận" as const }
        : item,
    ),
  };
  const keys = deriveOperationalAlerts(fixedShelter).map((item) => item.key);
  assert.ok(!keys.includes("shelter:Shelter:SHELTER-HN-03:shelter_overloaded"));
  const completedTask = {
    ...snapshot,
    tasks: snapshot.tasks.map((item) =>
      item.id === "TSK-YAGI-02"
        ? { ...item, status: "Hoàn thành" as const }
        : item,
    ),
  };
  const after = deriveOperationalAlerts(completedTask).map(
    (item) => item.key,
  );
  assert.ok(!after.includes("task:Task:TSK-YAGI-02:task_overdue"));
  assert.ok(!after.includes("task:Task:TSK-YAGI-02:task_high_priority_unassigned"));
});

test("trạng thái nguồn thay đổi thì severity/alert đổi theo (không stale)", () => {
  const snapshot = load();
  const resolvedIncident = {
    ...snapshot,
    incidents: snapshot.incidents.map((item) =>
      item.id === "INC-YAGI-01" ? { ...item, status: "Đã kiểm soát" as const } : item,
    ),
  };
  const alerts = deriveOperationalAlerts(resolvedIncident);
  assert.ok(
    !alerts.some(
      (item) => item.key === "incident:Incident:INC-YAGI-01:incident_critical_active",
    ),
  );
  // Đội mất liên lạc khôi phục liên lạc → cảnh báo đội biến mất.
  const restored = {
    ...snapshot,
    teams: snapshot.teams.map((item) =>
      item.id === "CH-QN-01"
        ? { ...item, status: "Sẵn sàng" as const, communicationStatus: "Kết nối" as const }
        : item,
    ),
  };
  assert.ok(
    !deriveOperationalAlerts(restored).some(
      (item) => item.key === "team:Team:CH-QN-01:team_communication_lost",
    ),
  );
});

test("morph alert state theo người dùng: chưa đọc → đã đọc → đã xác nhận", () => {
  const [alert] = derive();
  const unread = resolveAlertState(alert, undefined, "USR-CMD-001");
  assert.equal(unread.status, "Chưa đọc");
  let interactions = markAlertRead([], alert.key, {
    userId: "USR-CMD-001",
    readAt: "21/08/2026 10:45",
  });
  const read = resolveAlertState(alert, interactions[0], "USR-CMD-001");
  assert.equal(read.status, "Đã đọc");
  assert.equal(read.readAt, "21/08/2026 10:45");
  // người dùng khác vẫn chưa đọc
  assert.equal(
    resolveAlertState(alert, interactions[0], "USR-OPS-001").status,
    "Chưa đọc",
  );
  interactions = acknowledgeAlert(interactions, alert.key, {
    userId: "USR-CMD-001",
    actor: "Trần Quốc Thuận",
    at: "21/08/2026 10:45",
  });
  const acknowledged = resolveAlertState(alert, interactions[0], "USR-CMD-001");
  assert.equal(acknowledged.status, "Đã xác nhận");
  assert.equal(acknowledged.acknowledgedBy, "Trần Quốc Thuận");
  // mark unread không xóa acknowledgement
  interactions = markAlertUnread(interactions, alert.key, "USR-CMD-001");
  assert.equal(interactions.length, 1, "interaction còn ack thì giữ lại");
  assert.equal(interactions[0].readBy.length, 0);
});

test("markAlertRead idempotent và markAlertUnread dọn interaction rỗng", () => {
  let interactions = markAlertRead([], "a:b:c:d", {
    userId: "U1",
    readAt: "21/08/2026 10:45",
  });
  interactions = markAlertRead(interactions, "a:b:c:d", {
    userId: "U1",
    readAt: "21/08/2026 10:46",
  });
  assert.equal(interactions.length, 1);
  assert.equal(interactions[0].readBy.length, 1);
  interactions = markAlertUnread(interactions, "a:b:c:d", "U1");
  assert.equal(interactions.length, 0);
});

test("quy tắc xác nhận alert", () => {
  const critical = resolveAlertState(
    derive().find((item) => item.requiresAcknowledgement)!,
    undefined,
    "USR-CMD-001",
  );
  assert.doesNotThrow(() => assertAlertCanAcknowledge(critical));
  const informational = resolveAlertState(
    derive().find((item) => !item.requiresAcknowledgement)!,
    undefined,
    "USR-CMD-001",
  );
  assert.throws(
    () => assertAlertCanAcknowledge(informational),
    /không yêu cầu xác nhận/,
  );
  const acked = { ...critical, acknowledgedAt: "21/08/2026 10:45" };
  assert.throws(
    () => assertAlertCanAcknowledge(acked),
    /đã được xác nhận/,
  );
});

test("resolveAlertsForUser giữ nguyên thứ tự derivation", () => {
  const derived = derive();
  const resolved = resolveAlertsForUser(derived, [], "USR-CMD-001");
  assert.deepEqual(
    resolved.map((item) => item.key),
    derived.map((item) => item.key),
  );
  assert.ok(alertClock.getTime() > 0);
});
