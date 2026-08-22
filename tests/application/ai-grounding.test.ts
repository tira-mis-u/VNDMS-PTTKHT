import assert from "node:assert/strict";
import test from "node:test";
import { groundOperationalQuestion } from "../../src/application/ai/aiGrounding";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import { resetSimulationState } from "../../src/application/simulation/simulationUseCases";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import type { AiGroundingSnapshot } from "../../src/domain/ai/types";
const user = (name: string) =>
  structuredClone(demoUsers.find((item) => item.username === name)!);
const snapshot = (): AiGroundingSnapshot => ({
  ...inMemoryOperationalRepository.load(),
  simulation: resetSimulationState(),
});
const ask = (question: string, name = "Trần Quốc Thuận", data = snapshot()) =>
  groundOperationalQuestion({
    question,
    user: user(name),
    snapshot: data,
    now: new Date("2026-08-21T12:00:00+07:00"),
  });
test("FACT lấy từ canonical state và mọi fact có evidence đúng ID", () => {
  const data = snapshot();
  const incident = data.incidents[0];
  const response = ask(`Phân tích ${incident.id}`, "Trần Quốc Thuận", data);
  const facts = response.statements.filter(
    (item) => item.classification === "FACT",
  );
  assert.ok(facts.length > 0);
  assert.ok(facts.every((item) => item.evidenceIds.length > 0));
  const ids = new Set(response.evidence.map((item) => item.entityId));
  assert.ok(ids.has(incident.id));
  assert.match(facts[0].text, new RegExp(incident.id));
});
test("entity không tồn tại trả UNKNOWN và không bịa evidence", () => {
  const response = ask("Phân tích INC-KHONG-TON-TAI");
  assert.ok(
    response.statements.some(
      (item) =>
        item.classification === "UNKNOWN" &&
        item.text.includes("Chưa có dữ liệu"),
    ),
  );
  assert.equal(
    response.evidence.some((item) => item.entityId === "INC-KHONG-TON-TAI"),
    false,
  );
});
test("simulation đang chạy được nhận diện rõ", () => {
  const data = snapshot();
  data.simulation = { ...data.simulation, status: "Đang chạy", tick: 3 };
  const response = ask("Tình hình hiện tại thế nào?", "Trần Quốc Thuận", data);
  assert.equal(response.simulationAware, true);
  assert.match(response.simulationNotice!, /mô phỏng/);
  assert.ok(response.evidence.some((item) => item.entityType === "Simulation"));
});
test("sức chứa Shelter là giá trị dẫn xuất từ canonical fields", () => {
  const data = snapshot();
  const shelter = data.shelters[0];
  const response = ask(
    `${shelter.id} còn tiếp nhận được bao nhiêu người?`,
    "Trần Quốc Thuận",
    data,
  );
  const derived = response.evidence.find(
    (item) =>
      item.entityId === shelter.id && item.field === "availableCapacity",
  );
  assert.equal(derived?.valueKind, "derived");
  assert.equal(
    Number(derived?.value.replaceAll(".", "")),
    Math.max(
      0,
      shelter.capacity - shelter.currentOccupancy - shelter.reservedCapacity,
    ),
  );
});
test("team availability chỉ nêu đội đáp ứng trạng thái chuẩn", () => {
  const response = ask("Đội cứu hộ nào đang sẵn sàng?");
  const teamIds = response.evidence
    .filter((item) => item.entityType === "Team")
    .map((item) => item.entityId);
  const data = snapshot();
  for (const id of teamIds) {
    const team = data.teams.find((item) => item.id === id)!;
    assert.equal(team.status, "Sẵn sàng");
    assert.equal(team.availability, "Có thể điều phối");
  }
});
test("overdue task detection dùng dueAt chuẩn", () => {
  const data = snapshot();
  const task = structuredClone(data.tasks[0]);
  task.id = "TSK-OVERDUE-TEST";
  task.status = "Đang thực hiện";
  task.dueAt = "20/08/2026 08:00";
  data.tasks.unshift(task);
  const response = ask(
    "Có nhiệm vụ nào đang quá hạn?",
    "Trần Quốc Thuận",
    data,
  );
  assert.ok(
    response.statements.some(
      (item) => item.classification === "FACT" && item.text.includes(task.id),
    ),
  );
  assert.ok(
    response.evidence.some(
      (item) => item.entityId === task.id && item.field === "dueAt",
    ),
  );
});
test("relief shortage có evidence từ request và allocation", () => {
  const data = snapshot();
  const request = data.reliefRequests[0];
  request.items[0].quantityApproved = 100;
  data.reservations = data.reservations.filter(
    (item) => item.reliefRequestId !== request.id,
  );
  const response = ask("Kho nào đang thiếu vật tư?", "Trần Quốc Thuận", data);
  assert.ok(
    response.statements.some(
      (item) =>
        item.classification === "FACT" && item.text.includes(request.id),
    ),
  );
  assert.ok(
    response.evidence.some(
      (item) => item.entityId === request.id && item.valueKind === "derived",
    ),
  );
});
test("blocked playbook step tạo INFERENCE có evidence đúng execution", () => {
  const data = snapshot();
  const execution = data.playbookExecutions[0];
  execution.status = "Đang hoạt động";
  execution.stepExecutions[0].status = "Bị chặn";
  execution.stepExecutions[0].blockedReason = "Thiếu bằng chứng hiện trường";
  const response = ask(
    "Có bước playbook nào bị chặn?",
    "Trần Quốc Thuận",
    data,
  );
  assert.ok(
    response.statements.some(
      (item) =>
        item.classification === "INFERENCE" &&
        item.text.includes(execution.stepExecutions[0].stepId),
    ),
  );
  assert.ok(response.evidence.some((item) => item.entityId === execution.id));
});
