import assert from "node:assert/strict";
import test from "node:test";
import { groundOperationalQuestion } from "../../src/application/ai/aiGrounding";
import {
  authorizedOperationalSnapshot,
  pressuredShelters,
  urgentUnassignedSos,
} from "../../src/application/ai/aiQueries";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import { resetSimulationState } from "../../src/application/simulation/simulationUseCases";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import type { AiGroundingSnapshot } from "../../src/domain/ai/types";
const snapshot = (): AiGroundingSnapshot => ({
  ...inMemoryOperationalRepository.load(),
  simulation: resetSimulationState(),
});
const user = (name: string) =>
  structuredClone(demoUsers.find((item) => item.username === name)!);
const citizen = () => ({
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
test("Local Officer không query được entity ngoài geographic scope", () => {
  const data = snapshot();
  const local = user("Phạm Văn Đam");
  const outside = data.incidents.find(
    (item) => !item.location.name.includes("Tây Hồ"),
  )!;
  assert.ok(outside);
  const authorized = authorizedOperationalSnapshot(data, local);
  assert.equal(
    authorized.incidents.some((item) => item.id === outside.id),
    false,
  );
  const answer = groundOperationalQuestion({
    question: `Phân tích ${outside.id}`,
    user: local,
    snapshot: data,
  });
  assert.equal(
    answer.evidence.some((item) => item.entityId === outside.id),
    false,
  );
  assert.ok(
    answer.statements.some((item) => item.classification === "UNKNOWN"),
  );
});
test("Citizen không truy cập dữ liệu vận hành qua AI", () => {
  const answer = groundOperationalQuestion({
    question: "Tình hình hiện tại?",
    user: citizen(),
    snapshot: snapshot(),
  });
  assert.equal(
    answer.evidence.filter((item) => item.entityType !== "Simulation").length,
    0,
  );
  assert.ok(
    answer.statements.some(
      (item) =>
        item.classification === "UNKNOWN" &&
        item.text.includes("không có quyền"),
    ),
  );
});
test("P1 verified unassigned SOS tạo khuyến nghị có căn cứ và action", () => {
  const data = snapshot();
  const sos = structuredClone(data.sosRequests[0]);
  sos.id = "SOS-P1-TEST";
  sos.code = sos.id;
  sos.priority = "P1 — Khẩn cấp";
  sos.verificationStatus = "Đã xác minh";
  sos.status = "Đã xác minh";
  sos.assignedTeamId = null;
  sos.linkedTaskId = null;
  sos.peopleAtRisk = 999;
  sos.linkedIncidentId = data.incidents[0].id;
  sos.location.administrativeArea = data.incidents[0].location.name;
  data.sosRequests.unshift(sos);
  const team = data.teams[0];
  team.status = "Sẵn sàng";
  team.availability = "Có thể điều phối";
  team.currentTask = null;
  team.currentEvacuationOperation = null;
  team.currentReliefShipment = null;
  const answer = groundOperationalQuestion({
    question: "Có SOS P1 nào chưa được điều phối?",
    user: user("Trần Quốc Thuận"),
    snapshot: data,
  });
  assert.ok(
    answer.statements.some(
      (item) =>
        item.classification === "RECOMMENDATION" && item.text.includes(sos.id),
    ),
  );
  assert.ok(
    answer.actions.some(
      (item) => item.type === "DISPATCH_SOS" && item.targetId === sos.id,
    ),
  );
});
test("shelter pressure nhận diện reserved capacity và occupancy", () => {
  const data = snapshot();
  const shelter = data.shelters[0];
  shelter.currentOccupancy = Math.ceil(shelter.capacity * 0.86);
  shelter.reservedCapacity = 0;
  assert.ok(
    pressuredShelters(data).some((item) => item.shelter.id === shelter.id),
  );
});
test("recommendation action vẫn mang permission canonical", () => {
  const data = snapshot();
  const task = data.tasks[0];
  task.status = "Chờ giao";
  task.teamId = "";
  const team = data.teams[0];
  team.status = "Sẵn sàng";
  team.availability = "Có thể điều phối";
  team.currentTask = null;
  team.currentEvacuationOperation = null;
  team.currentReliefShipment = null;
  const answer = groundOperationalQuestion({
    question: `Phân tích ${task.id}`,
    user: user("Trần Quốc Thuận"),
    snapshot: data,
  });
  const action = answer.actions.find((item) => item.type === "ASSIGN_TASK");
  assert.equal(action?.permission, "task_assign");
});
test("urgent SOS query không nhận SOS chưa xác minh", () => {
  const data = snapshot();
  data.sosRequests.forEach((item) => {
    item.priority = "P1 — Khẩn cấp";
    item.verificationStatus = "Chưa xác minh";
    item.assignedTeamId = null;
  });
  assert.equal(urgentUnassignedSos(data).length, 0);
});
