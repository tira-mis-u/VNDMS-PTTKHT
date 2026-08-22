import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateExecutionProgress,
  canCompleteExecution,
  deriveStepReadiness,
  evaluateStepCompletion,
  getExecutionTransitions,
  getStepTransitions,
  prerequisitesMet,
} from "../../src/domain/playbooks/rules";
import {
  initialPlaybookExecutions,
  initialPlaybooks,
} from "../../src/data/scenarios/red-river-flood/playbookSeed";
import {
  initialTasks,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";
import {
  initialEvacuationOperations,
  initialShelters,
} from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";
import { initialSosRequests } from "../../src/data/scenarios/red-river-flood/sosSeed";
import { initialReliefRequests } from "../../src/data/scenarios/red-river-flood/reliefSeed";
const clone = <T>(value: T): T => structuredClone(value);
const context = {
  tasks: initialTasks,
  teams: initialTeams,
  shelters: initialShelters,
  evacuations: initialEvacuationOperations,
  sosRequests: initialSosRequests,
  reliefRequests: initialReliefRequests,
};
test("lifecycle execution và step không cho nhảy tùy ý", () => {
  assert.deepEqual(getExecutionTransitions("Đang hoạt động"), [
    "Tạm dừng",
    "Hoàn thành",
    "Đã hủy",
  ]);
  assert.equal(getExecutionTransitions("Hoàn thành").length, 0);
  assert.deepEqual(getStepTransitions("Chờ"), [
    "Sẵn sàng",
    "Bỏ qua",
    "Bị chặn",
  ]);
  assert.equal(getStepTransitions("Chờ").includes("Hoàn thành"), false);
});
test("prerequisite quyết định readiness và blocked reason", () => {
  const playbook = clone(initialPlaybooks[0]);
  const execution = clone(initialPlaybookExecutions[0]);
  const relief = playbook.steps.find((item) => item.id === "PBS-08")!;
  assert.equal(prerequisitesMet(relief, execution), false);
  const changed = deriveStepReadiness(playbook, {
    ...execution,
    stepExecutions: execution.stepExecutions.map((item) =>
      item.stepId === "PBS-08" ? { ...item, status: "Chờ" as const } : item,
    ),
  });
  assert.equal(
    changed.stepExecutions.find((item) => item.stepId === "PBS-08")?.status,
    "Bị chặn",
  );
});
test("completion criteria kiểm tra entity canonical theo loại bước", () => {
  const playbook = initialPlaybooks[0];
  const execution = initialPlaybookExecutions[0];
  const evacuation = playbook.steps.find((item) => item.id === "PBS-06")!;
  const state = execution.stepExecutions.find(
    (item) => item.stepId === "PBS-06",
  )!;
  assert.equal(
    evaluateStepCompletion(evacuation, state, context).satisfied,
    true,
  );
  const verification = playbook.steps.find((item) => item.id === "PBS-09")!;
  const verifyState = execution.stepExecutions.find(
    (item) => item.stepId === "PBS-09",
  )!;
  assert.equal(
    evaluateStepCompletion(verification, verifyState, context).satisfied,
    false,
  );
});
test("required step phải hoàn thành trước completion; optional có thể bỏ qua", () => {
  const playbook = clone(initialPlaybooks[0]);
  const execution = clone(initialPlaybookExecutions[0]);
  assert.equal(canCompleteExecution(playbook, execution), false);
  const allDone = {
    ...execution,
    stepExecutions: execution.stepExecutions.map((item) => ({
      ...item,
      status: "Hoàn thành" as const,
    })),
  };
  assert.equal(canCompleteExecution(playbook, allDone), true);
  assert.equal(
    playbook.steps.find((item) => item.id === "PBS-05")?.required,
    false,
  );
});
test("progress được dẫn xuất từ step execution", () => {
  assert.equal(calculateExecutionProgress(initialPlaybookExecutions[0]), 50);
});
