import assert from "node:assert/strict";
import test from "node:test";
import { executeGroundedAction } from "../../src/application/ai/aiActions";
import { buildDeterministicActions } from "../../src/application/ai/aiRecommendations";
import { assignTaskToTeam } from "../../src/application/tasks/taskUseCases";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import { resetSimulationState } from "../../src/application/simulation/simulationUseCases";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import type {
  AiActionExecutor,
  AiGroundingSnapshot,
} from "../../src/domain/ai/types";
const data = (): AiGroundingSnapshot => ({
  ...inMemoryOperationalRepository.load(),
  simulation: resetSimulationState(),
});
const user = (name: string) =>
  structuredClone(demoUsers.find((item) => item.username === name)!);
function fixture() {
  const snapshot = data();
  const task = snapshot.tasks[0];
  task.status = "Chờ giao";
  task.teamId = "";
  task.teamLeader = "";
  task.assignee = "";
  const team = snapshot.teams[0];
  team.status = "Sẵn sàng";
  team.availability = "Có thể điều phối";
  team.currentTask = null;
  team.currentIncident = null;
  team.currentEvacuationOperation = null;
  team.currentReliefShipment = null;
  const action = buildDeterministicActions(snapshot, task.id).find(
    (item) => item.type === "ASSIGN_TASK",
  )!;
  return { snapshot, task, team, action };
}
test("recommendation không mutate trước confirmation", () => {
  const { snapshot, task, action } = fixture();
  let called = 0;
  const executor = {
    assignTask: () => {
      called++;
    },
    dispatchSos: () => "",
    startTask: () => {},
    redirectEvacuation: () => {},
    createTask: () => "",
  };
  const result = executeGroundedAction(
    {
      proposal: action,
      confirmed: false,
      user: user("Trần Quốc Thuận"),
      snapshot,
    },
    executor,
  );
  assert.equal(result.status, "confirmation_required");
  assert.equal(called, 0);
  assert.equal(task.teamId, "");
});
test("confirmed action gọi existing application contract, cập nhật canonical timeline và audit", () => {
  const { snapshot, task, action } = fixture();
  const timeline: string[] = [];
  const audit: string[] = [];
  const executor: AiActionExecutor = {
    assignTask: (taskId, teamId) => {
      snapshot.tasks = snapshot.tasks.map((item) =>
        item.id === taskId
          ? assignTaskToTeam(
              item,
              {
                teamId,
                teamLeader: snapshot.teams.find((team) => team.id === teamId)!
                  .leader,
              },
              "21/08/2026 12:01",
            )
          : item,
      );
      timeline.push(`Đã điều phối ${teamId} cho ${taskId}`);
      audit.push("MUTATION_AUTHORIZED:task_assign");
    },
    dispatchSos: () => "",
    startTask: () => {},
    redirectEvacuation: () => {},
    createTask: () => "",
  };
  const result = executeGroundedAction(
    {
      proposal: action,
      confirmed: true,
      user: user("Trần Quốc Thuận"),
      snapshot,
    },
    executor,
  );
  assert.equal(result.status, "executed");
  assert.equal(
    snapshot.tasks.find((item) => item.id === task.id)?.teamId,
    action.payload.teamId,
  );
  assert.equal(timeline.length, 1);
  assert.deepEqual(audit, ["MUTATION_AUTHORIZED:task_assign"]);
});
test("confirmed action re-check quyền và geographic scope", () => {
  const { snapshot, action } = fixture();
  let called = 0;
  const executor = {
    assignTask: () => {
      called++;
    },
    dispatchSos: () => "",
    startTask: () => {},
    redirectEvacuation: () => {},
    createTask: () => "",
  };
  const result = executeGroundedAction(
    {
      proposal: action,
      confirmed: true,
      user: user("Phạm Văn Đam"),
      snapshot,
    },
    executor,
  );
  assert.equal(result.status, "denied");
  assert.equal(called, 0);
});
test("stale team state chặn hành động sau confirmation", () => {
  const { snapshot, team, action } = fixture();
  team.status = "Đang thực hiện";
  let called = 0;
  const result = executeGroundedAction(
    {
      proposal: action,
      confirmed: true,
      user: user("Trần Quốc Thuận"),
      snapshot,
    },
    {
      assignTask: () => {
        called++;
      },
      dispatchSos: () => "",
      startTask: () => {},
      redirectEvacuation: () => {},
      createTask: () => "",
    },
  );
  assert.equal(result.status, "stale");
  assert.equal(called, 0);
});
