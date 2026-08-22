import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  getCommandCenterActionQueue,
  getCommandCenterResourceExceptions,
  getSituationSummary,
} from "../../src/application/command-center/commandCenterQueries";
import {
  applyNextSimulationTick,
  resetSimulationState,
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

test("Command Center query thay đổi ngay theo canonical mutation", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const before = getSituationSummary(snapshot);
  const incident = snapshot.incidents.find((item) => item.id === "INC-0238")!;
  incident.status = "Đã đóng";
  const after = getSituationSummary(snapshot);
  assert.equal(
    Number(after.metrics[0].value),
    Number(before.metrics[0].value) - 1,
  );
});

test("Command Center phản ánh canonical Simulation và reset baseline", () => {
  const baseline = inMemoryOperationalRepository.load();
  const baselineQueue = getCommandCenterActionQueue(baseline);
  const { snapshot } = runTo(13);
  assert.ok(snapshot.sosRequests.some((item) => item.id === "SOS-SIM-001"));
  assert.ok(
    getCommandCenterActionQueue(snapshot).some(
      (item) => item.id === "SOS-SIM-001",
    ),
  );
  assert.notDeepEqual(
    getCommandCenterResourceExceptions(snapshot),
    getCommandCenterResourceExceptions(baseline),
  );
  assert.notDeepEqual(getCommandCenterActionQueue(snapshot), baselineQueue);
  const reset = inMemoryOperationalRepository.load();
  assert.deepEqual(getCommandCenterActionQueue(reset), baselineQueue);
  assert.equal(
    reset.sosRequests.some((item) => item.id.startsWith("SOS-SIM")),
    false,
  );
});

test("không còn Command Center operational dataset thứ hai", () => {
  assert.equal(
    existsSync("src/data/scenarios/red-river-flood/commandCenterSeed.ts"),
    false,
  );
  const files = [
    "src/features/command-center/components/CommandCenter.tsx",
    "src/features/command-center/components/ActionQueue.tsx",
    "src/features/command-center/components/CoordinationTimeline.tsx",
    "src/features/command-center/components/DetailDrawer.tsx",
    "src/features/command-center/components/ResourceExceptions.tsx",
    "src/features/command-center/components/SituationSummary.tsx",
  ];
  assert.ok(
    files.every(
      (file) => !readFileSync(file, "utf8").includes("commandCenterSeed"),
    ),
  );
});
