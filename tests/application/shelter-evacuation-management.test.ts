import test from "node:test";
import assert from "node:assert/strict";
import {
  openShelter,
  updateShelterCapacity,
  updateShelterOccupancy,
} from "../../src/application/shelters/shelterUseCases";
import {
  assignEvacuationTeam,
  transitionEvacuation,
  updateEvacuationProgress,
  updateRouteStatus,
} from "../../src/application/evacuations/evacuationUseCases";
import {
  assignTeamToEvacuation,
  releaseTeamFromEvacuation,
} from "../../src/application/teams/teamUseCases";
import {
  initialEvacuationOperations,
  initialShelters,
} from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";
import { initialTeams } from "../../src/data/scenarios/red-river-flood/operationalSeed";
import {
  assertPermission,
  hasPermission,
} from "../../src/lib/permissions/permissions";
import { filterAndSortShelters } from "../../src/application/shelters/shelterQueries";
const clone = <T>(value: T): T => structuredClone(value);

test("cập nhật occupancy tự chuyển điểm sang quá tải", () => {
  const shelter = clone(initialShelters.find((item) => item.id === "TH-01")!);
  const changed = updateShelterOccupancy(shelter, 510, "21/08/2026 10:45");
  assert.equal(changed.status, "Quá tải");
});
test("capacity validation và điều kiện mở được enforcement", () => {
  const shelter = clone(initialShelters[0]);
  assert.throws(
    () => updateShelterCapacity(shelter, 0, 0, "x"),
    /không hợp lệ/,
  );
  const closed = { ...shelter, status: "Tạm đóng" as const };
  assert.equal(
    openShelter(closed, "21/08/2026 10:45").status,
    "Đang tiếp nhận",
  );
});
test("gán hoạt động cập nhật operation và team cùng application contracts", () => {
  const operation = {
    ...clone(initialEvacuationOperations[2]),
    assignedTeamId: null,
  };
  const team = clone(initialTeams.find((item) => item.id === "YT-01")!);
  const assignedOperation = assignEvacuationTeam(
    operation,
    team.id,
    "21/08/2026 10:45",
  );
  const assignedTeam = assignTeamToEvacuation(
    team,
    operation.id,
    operation.incidentId,
    "21/08/2026 10:45",
  );
  assert.equal(assignedOperation.assignedTeamId, "YT-01");
  assert.equal(assignedTeam.currentEvacuationOperation, "EVAC-003");
  assert.equal(assignedTeam.status, "Đang điều động");
  assert.equal(
    assignedTeam.personnel.every((member) => member.status === "Đang nhiệm vụ"),
    true,
  );
});
test("tuyến bị chặn tạm dừng hoạt động và tuyến thay thế có thể kích hoạt", () => {
  const operation = clone(initialEvacuationOperations[0]);
  const blocked = updateRouteStatus(operation, "Bị chặn", "21/08/2026 10:45");
  assert.equal(blocked.status, "Tạm dừng");
  assert.equal(blocked.route.status, "Bị chặn");
  const alternative = updateRouteStatus(
    blocked,
    "Đang dùng tuyến thay thế",
    "21/08/2026 10:46",
  );
  assert.equal(alternative.route.status, "Đang dùng tuyến thay thế");
});
test("transition triển khai cần đội và tuyến khả dụng", () => {
  const operation = clone(initialEvacuationOperations[2]);
  const approved = transitionEvacuation(
    operation,
    "Đã phê duyệt",
    "21/08/2026 10:45",
  );
  assert.throws(
    () => transitionEvacuation(approved, "Đang triển khai", "21/08/2026 10:46"),
    /đội phụ trách/,
  );
});
test("progress và completion/release trả đội về khả dụng", () => {
  const operation = clone(initialEvacuationOperations[0]);
  const progressed = updateEvacuationProgress(
    operation,
    400,
    "21/08/2026 10:45",
  );
  assert.equal(progressed.progress, 80);
  const completed = transitionEvacuation(
    progressed,
    "Hoàn thành",
    "21/08/2026 10:46",
  );
  assert.equal(completed.progress, 100);
  const team = {
    ...clone(initialTeams.find((item) => item.id === "CH-02")!),
    currentTask: null,
    currentEvacuationOperation: operation.id,
  };
  const released = releaseTeamFromEvacuation(team, "21/08/2026 10:46");
  assert.equal(released.currentEvacuationOperation, null);
  assert.equal(released.status, "Sẵn sàng");
});
test("query ưu tiên quá tải và lọc theo occupancy/accessibility", () => {
  const rows = filterAndSortShelters(
    clone(initialShelters),
    clone(initialEvacuationOperations),
    {
      search: "",
      status: "Tất cả trạng thái",
      readiness: "Tất cả mức sẵn sàng",
      area: "Tất cả khu vực",
      capacity: "Tất cả sức chứa",
      occupancy: "Từ 85%",
      accessibility: "Tất cả khả năng tiếp cận",
      medical: "Tất cả năng lực y tế",
      evacuation: "Tất cả hoạt động",
      availability: "Tất cả khả dụng",
      sort: "Ưu tiên vận hành",
    },
  );
  assert.deepEqual(
    rows.map((item) => item.id),
    ["TH-03", "TH-02"],
  );
});
test("RBAC không cấp quyền shelter/evacuation cho Citizen", () => {
  assert.equal(hasPermission("citizen", "shelter_view"), false);
  assert.equal(hasPermission("operator", "evacuation_assign"), true);
  assert.throws(
    () => assertPermission("citizen", "evacuation_create"),
    /không có quyền/,
  );
});
