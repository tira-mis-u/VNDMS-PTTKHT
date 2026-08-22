import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSosScope,
  evacuationInputFromSos,
  incidentInputFromSos,
  linkSosIncident,
  linkSosTaskAndTeam,
  resolveSos,
  taskInputFromSos,
  transitionSos,
  updateSosLocation,
  verifySos,
} from "../../src/application/sos/sosUseCases";
import { createIncidentEntity } from "../../src/application/incidents/incidentUseCases";
import { createTaskEntity } from "../../src/application/tasks/taskUseCases";
import { assignTeamToOperation } from "../../src/application/teams/teamUseCases";
import { createEvacuationOperation } from "../../src/application/evacuations/evacuationUseCases";
import { filterAndSortSos } from "../../src/application/sos/sosQueries";
import { initialSosRequests } from "../../src/data/scenarios/red-river-flood/sosSeed";
import { initialTeams } from "../../src/data/scenarios/red-river-flood/operationalSeed";
import { initialShelters } from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";
import { assertShelterCanReceive } from "../../src/domain/shelters/rules";
import {
  assertPermission,
  hasPermission,
} from "../../src/lib/permissions/permissions";
const clone = <T>(value: T): T => structuredClone(value);
test("xác minh SOS đi qua hai bước lifecycle hợp lệ", () => {
  const verified = verifySos(clone(initialSosRequests[2]), "21/08/2026 10:45");
  assert.equal(verified.status, "Đã xác minh");
  assert.equal(verified.verificationStatus, "Đã xác minh");
});
test("invalid transition bị từ chối", () => {
  assert.throws(
    () => transitionSos(clone(initialSosRequests[2]), "Đã đóng", "x"),
    /Không thể chuyển/,
  );
});
test("link và tạo Incident giữ vị trí, dân số và nguồn SOS", () => {
  const sos = clone(initialSosRequests[2]);
  const mapped = incidentInputFromSos(sos);
  const incident = createIncidentEntity(
    "INC-0300",
    mapped.input,
    "Trực ban",
    "21/08/2026 10:45",
  );
  const linked = linkSosIncident(sos, incident.id, "21/08/2026 10:45");
  assert.deepEqual(incident.location.coordinates, sos.location.coordinates);
  assert.equal(mapped.affectedPopulation, sos.peopleAtRisk);
  assert.equal(linked.linkedIncidentId, "INC-0300");
});
test("tạo Task và gán Team dùng application contracts hiện hữu", () => {
  const sos = { ...clone(initialSosRequests[1]), linkedIncidentId: "INC-0241" };
  const team = clone(initialTeams.find((item) => item.id === "YT-01")!);
  const input = taskInputFromSos(sos, team.id);
  const task = createTaskEntity("TSK-0300", input, "21/08/2026 10:45", {
    teamLeader: team.leader,
    coordinates: sos.location.coordinates,
  });
  const assignedTeam = assignTeamToOperation(
    team,
    task.id,
    sos.linkedIncidentId!,
    "21/08/2026 10:45",
  );
  const linked = linkSosTaskAndTeam(sos, task.id, team.id, "21/08/2026 10:45");
  assert.equal(task.status, "Đã giao");
  assert.equal(assignedTeam.currentTask, "TSK-0300");
  assert.equal(linked.status, "Đã điều phối");
});
test("SOS tạo input evacuation và kiểm tra capacity Shelter hiện hữu", () => {
  const sos = {
    ...clone(initialSosRequests[1]),
    peopleAtRisk: 12,
    linkedIncidentId: "INC-0241",
  };
  const shelter = clone(initialShelters.find((item) => item.id === "TH-05")!);
  assert.doesNotThrow(() => assertShelterCanReceive(shelter, sos.peopleAtRisk));
  const input = evacuationInputFromSos(sos, shelter.id);
  const route = {
    id: "RT-X",
    name: "Tuyến thử",
    status: "Thông suốt" as const,
    distanceKm: 2,
    estimatedMinutes: 10,
    coordinates: [sos.location.coordinates, shelter.coordinates],
    blockedSegments: [],
    alternativeCoordinates: [],
    updatedAt: "x",
  };
  const operation = createEvacuationOperation("EVAC-X", input, route, "x");
  assert.equal(operation.destinationShelterId, "TH-05");
  assert.equal(operation.estimatedPopulation, 12);
});
test("resolution bắt buộc kết quả và closure chỉ sau đã xử lý", () => {
  const sos = clone(initialSosRequests[0]);
  assert.throws(() => resolveSos(sos, "", "x"), /kết quả/);
  const resolved = resolveSos(sos, "Đã đưa 6 người tới nơi an toàn.", "x");
  const closed = transitionSos(resolved, "Đã đóng", "y");
  assert.equal(closed.status, "Đã đóng");
  assert.ok(closed.closedAt);
});
test("cập nhật vị trí tái triage minh bạch", () => {
  const sos = clone(initialSosRequests[2]);
  const changed = updateSosLocation(
    sos,
    { ...sos.location, accessCondition: "Bị cô lập" },
    "x",
  );
  assert.equal(
    changed.triageReasons.some((reason) => reason.includes("cô lập")),
    true,
  );
});
test("queue mặc định ưu tiên P1 chưa giao và chờ lâu", () => {
  const rows = filterAndSortSos(clone(initialSosRequests), {
    search: "",
    priority: "Tất cả ưu tiên",
    status: "Tất cả trạng thái",
    verification: "Tất cả xác minh",
    area: "Tất cả khu vực",
    assignment: "Tất cả phân công",
    incident: "Tất cả sự cố",
    time: "Tất cả thời gian",
  });
  assert.equal(rows[0].priority, "P1 — Khẩn cấp");
  assert.equal(
    rows.some((item) => item.id === "SOS-0243"),
    true,
  );
});
test("RBAC và geographic scope được enforcement", () => {
  assert.equal(hasPermission("citizen", "sos_create"), true);
  assert.equal(hasPermission("citizen", "sos_dispatch"), false);
  assert.throws(
    () => assertPermission("citizen", "sos_dispatch"),
    /không có quyền/,
  );
  assert.throws(
    () => assertSosScope("local_officer", "Đà Nẵng", "Hà Nội"),
    /ngoài phạm vi/,
  );
  assert.doesNotThrow(() =>
    assertSosScope("local_officer", "Tây Hồ, Hà Nội", "Hà Nội"),
  );
});
