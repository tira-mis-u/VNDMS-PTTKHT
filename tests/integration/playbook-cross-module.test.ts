import test from "node:test";
import assert from "node:assert/strict";
import {
  initialPlaybookEvents,
  initialPlaybookExecutions,
  initialPlaybooks,
} from "../../src/data/scenarios/red-river-flood/playbookSeed";
import {
  initialIncidents,
  initialTasks,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";
import {
  initialEvacuationOperations,
  initialShelters,
} from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";
import { initialSosRequests } from "../../src/data/scenarios/red-river-flood/sosSeed";
import { initialReliefRequests } from "../../src/data/scenarios/red-river-flood/reliefSeed";
import { createTaskEntity } from "../../src/application/tasks/taskUseCases";
import { assignTeamToOperation } from "../../src/application/teams/teamUseCases";
import { updateStepEvidence } from "../../src/application/playbooks/playbookUseCases";
const clone = <T>(value: T): T => structuredClone(value);
test("execution reference Incident canonical", () => {
  const execution = initialPlaybookExecutions[0];
  assert.ok(initialIncidents.some((item) => item.id === execution.incidentId));
  assert.equal(
    initialPlaybooks.some((item) => item.id === execution.playbookId),
    true,
  );
});
test("Task step dùng Task application contract và chỉ giữ taskId", () => {
  const incident = initialIncidents[0];
  const task = createTaskEntity(
    "TSK-PB",
    {
      incidentId: incident.id,
      title: "Nhiệm vụ từ playbook",
      type: "Đánh giá",
      priority: "Cao",
      teamId: "",
      assignee: "",
      location: incident.location.name,
      dueAt: "x",
      description: "x",
    },
    "x",
    { teamLeader: "", coordinates: incident.location.coordinates },
  );
  const execution = updateStepEvidence(
    clone(initialPlaybookExecutions[0]),
    "PBS-07",
    { linkedTaskIds: [task.id] },
    "x",
  );
  assert.deepEqual(
    execution.stepExecutions.find((item) => item.stepId === "PBS-07")
      ?.linkedTaskIds,
    ["TSK-PB"],
  );
  assert.equal(
    "title" in
      execution.stepExecutions.find((item) => item.stepId === "PBS-07")!,
    false,
  );
});
test("Team dispatch tái sử dụng assignment hiện hữu", () => {
  const team = {
    ...clone(initialTeams.find((item) => item.id === "YT-01")!),
    currentTask: null,
    currentEvacuationOperation: null,
    currentReliefShipment: null,
    status: "Sẵn sàng" as const,
  };
  const assigned = assignTeamToOperation(team, "TSK-PB", "INC-0241", "x");
  assert.equal(assigned.currentTask, "TSK-PB");
  assert.equal(assigned.currentIncident, "INC-0241");
});
test("Shelter, Evacuation, SOS và Relief reference entity có thật", () => {
  const execution = initialPlaybookExecutions[0];
  for (const step of execution.stepExecutions) {
    for (const id of step.linkedShelterIds)
      assert.ok(initialShelters.some((item) => item.id === id));
    for (const id of step.linkedEvacuationIds)
      assert.ok(initialEvacuationOperations.some((item) => item.id === id));
    for (const id of step.linkedSosIds)
      assert.ok(initialSosRequests.some((item) => item.id === id));
    for (const id of step.linkedReliefRequestIds)
      assert.ok(initialReliefRequests.some((item) => item.id === id));
    for (const id of step.linkedTaskIds)
      assert.ok(initialTasks.some((item) => item.id === id));
    for (const id of step.linkedTeamIds)
      assert.ok(initialTeams.some((item) => item.id === id));
  }
});
test("timeline seed có activation, start, completion và blocked audit", () => {
  const types = new Set(initialPlaybookEvents.map((item) => item.type));
  assert.equal(types.has("activated"), true);
  assert.equal(types.has("started"), true);
  assert.equal(types.has("completed"), true);
  assert.equal(types.has("blocked"), true);
  assert.equal(
    initialPlaybookExecutions[0].timeline.length,
    initialPlaybookEvents.filter((item) => item.executionId === "PBX-0241")
      .length,
  );
  assert.equal(types.has("published"), true);
});
