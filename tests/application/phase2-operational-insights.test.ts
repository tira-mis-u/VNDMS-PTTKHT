/*
 * V2 (4 vai): bỏ `simulation` khỏi OperationalInsightsData (module Mô phỏng đã xóa);
 * user() tra theo username thật; Local Officer cũ (phamdam) nay là công dân →
 * so sánh authorized view dùng admin vs cán bộ PCTT và công dân (không có sự cố).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { deriveAuthorizedAlerts } from "../../src/application/alerts/alertQueries";
import { buildOperationalReport, collectInvalidReportTimestamps, type AnalyticsData } from "../../src/application/analytics/analyticsQueries";
import { getOperationalHistory, getOperationalSituation, getOperationalTrend, type OperationalInsightsData } from "../../src/application/operations/operationalInsightsQueries";
import { activeNavigationLabel, parseRoute, PERMISSIONS_WORKSPACE_PATH } from "../../src/app/routes/router";
import { navigationGroups } from "../../src/components/navigation/navigationConfig";
import { authorize } from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const user = (name: string) => {
  const found = demoUsers.find((item) => item.username === name);
  if (!found) throw new Error(`demo user ${name} không tồn tại`);
  return structuredClone(found);
};
const loadFor = (name: string): OperationalInsightsData => {
  const actor = user(name);
  const snapshot = createAuthorizedOperationalView(actor, inMemoryOperationalRepository.load());
  return { ...snapshot, alerts: deriveAuthorizedAlerts(actor, snapshot) };
};

test("route Phân quyền là alias thật, active đúng và yêu cầu user_manage", () => {
  const route = parseRoute(PERMISSIONS_WORKSPACE_PATH);
  assert.equal(route.name, "admin-permissions");
  assert.equal(activeNavigationLabel(route), "Phân quyền");
  const item = navigationGroups.flatMap((group) => group.items).find((entry) => entry.label === "Phân quyền")!;
  assert.equal(item.path, PERMISSIONS_WORKSPACE_PATH);
  assert.equal(item.permission, "user_manage");
  assert.equal(authorize(user("thuantq"), "user_manage").allowed, true);
  assert.equal(authorize(user("nguyentrung"), "user_manage").allowed, false);
  assert.equal(authorize(user("phamdam"), "user_manage").allowed, false);
  const citizen = { ...user("thuantq"), id: "USR-CITIZEN-TEST", role: "citizen" as const };
  assert.equal(authorize(citizen, "user_manage").allowed, false);
  const app = readFileSync("src/app/App.tsx", "utf8");
  assert.match(app, /route\.name === "admin-permissions"[\s\S]*return "user_manage"/);
  assert.match(app, /mode="permissions"/);
});

test("Tình hình tác nghiệp chỉ composition dữ liệu authorized và có nguồn", () => {
  const commander = getOperationalSituation(loadFor("thuantq"));
  const local = getOperationalSituation(loadFor("phamdam"));
  assert.ok(commander.metrics.length >= 7);
  assert.ok(commander.metrics.every((item) => item.path.startsWith("/") && item.source && item.asOf));
  assert.ok(local.metrics.find((item) => item.id === "incidents")!.value <= commander.metrics.find((item) => item.id === "incidents")!.value);
  assert.ok(local.events.every((event) => loadFor("phamdam").incidents.some((incident) => incident.id === event.entityId) || event.entityType !== "Sự cố"));
  const empty = getOperationalSituation({ ...loadFor("thuantq"), incidents: [], events: [], alerts: [], sosRequests: [], sosEvents: [], teams: [], shelters: [], tasks: [], citizenReports: [], publishedAlerts: [], taskReviews: [] });
  assert.ok(empty.metrics.every((item) => item.value === 0));
});

test("Lịch sử chỉ lấy sự cố đã đóng, sắp sự kiện tăng dần và link canonical", () => {
  // Kịch bản Yagi mặc định chưa có sự cố "Đã đóng" (baseline test này vốn đỏ);
  // đóng một sự cố ngay trong dữ liệu kiểm thử để lịch sử có bản ghi thật.
  const source = loadFor("thuantq");
  const data = { ...source, incidents: source.incidents.map((item, index) => (index ? item : { ...item, status: "Đã đóng" as const, closedAt: source.metadata.asOf })) };
  const history = getOperationalHistory(data);
  assert.equal(history.rows.length, 1);
  assert.ok(history.rows.every((row) => row.status === "Đã đóng" && row.path === `/incidents/${row.id}`));
  for (const row of history.rows)
    assert.deepEqual(row.events.map((event) => event.timestamp), [...row.events].map((event) => event.timestamp).sort());
  assert.equal(getOperationalHistory(data, { severity: "Khẩn cấp" }).rows.some((row) => row.severity !== "Khẩn cấp"), false);
  assert.equal(getOperationalHistory({ ...data, incidents: data.incidents.filter((item) => item.status !== "Đã đóng") }).rows.length, 0);
});

test("Xu hướng nhóm từ timestamp canonical và không tạo so sánh khi chỉ có một kỳ", () => {
  const data = loadFor("thuantq");
  const result = getOperationalTrend(data, "incidents");
  assert.ok(result.points.every((point) => point.value === point.sources.length));
  assert.ok(result.points.flatMap((point) => point.sources).every((source) => source.path.startsWith("/")));
  const onePeriod = { ...data, incidents: data.incidents.filter((item) => item.createdAt.startsWith("21/08/2026")) };
  assert.equal(getOperationalTrend(onePeriod, "incidents").sufficient, false);
});

test("report dùng actor truyền vào, asOf canonical và công khai timestamp lỗi", () => {
  const data = loadFor("thuantq") as AnalyticsData;
  const invalid = { ...data, incidents: data.incidents.map((item, index) => index ? item : { ...item, createdAt: "ngày không hợp lệ" }) };
  assert.ok(collectInvalidReportTimestamps(invalid).some((item) => item.value === "ngày không hợp lệ"));
  const report = buildOperationalReport(invalid, "Báo cáo sự cố", { referenceTime: invalid.metadata.asOf }, { id: "USR-CMD-001", displayName: "Người lập kiểm thử" });
  assert.equal(report.audit.generatedById, "USR-CMD-001");
  assert.equal(report.audit.generatedAt, invalid.metadata.asOf);
  assert.ok(report.audit.invalidTimestamps.length > 0);
});

test("Cấu hình chỉ có blocked state, không persistence hay mutation giả", () => {
  const page = readFileSync("src/features/operational-insights/pages/SystemConfigurationBlockedPage.tsx", "utf8");
  assert.match(page, /chưa được cung cấp trong môi trường này/i);
  assert.match(page, /Chưa có hợp đồng cấu hình và lưu trữ/i);
  assert.doesNotMatch(page, /localStorage|onSubmit|onClick|save|fetch\(/);
});
