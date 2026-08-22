import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentHasContent,
  budgetUsage,
  canCompleteRecoveryProject,
  deriveProjectProgress,
  getAssessmentTransitions,
  getMilestoneTransitions,
  getProjectTransitions,
  remainingBudget,
} from "../../src/domain/recovery/rules";
import {
  initialDamageAssessments,
  initialRecoveryProjects,
} from "../../src/data/scenarios/red-river-flood/recoverySeed";
import { initialTasks } from "../../src/data/scenarios/red-river-flood/operationalSeed";
const clone = <T>(value: T): T => structuredClone(value);
test("assessment lifecycle không cho bỏ qua review", () => {
  assert.deepEqual(getAssessmentTransitions("Nháp"), ["Đã gửi"]);
  assert.deepEqual(getAssessmentTransitions("Đang thẩm định"), [
    "Đã xác minh",
    "Từ chối",
  ]);
  assert.equal(
    getAssessmentTransitions("Đã gửi").includes("Đã xác minh"),
    false,
  );
  assert.equal(getAssessmentTransitions("Đã xác minh").length, 0);
});
test("assessment content yêu cầu assessor, summary và damage item", () => {
  const value = clone(initialDamageAssessments[0]);
  assert.equal(assessmentHasContent(value), true);
  value.items = [];
  assert.equal(assessmentHasContent(value), false);
  value.items = clone(initialDamageAssessments[0].items);
  value.assessor = "";
  assert.equal(assessmentHasContent(value), false);
});
test("recovery và milestone lifecycle bị giới hạn", () => {
  assert.deepEqual(getProjectTransitions("Đề xuất"), [
    "Đã phê duyệt",
    "Từ chối",
  ]);
  assert.equal(
    getProjectTransitions("Đang thực hiện").includes("Đề xuất"),
    false,
  );
  assert.deepEqual(getMilestoneTransitions("Chờ"), [
    "Đang thực hiện",
    "Bỏ qua",
  ]);
  assert.equal(getMilestoneTransitions("Chờ").includes("Hoàn thành"), false);
});
test("progress dẫn xuất từ milestone và Task canonical", () => {
  const project = clone(initialRecoveryProjects[0]);
  assert.equal(
    deriveProjectProgress(project, {
      tasks: clone(initialTasks),
      assessments: clone(initialDamageAssessments),
    }),
    31,
  );
  const tasks = clone(initialTasks).map((item) =>
    item.id === "TSK-0242"
      ? { ...item, status: "Hoàn thành" as const, progress: 100 }
      : item,
  );
  assert.ok(
    deriveProjectProgress(project, {
      tasks,
      assessments: initialDamageAssessments,
    }) > 31,
  );
});
test("completion yêu cầu milestone, task, verified assessment và verification", () => {
  const project = clone(initialRecoveryProjects[0]);
  let result = canCompleteRecoveryProject(project, {
    tasks: initialTasks,
    assessments: initialDamageAssessments,
  });
  assert.equal(result.allowed, false);
  project.milestones = project.milestones.map((item) => ({
    ...item,
    status: "Hoàn thành",
  }));
  project.completionVerification = {
    actor: "A",
    timestamp: "x",
    note: "Đạt",
    evidence: ["BB"],
  };
  const tasks = clone(initialTasks).map((item) =>
    item.id === "TSK-0242" ? { ...item, status: "Hoàn thành" as const } : item,
  );
  result = canCompleteRecoveryProject(project, {
    tasks,
    assessments: initialDamageAssessments,
  });
  assert.equal(result.allowed, true);
});
test("budget remaining và usage được dẫn xuất", () => {
  const project = initialRecoveryProjects[0];
  assert.equal(remainingBudget(project), 1800000000);
  assert.equal(budgetUsage(project), 87);
});
