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
const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const alertsFor = (username: string) => {
  const account = user(username);
  return deriveAuthorizedAlerts(
    account,
    createAuthorizedOperationalView(account, source()),
  );
};
const citizenUser = () => ({
  ...user("Trần Quốc Thuận"),
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

test("alerts chỉ suy ra từ authorized view — commander thấy toàn bộ", () => {
  const alerts = alertsFor("Trần Quốc Thuận");
  assert.equal(alerts.length, 21);
  assert.ok(alerts.every((item) => item.status === "Chưa đọc"));
});

test("Local Officer không thấy alert ngoài Tay Hồ", () => {
  const alerts = alertsFor("Phạm Văn Đam");
  const keys = alerts.map((item) => item.key);
  assert.ok(keys.includes("sos:SOS:SOS-0242:sos_p1_verified_unassigned"));
  assert.ok(keys.includes("shelter:Shelter:TH-02:shelter_near_capacity"));
  assert.ok(!keys.includes("shelter:Shelter:TH-03:shelter_overloaded"));
  assert.ok(!keys.includes("relief:Shipment:SHP-0243:shipment_incident"));
  assert.ok(!keys.includes("team:Team:CH-04:team_communication_lost"));
  assert.ok(!keys.includes("incident:Incident:INC-0234:incident_no_team"));
});

test("Warehouse staff chỉ thấy alert của kho được phân công", () => {
  const alerts = alertsFor("Nguyễn Nam Anh");
  assert.deepEqual(
    alerts.map((item) => item.key),
    ["relief:Inventory:INV-0103:inventory_out_of_stock"],
  );
});

test("Rescue member không thấy alert đội ngoài ownership", () => {
  const alerts = alertsFor("Lê Nguyễn Minh Trí");
  const keys = alerts.map((item) => item.key);
  assert.ok(!keys.includes("team:Team:CH-04:team_communication_lost"));
  assert.ok(keys.includes("sos:SOS:SOS-0242:sos_p1_verified_unassigned"));
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
  const inventory = alertsFor("Trần Quốc Thuận").find(
    (item) => item.key === "relief:Inventory:INV-0103:inventory_out_of_stock",
  )!;
  const resource = alertAuthorizationResource(inventory);
  assert.equal(resource.type, "OperationalAlert");
  assert.equal(resource.geographicScope, "Hoàn Kiếm, Hà Nội");
  assert.equal(resource.warehouseId, "KHO-01");
});

test("read receipt mutation qua authorize boundary của entity nguồn", () => {
  const officer = user("Phạm Văn Đam");
  const inScope = deriveOperationalAlerts(source()).find(
    (item) => item.key === "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
  )!;
  const allowed = authorizeResources(officer, {
    permission: inScope.readPermission,
    resources: [alertAuthorizationResource(inScope)],
  });
  assert.equal(allowed.allowed, true);
  const outOfScope = deriveOperationalAlerts(source()).find(
    (item) => item.key === "shelter:Shelter:TH-03:shelter_overloaded",
  )!;
  const denied = authorizeResources(officer, {
    permission: outOfScope.readPermission,
    resources: [alertAuthorizationResource(outOfScope)],
  });
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /ngoài phạm vi địa lý/);
});

test("acknowledge cần alert_acknowledge + quyền đọc nguồn", () => {
  const member = user("Lê Nguyễn Minh Trí");
  const alert = deriveOperationalAlerts(source()).find(
    (item) => item.key === "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
  )!;
  const ackDecision = authorizeResources(member, {
    permission: "alert_acknowledge",
    resources: [alertAuthorizationResource(alert)],
  });
  assert.equal(ackDecision.allowed, false, "rescue_member không có quyền ack");
  const warehouseStaff = user("Nguyễn Nam Anh");
  const deniedBySourcePermission = authorizeResources(warehouseStaff, {
    permission: alert.readPermission,
    resources: [alertAuthorizationResource(alert)],
  });
  assert.equal(deniedBySourcePermission.allowed, false);
});

test("markAlertReadReceipt và acknowledgeOperationalAlert use case", () => {
  const alerts = alertsFor("Trần Quốc Thuận");
  let interactions = markAlertReadReceipt(
    [],
    alerts[0].key,
    "USR-CMD-001",
    "21/08/2026 10:45",
  );
  assert.equal(interactions[0].readBy[0].userId, "USR-CMD-001");
  const critical = alerts.find((item) => item.requiresAcknowledgement)!;
  const outcome = acknowledgeOperationalAlert(
    interactions,
    critical,
    { id: "USR-CMD-001", name: "Trần Quốc Thuận" },
    "21/08/2026 10:45",
  );
  interactions = outcome.interactions;
  assert.ok(outcome.event.message.includes("Trần Quốc Thuận"));
  assert.equal(outcome.event.type, "acknowledged");
  assert.equal(
    interactions.find((item) => item.alertKey === critical.key)
      ?.acknowledgement?.actor,
    "Trần Quốc Thuận",
  );
  assert.throws(
    () =>
      acknowledgeOperationalAlert(
        interactions,
        { ...critical, acknowledgedAt: "21/08/2026 10:45" },
        { id: "USR-OPS-001", name: "Ngườii khác" },
        "21/08/2026 10:46",
      ),
    /đã được xác nhận/,
  );
});

test("filterAndSortAlerts theo severity/category/status/search/time", () => {
  const alerts = alertsFor("Trần Quốc Thuận");
  const base = {
    search: "",
    severity: "Tất cả mức độ",
    category: "Tất cả nhóm",
    status: "Tất cả trạng thái",
    time: "Tất cả thởi gian",
  };
  assert.equal(
    filterAndSortAlerts(alerts, { ...base, severity: "Khẩn cấp" }).length,
    5,
  );
  assert.ok(
    filterAndSortAlerts(alerts, { ...base, category: "SOS" }).every(
      (item) => item.category === "sos",
    ),
  );
  const searched = filterAndSortAlerts(alerts, { ...base, search: "TSK-0242" });
  assert.equal(searched.length, 2);
  const normalized = filterAndSortAlerts(alerts, {
    ...base,
    search: "chăn mỏng",
  });
  assert.deepEqual(
    normalized.map((item) => item.key),
    [
      "relief:ReliefRequest:REQ-0241:relief_request_shortage",
      "relief:Inventory:INV-0103:inventory_out_of_stock",
    ],
  );
  const recent = filterAndSortAlerts(alerts, {
    ...base,
    time: "30 phút gần nhất",
  });
  assert.ok(
    recent.every((item) => item.detectedAt >= "21/08/2026 10:15"),
    "chỉ giữ alert phát sinh trong cửa sổ thởi gian",
  );
  assert.ok(recent.length < alerts.length);
  const withRead = alerts.map((item, index) =>
    index === 0 ? { ...item, status: "Đã đọc" as const } : item,
  );
  assert.equal(
    filterAndSortAlerts(withRead, { ...base, status: "Chưa đọc" }).length,
    withRead.length - 1,
  );
});

test("summarizeAlerts và getAlertAnalytics", () => {
  const alerts = alertsFor("Trần Quốc Thuận");
  const summary = summarizeAlerts(alerts);
  assert.equal(summary.total, 21);
  assert.equal(summary.unread, 21);
  assert.equal(summary.critical, 5);
  assert.equal(summary.pendingAcknowledgement, 5);
  assert.equal(summary.byCategory.length, 9);
  const analytics = getAlertAnalytics(alerts);
  assert.equal(
    analytics.bySeverity.find((item) => item.severity === "critical")?.count,
    5,
  );
  assert.equal(analytics.acknowledgementRate, 0);
  const afterAck = alerts.map((item) =>
    item.requiresAcknowledgement &&
    item.key === "sos:SOS:SOS-0242:sos_p1_verified_unassigned"
      ? {
          ...item,
          acknowledgedAt: "21/08/2026 10:45",
          acknowledgedBy: "Trần Quốc Thuận",
          status: "Đã xác nhận" as const,
        }
      : item,
  );
  const after = getAlertAnalytics(afterAck);
  assert.equal(after.acknowledgementRate, 20);
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
