import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationalReport,
  getIncidentAnalytics,
  getOperationalSummary,
  getRecoveryAnalytics,
  getReliefAnalytics,
  getShelterAnalytics,
  getSosAnalytics,
  getTaskAnalytics,
  getTeamAnalytics,
  type AnalyticsData,
} from "../../src/application/analytics/analyticsQueries";
import {
  initialEvents,
  initialIncidents,
  initialTasks,
  initialTaskUpdates,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";
import {
  initialEvacuationOperations,
  initialShelters,
} from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";
import { initialSosRequests } from "../../src/data/scenarios/red-river-flood/sosSeed";
import {
  initialInventory,
  initialReliefRequests,
  initialReservations,
  initialShipments,
  initialWarehouses,
} from "../../src/data/scenarios/red-river-flood/reliefSeed";
import { initialPlaybookExecutions } from "../../src/data/scenarios/red-river-flood/playbookSeed";
import {
  initialDamageAssessments,
  initialRecoveryProjects,
} from "../../src/data/scenarios/red-river-flood/recoverySeed";
const data: AnalyticsData = {
  metadata: { asOf: "21/08/2026 10:45", source: "Nguồn kiểm thử" },
  incidents: initialIncidents,
  events: initialEvents,
  tasks: initialTasks,
  taskUpdates: initialTaskUpdates,
  teams: initialTeams,
  shelters: initialShelters,
  evacuationOperations: initialEvacuationOperations,
  sosRequests: initialSosRequests,
  warehouses: initialWarehouses,
  inventory: initialInventory,
  reliefRequests: initialReliefRequests,
  reservations: initialReservations,
  shipments: initialShipments,
  playbookExecutions: initialPlaybookExecutions,
  damageAssessments: initialDamageAssessments,
  recoveryProjects: initialRecoveryProjects,
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
    result.metrics.find(
      (item) => item.label === "Kế hoạch ứng phó đang thực hiện",
    )?.value,
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
test("relief shortage tính từ approved trừ reservations canonical", () => {
  const result = getReliefAnalytics(data, filter);
  assert.equal(result.shortStockRequests, 2);
  assert.equal(result.failedShipments, 1);
  assert.equal(
    result.requestRows.find((item) => item.id === "REQ-0241")?.shortage,
    280,
  );
  assert.equal(result.lowStockItems, 3);
});
test("recovery analytics tổng hợp damage, project và budget", () => {
  const result = getRecoveryAnalytics(data, filter);
  assert.equal(result.estimatedDamage, 60100000000);
  assert.equal(result.verifiedDamage, 31400000000);
  assert.equal(result.averageProjectProgress, 10);
  assert.equal(result.budgetUtilization, 34);
  assert.equal(result.projectsRequiringAttention, 1);
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
  assert.equal(report.recoveryStatus.length, 3);
});
