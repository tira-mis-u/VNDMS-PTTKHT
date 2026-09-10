/*
 * V2 (4 vai): cảnh báo tác nghiệp chỉ dẫn xuất từ 5 nguồn canonical (incident/task/team/
 * shelter/sos); nguồn relief/inventory/shipment đã xóa. Test scope địa lý dùng cán bộ PCTT
 * thu hẹp về tỉnh Lào Cai (Local Officer cũ nay là công dân); test kho/đội viên cũ chuyển
 * thành "tài khoản công dân không nhận alert". Kịch bản Yagi 2024.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  alertAuthorizationResource,
  alertDetailPath,
  deriveAuthorizedAlerts,
  filterAndSortAlerts,
  getAlertAnalytics,
  summarizeAlerts,
} from "../../src/application/alerts/alertQueries";
import {
  acknowledgeOperationalAlert,
  markAlertReadReceipt,
} from "../../src/application/alerts/alertUseCases";
import { deriveOperationalAlerts } from "../../src/domain/alerts/rules";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { authorizeResources } from "../../src/lib/security/authorization";
import { hasPermission } from "../../src/lib/permissions/permissions";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const source = () => inMemoryOperationalRepository.load();
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const alertsForAccount = (account: ReturnType<typeof user>) =>
  deriveAuthorizedAlerts(account, createAuthorizedOperationalView(account, source()));
const alertsFor = (username: string) => alertsForAccount(user(username));
/** Cán bộ PCTT thu hẹp scope về tỉnh Lào Cai để kiểm lọc địa bàn. */
const laoCaiOfficer = () => ({
  ...user("nguyentrung"),
  geographicScope: { level: "province" as const, name: "Lào Cai", code: "LC" },
});
const citizenUser = () => ({
  ...user("thuantq"),
  id: "USR-CITIZEN-TEST",
  username: "Công dân kiểm thử",
  displayName: "Công dân kiểm thử",
  role: "citizen" as const,
  geographicScope: {
    level: "commune" as const,
    name: "Tứ Liên, Tây Hồ, Hà Nội",
    code: "HN-TAYHO-TULIEN",
  },
});

test("alerts chỉ suy ra từ authorized view — admin/cán bộ scope toàn quốc thấy toàn bộ", () => {
  const total = deriveOperationalAlerts(source()).length;
  assert.ok(total >= 20);
  for (const username of ["thuantq", "nguyentrung"]) {
    const alerts = alertsFor(username);
    assert.equal(alerts.length, total, username);
    assert.ok(alerts.every((item) => item.status === "Chưa đọc"));
  }
  const sources = new Set(alertsFor("nguyentrung").map((item) => item.key.split(":")[0]));
  assert.deepEqual([...sources].sort(), ["incident", "shelter", "sos", "task", "team"]);
});

test("Cán bộ scope tỉnh không thấy alert ngoài Lào Cai", () => {
  const keys = alertsForAccount(laoCaiOfficer()).map((item) => item.key);
  assert.ok(keys.includes("incident:Incident:INC-YAGI-01:incident_critical_active"));
  assert.ok(keys.includes("task:Task:TSK-YAGI-02:task_high_priority_unassigned"));
  assert.ok(!keys.includes("shelter:Shelter:SHELTER-HN-03:shelter_overloaded"));
  assert.ok(!keys.includes("team:Team:CH-QN-01:team_communication_lost"));
  assert.ok(!keys.includes("incident:Incident:INC-YAGI-05:incident_no_team"));
  assert.ok(keys.every((key) => !key.startsWith("relief:")), "không còn nguồn relief");
});

test("Tài khoản kho/đội viên cũ (nay công dân) không nhận alert tác nghiệp", () => {
  assert.deepEqual(alertsFor("namanh"), []);
  assert.deepEqual(alertsFor("minhtri"), []);
  assert.deepEqual(alertsFor("phamdam"), []);
});

test("Đơn vị cứu hộ (chỉ huy toàn lực lượng) thấy alert mọi đội và SOS đã phân công", () => {
  const keys = alertsFor("phamhieu").map((item) => item.key);
  assert.ok(keys.includes("team:Team:CH-QN-01:team_communication_lost"));
  assert.ok(keys.includes("task:Task:TSK-YAGI-06:task_stalled"));
  assert.ok(keys.includes("sos:SOS:SOS-YAGI-04:sos_waiting_too_long"));
});

test("citizen và tài khoản null không nhận được alert tác nghiệp", () => {
  const citizen = citizenUser();
  assert.deepEqual(
    deriveAuthorizedAlerts(
      citizen,
      createAuthorizedOperationalView(citizen, source()),
    ),
    [],
  );
  assert.deepEqual(
    deriveAuthorizedAlerts(
      null,
      createAuthorizedOperationalView(null, source()),
    ),
    [],
  );
  assert.equal(hasPermission("citizen", "alert_view"), false);
  assert.equal(hasPermission("citizen", "alert_acknowledge"), false);
});

test("resource của alert giữ geography/ownership phục vụ mutation check", () => {
  const stalled = alertsFor("nguyentrung").find(
    (item) => item.key === "task:Task:TSK-YAGI-06:task_stalled",
  )!;
  const resource = alertAuthorizationResource(stalled);
  assert.equal(resource.type, "OperationalAlert");
  assert.equal(resource.geographicScope, "Thành phố Yên Bái, Yên Bái");
  assert.equal(resource.assignedTeamId, "CH-YB-01");
});

test("read receipt mutation qua authorize boundary của entity nguồn", () => {
  const officer = laoCaiOfficer();
  const inScope = deriveOperationalAlerts(source()).find(
    (item) => item.key === "incident:Incident:INC-YAGI-01:incident_critical_active",
  )!;
  const allowed = authorizeResources(officer, {
    permission: inScope.readPermission,
    resources: [alertAuthorizationResource(inScope)],
  });
  assert.equal(allowed.allowed, true);
  const outOfScope = deriveOperationalAlerts(source()).find(
    (item) => item.key === "shelter:Shelter:SHELTER-HN-03:shelter_overloaded",
  )!;
  const denied = authorizeResources(officer, {
    permission: outOfScope.readPermission,
    resources: [alertAuthorizationResource(outOfScope)],
  });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /ngoài phạm vi địa lý/);
});

test("acknowledge cần alert_acknowledge + quyền đọc nguồn", () => {
  const citizen = user("minhtri");
  const alert = deriveOperationalAlerts(source()).find(
    (item) => item.key === "sos:SOS:SOS-YAGI-04:sos_waiting_too_long",
  )!;
  const ackDecision = authorizeResources(citizen, {
    permission: "alert_acknowledge",
    resources: [alertAuthorizationResource(alert)],
  });
  assert.equal(ackDecision.allowed, false, "công dân không có quyền ack");
  const deniedBySourcePermission = authorizeResources(user("namanh"), {
    permission: alert.readPermission,
    resources: [alertAuthorizationResource(alert)],
  });
  assert.equal(deniedBySourcePermission.allowed, false);
  // Admin V2 không có alert_acknowledge; cán bộ và đơn vị cứu hộ có.
  assert.equal(hasPermission("admin", "alert_acknowledge"), false);
  assert.equal(hasPermission("disaster_officer", "alert_acknowledge"), true);
  assert.equal(hasPermission("rescue_unit", "alert_acknowledge"), true);
});

test("markAlertReadReceipt và acknowledgeOperationalAlert use case", () => {
  const alerts = alertsFor("nguyentrung");
  let interactions = markAlertReadReceipt(
    [],
    alerts[0].key,
    "USR-OPS-001",
    "21/08/2026 10:45",
  );
  assert.equal(interactions[0].readBy[0].userId, "USR-OPS-001");
  const critical = alerts.find((item) => item.requiresAcknowledgement)!;
  const outcome = acknowledgeOperationalAlert(
    interactions,
    critical,
    { id: "USR-OPS-001", name: "Nguyễn Quốc Trung" },
    "21/08/2026 10:45",
  );
  interactions = outcome.interactions;
  assert.ok(outcome.event.message.includes("Nguyễn Quốc Trung"));
  assert.equal(outcome.event.type, "acknowledged");
  assert.equal(
    interactions.find((item) => item.alertKey === critical.key)
      ?.acknowledgement?.actor,
    "Nguyễn Quốc Trung",
  );
  assert.throws(
    () =>
      acknowledgeOperationalAlert(
        interactions,
        { ...critical, acknowledgedAt: "21/08/2026 10:45" },
        { id: "USR-RSL-001", name: "Người khác" },
        "21/08/2026 10:46",
      ),
    /đã được xác nhận/,
  );
});

test("filterAndSortAlerts theo severity/category/status/search/time", () => {
  const alerts = alertsFor("nguyentrung");
  const base = {
    search: "",
    severity: "Tất cả mức độ",
    category: "Tất cả nhóm",
    status: "Tất cả trạng thái",
    time: "Tất cả thời gian",
  };
  assert.equal(
    filterAndSortAlerts(alerts, { ...base, severity: "Khẩn cấp" }).length,
    8,
  );
  assert.ok(
    filterAndSortAlerts(alerts, { ...base, category: "SOS" }).every(
      (item) => item.category === "sos",
    ),
  );
  const searched = filterAndSortAlerts(alerts, { ...base, search: "TSK-YAGI-02" });
  assert.equal(searched.length, 2);
  // Tìm kiếm bỏ dấu: "lang nu" khớp "Làng Nủ".
  const normalized = filterAndSortAlerts(alerts, { ...base, search: "lang nu" });
  assert.deepEqual(
    normalized.map((item) => item.key),
    [
      "task:Task:TSK-YAGI-01:task_overdue",
      "task:Task:TSK-YAGI-02:task_overdue",
      "incident:Incident:INC-YAGI-01:incident_critical_active",
      "task:Task:TSK-YAGI-02:task_high_priority_unassigned",
    ],
  );
  const recent = filterAndSortAlerts(alerts, {
    ...base,
    time: "30 phút gần nhất",
  });
  assert.ok(recent.length <= alerts.length, "cửa sổ thời gian không thêm alert");
  const withRead = alerts.map((item, index) =>
    index === 0 ? { ...item, status: "Đã đọc" as const } : item,
  );
  assert.equal(
    filterAndSortAlerts(withRead, { ...base, status: "Chưa đọc" }).length,
    withRead.length - 1,
  );
});

test("summarizeAlerts và getAlertAnalytics", () => {
  const alerts = alertsFor("nguyentrung");
  const summary = summarizeAlerts(alerts);
  assert.equal(summary.total, 25);
  assert.equal(summary.unread, 25);
  assert.equal(summary.critical, 8);
  assert.equal(summary.pendingAcknowledgement, 8);
  assert.equal(summary.byCategory.length, 5, "5 nguồn canonical V2");
  const analytics = getAlertAnalytics(alerts);
  assert.equal(
    analytics.bySeverity.find((item) => item.severity === "critical")?.count,
    8,
  );
  assert.equal(analytics.acknowledgementRate, 0);
  const afterAck = alerts.map((item) =>
    item.requiresAcknowledgement &&
    item.key === "shelter:Shelter:SHELTER-HN-03:shelter_overloaded"
      ? {
          ...item,
          acknowledgedAt: "10/09/2024 14:45",
          acknowledgedBy: "Nguyễn Quốc Trung",
          status: "Đã xác nhận" as const,
        }
      : item,
  );
  const after = getAlertAnalytics(afterAck);
  assert.equal(after.acknowledgementRate, Math.round((1 / 8) * 100));
  assert.ok(after.unresolved <= analytics.unresolved);
});

test("alertDetailPath encode key an toàn trong URL", () => {
  const path = alertDetailPath({
    key: "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
  });
  assert.equal(
    path,
    "/alerts/sos%3ASOS%3ASOS-0242%3Asos_p1_verified_unassigned",
  );
});
