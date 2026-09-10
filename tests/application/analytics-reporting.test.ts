import assert from "node:assert/strict";
import test from "node:test";
/*
 * V2 (4 vai): các test relief/recovery/playbook đã bị gỡ cùng module nghiệp vụ;
 * thay bằng test cho Phản ánh (citizenReports), nhiệm vụ "Chờ xác nhận" và
 * SOS "Đã xử lý" (chờ duyệt đóng) KHÔNG được tính là kết thúc trong báo cáo.
 */
import {
  buildOperationalReport,
  getCitizenReportAnalytics,
  getIncidentAnalytics,
  getOperationalSummary,
  getShelterAnalytics,
  getSosAnalytics,
  getTaskAnalytics,
  getTeamAnalytics,
  type AnalyticsData,
} from "../../src/application/analytics/analyticsQueries";
import type { CitizenReport } from "../../src/domain/reports/types";
import {
  initialEvents,
  initialIncidents,
  initialTasks,
  initialTaskUpdates,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";
import { initialShelters } from "../../src/data/scenarios/red-river-flood/shelterSeed";
import { initialSosRequests } from "../../src/data/scenarios/red-river-flood/sosSeed";
const sampleReports: CitizenReport[] = [
  {
    id: "RPT-0001",
    code: "RPT-0001",
    ownerUserId: "USR-CTZ-001",
    reporterName: "Trần Thái Tuấn",
    contact: "0900000000",
    category: "Ngập lụt",
    description: "Ngập 40cm tại ngõ 124 Âu Cơ",
    location: { address: "Ngõ 124 Âu Cơ", administrativeArea: "Tây Hồ, Hà Nội", coordinates: null },
    status: "Mới",
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    duplicateOfId: null,
    createdAt: "21/08/2026 09:45",
    updatedAt: "21/08/2026 09:45",
  },
  {
    id: "RPT-0002",
    code: "RPT-0002",
    ownerUserId: "USR-LOC-001",
    reporterName: "Phạm Đàm",
    contact: "0900000001",
    category: "Sạt lở",
    description: "Sạt taluy đường ven đê",
    location: { address: "Đê Hữu Hồng", administrativeArea: "Tây Hồ, Hà Nội", coordinates: [105.82, 21.07] },
    status: "Hợp lệ",
    reviewNote: "Đã tạo sự cố",
    reviewedBy: "Nguyễn Trung",
    reviewedAt: "21/08/2026 10:15",
    duplicateOfId: null,
    createdAt: "21/08/2026 09:55",
    updatedAt: "21/08/2026 10:15",
  },
];
const data: AnalyticsData = {
  metadata: { asOf: "21/08/2026 10:45", source: "Nguồn kiểm thử" },
  incidents: initialIncidents,
  events: initialEvents,
  tasks: initialTasks,
  taskUpdates: initialTaskUpdates,
  teams: initialTeams,
  shelters: initialShelters,
  sosRequests: initialSosRequests,
  taskReviews: [],
  citizenReports: sampleReports,
};
const filter = {
  referenceTime: "21/08/2026 10:45",
  geographicScope: "Toàn bộ Hà Nội",
};
test("tổng hợp tác nghiệp dùng các canonical collection", () => {
  const result = getOperationalSummary(data, filter);
  assert.equal(
    result.metrics.find((item) => item.label === "Sự cố đang hoạt động")?.value,
    3,
  );
  assert.equal(
    result.metrics.find((item) => item.label === "Phản ánh chờ đánh giá")?.value,
    1,
  );
  assert.ok(result.exceptions.some((item) => item.path === "/tasks/TSK-0242"));
});
test("lọc kỳ báo cáo theo ngày vận hành DD/MM/YYYY", () => {
  const result = getIncidentAnalytics(data, {
    ...filter,
    from: "21/08/2026",
    to: "21/08/2026",
  });
  assert.equal(result.timings.length, 3);
  assert.equal(result.affectedPopulation, 48620);
});
test("lọc địa lý giữ đúng Incident thuộc Tây Hồ", () => {
  const result = getIncidentAnalytics(data, {
    ...filter,
    geographicScope: "Tây Hồ, Hà Nội",
  });
  assert.deepEqual(result.timings.map((item) => item.code).sort(), [
    "INC-0238",
    "INC-0241",
  ]);
});
test("thống kê Incident tách metric timeline dẫn xuất", () => {
  const result = getIncidentAnalytics(data, filter);
  assert.equal(result.averageAcknowledgementMinutes, 4);
  assert.equal(result.averageDispatchMinutes, 3);
  assert.ok(result.timings.every((item) => item.basis === "Dẫn xuất"));
});
test("thống kê Task nhận diện quá hạn, chưa giao và completion", () => {
  const result = getTaskAnalytics(data, filter);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.unassignedCount, 1);
  assert.equal(result.completionRate, 25);
  assert.ok(
    result.byIncident.some(
      (item) => item.incidentId === "INC-0241" && item.total === 2,
    ),
  );
});
test("team utilization dẫn xuất từ assignment canonical", () => {
  const result = getTeamAnalytics(data, filter);
  assert.equal(result.total, 7);
  assert.equal(result.deployed, 4);
  assert.equal(result.utilizationRate, 57);
  assert.ok(
    result.workload.some(
      (item) => item.teamId === "CH-01" && item.activeTasks === 1,
    ),
  );
});
test("shelter occupancy phát hiện quá tải", () => {
  const result = getShelterAnalytics(data, filter);
  assert.equal(result.occupancy, 1103);
  assert.equal(result.capacity, 2350);
  assert.equal(result.overloaded, 1);
  assert.equal(result.rows[0].id, "TH-03");
});
test("SOS metrics chỉ ra unassigned và vulnerable cases", () => {
  const result = getSosAnalytics(data, filter);
  assert.equal(result.unassigned, 2);
  assert.equal(result.vulnerableCases, 2);
  assert.equal(result.incidentConversionRate, 75);
  assert.ok(
    result.rows.some((item) => item.id === "SOS-0243" && item.bottleneck),
  );
});
test("phản ánh: đếm chờ đánh giá / hợp lệ và thời gian đánh giá dẫn xuất", () => {
  const result = getCitizenReportAnalytics(data, filter);
  assert.equal(result.total, 2);
  assert.equal(result.pending, 1);
  assert.equal(result.valid, 1);
  assert.equal(result.averageReviewMinutes, 20);
  assert.equal(result.rows[0].id, "RPT-0001");
  assert.equal(result.rows[0].waitingMinutes, 60);
});
test("SOS 'Đã xử lý' (chờ duyệt đóng) và nhiệm vụ 'Chờ xác nhận' không được tính là kết thúc", () => {
  const sos = structuredClone(initialSosRequests).map((item) =>
    ({ ...item, status: "Đã xử lý" as const, resolutionSummary: "Đã hỗ trợ", closedAt: null }),
  );
  const tasks = structuredClone(initialTasks).map((item) =>
    item.status === "Hoàn thành"
      ? { ...item, status: "Chờ xác nhận" as const, progress: 90, completedAt: null }
      : item,
  );
  const pending: AnalyticsData = { ...data, sosRequests: sos, tasks };
  const sosResult = getSosAnalytics(pending, filter);
  assert.equal(sosResult.rescueChainCompleted, 0);
  assert.ok(sosResult.byStatus.every((row) => row.label !== "Đã đóng"));
  const taskResult = getTaskAnalytics(pending, filter);
  assert.equal(taskResult.completionRate, 0);
  assert.ok(taskResult.awaitingReviewCount > 0);
  // Nhiệm vụ chờ xác nhận vẫn là nhiệm vụ mở của sự cố.
  assert.equal(
    taskResult.byIncident.reduce((sum, item) => sum + item.open, 0),
    tasks.filter((item) => item.status !== "Đã hủy").length,
  );
  const report = buildOperationalReport(
    pending,
    "Báo cáo tình hình tác chiến",
    filter,
    { id: "USR-OPS-001", displayName: "Cán bộ" },
  );
  assert.ok(report.pendingConfirmation.length > 0);
});
test("report builder tạo đủ nội dung và audit metadata", () => {
  const report = buildOperationalReport(
    data,
    "Báo cáo tình hình tác chiến",
    { ...filter, incidentId: "INC-0241" },
    { id: "USR-CMD-001", displayName: "Người lập từ registry" },
  );
  assert.match(report.situationSummary, /sự cố/);
  assert.ok(
    report.responseStatistics.some((item) => item.basis === "Dẫn xuất"),
  );
  assert.ok(report.majorExceptions.every((item) => item.path.startsWith("/")));
  assert.match(report.audit.source, /Nguồn kiểm thử/);
  assert.equal(report.audit.generatedById, "USR-CMD-001");
  assert.equal(report.audit.generatedBy, "Người lập từ registry");
  assert.equal(report.audit.generatedAt, data.metadata.asOf);
  assert.ok(Array.isArray(report.pendingConfirmation));
});
