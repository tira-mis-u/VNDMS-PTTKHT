import assert from "node:assert/strict";
import test from "node:test";
import {
  applyNextSimulationTick,
  resetSimulationState,
} from "../../src/application/simulation/simulationUseCases";
import {
  getOperationalSummary,
  getReliefAnalytics,
  getShelterAnalytics,
  getSosAnalytics,
  getTaskAnalytics,
  getTeamAnalytics,
  type AnalyticsData,
} from "../../src/application/analytics/analyticsQueries";
import {
  inMemoryOperationalRepository,
  type OperationalSnapshot,
} from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import { hasPermission } from "../../src/lib/permissions/permissions";
function analytics(snapshot: OperationalSnapshot): AnalyticsData {
  return snapshot;
}
function run(tick: number) {
  let simulation = resetSimulationState();
  let snapshot = inMemoryOperationalRepository.load();
  for (let index = 0; index < tick; index++) {
    const result = applyNextSimulationTick(simulation, snapshot);
    simulation = result.simulation;
    snapshot = result.snapshot;
  }
  return { simulation, snapshot };
}
const filter = {
  referenceTime: "21/08/2026 11:10",
  geographicScope: "Toàn bộ Hà Nội",
};
test("Analytics tự phản ánh mutation canonical, không có simulation query path", () => {
  const baseline = inMemoryOperationalRepository.load();
  const before = {
    sos: getSosAnalytics(analytics(baseline), filter),
    task: getTaskAnalytics(analytics(baseline), filter),
    team: getTeamAnalytics(analytics(baseline), filter),
    shelter: getShelterAnalytics(analytics(baseline), filter),
    relief: getReliefAnalytics(analytics(baseline), filter),
  };
  const { snapshot } = run(13);
  const after = {
    sos: getSosAnalytics(analytics(snapshot), filter),
    task: getTaskAnalytics(analytics(snapshot), filter),
    team: getTeamAnalytics(analytics(snapshot), filter),
    shelter: getShelterAnalytics(analytics(snapshot), filter),
    relief: getReliefAnalytics(analytics(snapshot), filter),
  };
  assert.equal(after.sos.rows.length, before.sos.rows.length + 1);
  assert.equal(
    after.task.byStatus.reduce((sum, item) => sum + item.value, 0),
    before.task.byStatus.reduce((sum, item) => sum + item.value, 0) + 1,
  );
  assert.ok(after.team.utilizationRate > before.team.utilizationRate);
  assert.ok(after.shelter.occupancy > before.shelter.occupancy);
  assert.equal(
    after.relief.pendingApprovals,
    before.relief.pendingApprovals + 1,
  );
});
test("Command Center sources nhận Incident timeline và resource exceptions", () => {
  const { snapshot } = run(13);
  assert.ok(
    snapshot.events.some(
      (item) =>
        item.source === "Dữ liệu mô phỏng" && item.incidentId === "INC-0241",
    ),
  );
  assert.ok(
    snapshot.shelterEvents.some((item) => item.id.startsWith("SIM-20240901")),
  );
  assert.equal(
    snapshot.shelters.find((item) => item.id === "TH-01")?.status,
    "Gần đầy",
  );
  assert.ok(
    getOperationalSummary(analytics(snapshot), filter).metrics.some(
      (item) => item.label === "SOS đang hoạt động" && item.value >= 4,
    ),
  );
});
test("RBAC chỉ Commander và Operator được điều khiển", () => {
  assert.equal(hasPermission("commander", "simulation_control"), true);
  assert.equal(hasPermission("operator", "simulation_control"), true);
  assert.equal(hasPermission("local_officer", "simulation_control"), false);
  assert.equal(hasPermission("rescue_member", "simulation_view"), true);
  assert.equal(hasPermission("citizen", "simulation_view"), false);
});
test("reset rồi chạy lại cho kết quả cuối giống hệt", () => {
  const first = run(16);
  const second = run(16);
  assert.deepEqual(first.simulation, second.simulation);
  assert.deepEqual(first.snapshot, second.snapshot);
});
