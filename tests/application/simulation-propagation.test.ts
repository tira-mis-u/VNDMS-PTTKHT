import assert from "node:assert/strict";
import test from "node:test";
import {
  applyNextSimulationTick,
  applyOperationalPropagation,
  changeSimulationSpeed,
  resetSimulationState,
  startSimulation,
  stopSimulation,
} from "../../src/application/simulation/simulationUseCases";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
function runTo(tick: number) {
  let simulation = resetSimulationState();
  let snapshot = inMemoryOperationalRepository.load();
  for (let index = 0; index < tick; index++) {
    const result = applyNextSimulationTick(simulation, snapshot);
    simulation = result.simulation;
    snapshot = result.snapshot;
  }
  return { simulation, snapshot };
}
test("application controls giữ deterministic state", () => {
  const baseline = resetSimulationState();
  assert.equal(startSimulation(baseline).status, "Đang chạy");
  assert.equal(stopSimulation(startSimulation(baseline)).status, "Tạm dừng");
  assert.equal(changeSimulationSpeed(baseline, 2).speed, 2);
});
test("Incident và Playbook nhận trigger BĐ III qua contract", () => {
  const { snapshot } = runTo(5);
  assert.equal(
    snapshot.incidents.find((item) => item.id === "INC-0241")?.severity,
    "Khẩn cấp",
  );
  assert.ok(snapshot.events.some((item) => item.id === "SIM-20240901-T04-INC"));
  assert.match(
    snapshot.playbookExecutions
      .find((item) => item.id === "PBX-0241")
      ?.stepExecutions.find((item) => item.stepId === "PBS-06")?.notes ?? "",
    /BĐ III/,
  );
});
test("route và shelter pressure lan truyền canonical", () => {
  const { snapshot } = runTo(9);
  assert.equal(
    snapshot.evacuationOperations.find((item) => item.id === "EVAC-001")?.route
      .status,
    "Đang dùng tuyến thay thế",
  );
  assert.equal(
    snapshot.shelters.find((item) => item.id === "TH-01")?.currentOccupancy,
    490,
  );
  assert.equal(
    snapshot.evacuationOperations.find((item) => item.id === "EVAC-001")
      ?.evacuatedPopulation,
    390,
  );
});
test("SOS, Task và Team assignment dùng entity canonical", () => {
  const { snapshot } = runTo(12);
  const sos = snapshot.sosRequests.find((item) => item.id === "SOS-SIM-001");
  const task = snapshot.tasks.find((item) => item.id === "TSK-SIM-001");
  assert.equal(sos?.linkedTaskId, task?.id);
  assert.equal(task?.teamId, "CH-05");
  assert.equal(
    snapshot.teams.find((item) => item.id === "CH-05")?.currentTask,
    task?.id,
  );
});
test("relief pressure tạo request deterministic không trùng", () => {
  const { simulation, snapshot } = runTo(13);
  assert.equal(
    snapshot.reliefRequests.filter((item) => item.id === "REQ-SIM-001").length,
    1,
  );
  const event = simulation.triggeredEvents.find((item) => item.tick === 13)!;
  const reapplied = applyOperationalPropagation(snapshot, event);
  assert.equal(
    reapplied.reliefRequests.filter((item) => item.id === "REQ-SIM-001").length,
    1,
  );
  assert.equal(
    reapplied.reliefEvents.filter((item) => item.id.startsWith(event.id))
      .length,
    1,
  );
});
test("response progress và ổn định hoàn tất chuỗi cứu hộ", () => {
  const { snapshot } = runTo(15);
  assert.equal(
    snapshot.tasks.find((item) => item.id === "TSK-SIM-001")?.status,
    "Hoàn thành",
  );
  assert.equal(
    snapshot.sosRequests.find((item) => item.id === "SOS-SIM-001")?.status,
    "Đã xử lý",
  );
  assert.equal(
    snapshot.incidents.find((item) => item.id === "INC-0241")?.status,
    "Đã kiểm soát",
  );
});
test("recovery transition tạo dự án đã khởi động", () => {
  const { simulation, snapshot } = runTo(16);
  assert.equal(simulation.status, "Hoàn thành");
  assert.equal(
    snapshot.recoveryProjects.find((item) => item.id === "RP-SIM-001")?.status,
    "Đang thực hiện",
  );
  assert.equal(
    snapshot.recoveryProjects.filter((item) => item.id === "RP-SIM-001").length,
    1,
  );
});
test("reset repository khôi phục baseline sạch và không orphan", () => {
  runTo(16);
  const reset = inMemoryOperationalRepository.load();
  assert.equal(
    reset.tasks.some((item) => item.id.startsWith("TSK-SIM")),
    false,
  );
  assert.equal(
    reset.sosRequests.some((item) => item.id.startsWith("SOS-SIM")),
    false,
  );
  assert.equal(
    reset.reliefRequests.some((item) => item.id.startsWith("REQ-SIM")),
    false,
  );
  assert.equal(
    reset.recoveryProjects.some((item) => item.id.startsWith("RP-SIM")),
    false,
  );
  assert.deepEqual(reset, inMemoryOperationalRepository.load());
});
