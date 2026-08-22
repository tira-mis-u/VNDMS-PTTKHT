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
  assert.equal(alerts.length, 21);
  const keys = alerts.map((alert) => alert.key);
  assert.equal(new Set(keys).size, keys.length, "không được có key trùng");
  for (const expected of [
    "shelter:Shelter:TH-03:shelter_overloaded",
    "incident:Incident:INC-0241:incident_critical_active",
    "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
    "task:Task:TSK-0242:task_overdue",
    "task:Task:TSK-0242:task_high_priority_unassigned",
    "team:Team:CH-04:team_communication_lost",
    "team:Team:CN-01:team_unavailable_during_response",
    "shelter:Shelter:TH-02:shelter_near_capacity",
    "shelter:Shelter:TH-04:shelter_inaccessible",
    "evacuation:Evacuation:EVAC-002:evacuation_blocked_or_paused",
    "relief:ReliefRequest:REQ-0241:relief_request_shortage",
    "relief:Inventory:INV-0103:inventory_out_of_stock",
    "relief:Inventory:INV-0303:inventory_low_stock",
    "relief:Shipment:SHP-0242:shipment_delayed",
    "relief:Shipment:SHP-0243:shipment_incident",
    "playbook:PlaybookExecution:PBX-0241:playbook_required_steps_blocked",
    "incident:Incident:INC-0238:incident_high_early_stage",
    "incident:Incident:INC-0234:incident_no_team",
    "recovery:DamageAssessment:DA-0242:assessment_verification_stalled",
    "recovery:RecoveryProject:RP-0241:recovery_budget_risk",
  ])
    assert.ok(keys.includes(expected), `thiếu alert ${expected}`);
});

test("derive hai lần cho kết quả hoàn toàn giống nhau", () => {
  assert.deepEqual(derive(), derive());
});

test("mỗi alert chỉ reference entity nguồn, không sao chép entity", () => {
  const alert = derive().find(
    (item) => item.condition === "sos_p1_verified_unassigned",
  )!;
  assert.equal(alert.source.type, "SOS");
  assert.equal(alert.source.id, "SOS-0242");
  assert.equal(alert.source.path, "/sos/SOS-0242");
  assert.equal(alert.readPermission, "sos_view");
  assert.equal((alert as Record<string, unknown>).sosRequests, undefined);
});

test("severity mapping và cờ yêu cầu xác nhận", () => {
  const alerts = derive();
  const critical = alerts.filter((item) => item.severity === "critical");
  assert.equal(critical.length, 5);
  for (const alert of critical)
    assert.equal(alert.requiresAcknowledgement, true);
  const nearCapacity = alerts.find(
    (item) => item.key === "shelter:Shelter:TH-02:shelter_near_capacity",
  )!;
  assert.equal(nearCapacity.severity, "high");
  assert.equal(nearCapacity.requiresAcknowledgement, false);
  const stalled = alerts.find(
    (item) =>
      item.key ===
      "recovery:DamageAssessment:DA-0242:assessment_verification_stalled",
  )!;
  assert.equal(stalled.severity, "medium");
});

test("sắp xếp theo severity rồi thởi điểm ghi nhận", () => {
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
      item.id === "SOS-0242" ? { ...item, assignedTeamId: "CH-05" } : item,
    ),
  };
  assert.ok(
    !deriveOperationalAlerts(assigned).some(
      (item) => item.key === "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
    ),
  );
  const fixedShelter = {
    ...snapshot,
    shelters: snapshot.shelters.map((item) =>
      item.id === "TH-03"
        ? { ...item, currentOccupancy: 120, status: "Đang tiếp nhận" as const }
        : item,
    ),
  };
  const keys = deriveOperationalAlerts(fixedShelter).map((item) => item.key);
  assert.ok(!keys.includes("shelter:Shelter:TH-03:shelter_overloaded"));
  const completedTask = {
    ...snapshot,
    tasks: snapshot.tasks.map((item) =>
      item.id === "TSK-0242"
        ? { ...item, status: "Hoàn thành" as const }
        : item,
    ),
  };
  const after = deriveOperationalAlerts(completedTask).map(
    (item) => item.key,
  );
  assert.ok(!after.includes("task:Task:TSK-0242:task_overdue"));
  assert.ok(!after.includes("task:Task:TSK-0242:task_high_priority_unassigned"));
});

test("ngoại lệ simulation-like thay đổi severity thì alert đổi theo", () => {
  const snapshot = load();
  const resolvedIncident = {
    ...snapshot,
    incidents: snapshot.incidents.map((item) =>
      item.id === "INC-0241" ? { ...item, status: "Đã kiểm soát" as const } : item,
    ),
  };
  const alerts = deriveOperationalAlerts(resolvedIncident);
  assert.ok(
    !alerts.some(
      (item) => item.key === "incident:Incident:INC-0241:incident_critical_active",
    ),
  );
  // Không còn sự cố Khẩn cấp đang xử lý → CN-01 không còn bị gắn cờ.
  assert.ok(
    !alerts.some(
      (item) =>
        item.key === "team:Team:CN-01:team_unavailable_during_response",
    ),
  );
});

test("morph alert state theo ngườii dùng: chưa đọc → đã đọc → đã xác nhận", () => {
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
  // ngườii dùng khác vẫn chưa đọc
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
