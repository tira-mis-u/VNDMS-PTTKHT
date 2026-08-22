import test from "node:test";
import assert from "node:assert/strict";
import {
  initialDamageAssessments,
  initialRecoveryEvents,
  initialRecoveryProjects,
} from "../../src/data/scenarios/red-river-flood/recoverySeed";
import {
  initialIncidents,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";
import { initialReliefRequests } from "../../src/data/scenarios/red-river-flood/reliefSeed";
import { initialPlaybookExecutions } from "../../src/data/scenarios/red-river-flood/playbookSeed";
import { createTaskEntity } from "../../src/application/tasks/taskUseCases";
import { syncRecoveryProgress } from "../../src/application/recovery/recoveryUseCases";
import {
  getIncidentRecoverySummary,
  getRecoveryExceptions,
} from "../../src/application/recovery/recoveryQueries";
const clone = <T>(value: T): T => structuredClone(value);
test("assessment và project reference Incident canonical", () => {
  for (const value of initialDamageAssessments)
    assert.ok(initialIncidents.some((item) => item.id === value.incidentId));
  for (const value of initialRecoveryProjects)
    assert.ok(initialIncidents.some((item) => item.id === value.incidentId));
});
test("project reference verified assessment, Team và Relief có thật", () => {
  for (const project of initialRecoveryProjects) {
    for (const id of project.assessmentIds)
      assert.ok(initialDamageAssessments.some((item) => item.id === id));
    for (const id of project.assignedTeamIds)
      assert.ok(initialTeams.some((item) => item.id === id));
    for (const id of project.relatedReliefRequestIds)
      assert.ok(initialReliefRequests.some((item) => item.id === id));
  }
});
test("Task contract hiện hữu tạo canonical Task và tác động progress", () => {
  const project = clone(initialRecoveryProjects[0]);
  const incident = initialIncidents[0];
  const task = createTaskEntity(
    "TSK-RX",
    {
      incidentId: incident.id,
      title: "Khôi phục",
      type: "Khôi phục",
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
  const before = syncRecoveryProgress(
    { ...project, taskIds: [task.id], requiredTaskIds: [task.id] },
    { tasks: [task], assessments: initialDamageAssessments },
    "x",
  ).progress;
  const after = syncRecoveryProgress(
    { ...project, taskIds: [task.id], requiredTaskIds: [task.id] },
    {
      tasks: [{ ...task, status: "Hoàn thành", progress: 100 }],
      assessments: initialDamageAssessments,
    },
    "y",
  ).progress;
  assert.ok(after > before);
});
test("Playbook execution và recovery cùng Incident cho phép chuyển giai đoạn không duplicate state", () => {
  const execution = initialPlaybookExecutions[0];
  assert.ok(
    initialDamageAssessments.some(
      (item) =>
        item.incidentId === execution.incidentId &&
        item.status === "Đã xác minh",
    ),
  );
  assert.ok(
    initialRecoveryProjects.some(
      (item) => item.incidentId === execution.incidentId,
    ),
  );
});
test("timeline recovery ghi assessment và project lifecycle vào Incident context", () => {
  assert.ok(
    initialRecoveryEvents.some(
      (item) => item.type === "created" || item.type === "verified",
    ),
  );
  assert.ok(initialRecoveryEvents.some((item) => item.type === "started"));
  assert.ok(
    initialRecoveryEvents.every((item) => item.incidentId === "INC-0241"),
  );
});
test("Incident summary và Command Center exceptions dẫn xuất từ canonical state", () => {
  const summary = getIncidentRecoverySummary(
    "INC-0241",
    initialDamageAssessments,
    initialRecoveryProjects,
  );
  assert.equal(summary.assessmentCount, 4);
  assert.equal(summary.projectCount, 3);
  const exceptions = getRecoveryExceptions(
    initialDamageAssessments,
    initialRecoveryProjects,
  );
  assert.ok(exceptions.some((item) => item.kind === "assessment"));
  assert.ok(exceptions.some((item) => item.kind === "project"));
});
