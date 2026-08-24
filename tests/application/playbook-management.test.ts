import test from "node:test";
import assert from "node:assert/strict";
import {
  activatePlaybook,
  assertPlaybookScope,
  cancelPlaybook,
  completePlaybook,
  completePlaybookStep,
  pausePlaybook,
  publishPlaybook,
  resumePlaybook,
  skipPlaybookStep,
  startPlaybookStep,
  updateStepEvidence,
} from "../../src/application/playbooks/playbookUseCases";
import {
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
import {
  assertPermission,
  hasPermission,
} from "../../src/lib/permissions/permissions";
const clone = <T>(value: T): T => structuredClone(value);
const context = {
  tasks: initialTasks,
  teams: initialTeams,
  shelters: initialShelters,
  evacuations: initialEvacuationOperations,
  sosRequests: initialSosRequests,
  reliefRequests: initialReliefRequests,
};
test("activation yêu cầu published playbook, Incident và geographic scope", () => {
  const playbook = clone(initialPlaybooks[0]);
  const execution = activatePlaybook(
    "PBX-X",
    playbook,
    clone(initialIncidents[0]),
    "Chỉ huy",
    "commander",
    "Hà Nội",
    "x",
  );
  assert.equal(execution.status, "Đang hoạt động");
  assert.equal(execution.incidentId, "INC-0241");
  assert.throws(
    () =>
      activatePlaybook(
        "X",
        { ...playbook, status: "Nháp" },
        clone(initialIncidents[0]),
        "A",
        "commander",
        "Hà Nội",
        "x",
      ),
    /xuất bản/,
  );
  assert.throws(
    () => assertPlaybookScope("local_officer", "Đà Nẵng", "Hà Nội"),
    /ngoài phạm vi/,
  );
});
test("publish từ chối template thiếu tiêu chí", () => {
  const playbook = {
    ...clone(initialPlaybooks[0]),
    status: "Nháp" as const,
    steps: clone(initialPlaybooks[0].steps),
  };
  assert.equal(publishPlaybook(playbook, "x").status, "Đã xuất bản");
  playbook.steps[0].completionCriteria = [];
  assert.throws(() => publishPlaybook(playbook, "x"), /tiêu chí/);
});
test("pause, resume và cancel tuân theo lifecycle", () => {
  const execution = clone(initialPlaybookExecutions[0]);
  const paused = pausePlaybook(execution, "x");
  assert.equal(paused.status, "Tạm dừng");
  assert.equal(
    resumePlaybook(initialPlaybooks[0], paused, "y").status,
    "Đang hoạt động",
  );
  assert.equal(cancelPlaybook(paused, "z").status, "Đã hủy");
  assert.throws(
    () => pausePlaybook({ ...execution, status: "Hoàn thành" }, "x"),
    /Không thể chuyển/,
  );
});
test("start step chặn khi prerequisite chưa hoàn thành", () => {
  const playbook = clone(initialPlaybooks[0]);
  const execution = clone(initialPlaybookExecutions[0]);
  assert.throws(
    () => startPlaybookStep(playbook, execution, "PBS-08", "A", "x"),
    /tiên quyết|trạng thái/,
  );
  const ready = {
    ...execution,
    stepExecutions: execution.stepExecutions.map((item) =>
      item.stepId === "PBS-05"
        ? { ...item, status: "Sẵn sàng" as const }
        : item,
    ),
  };
  assert.equal(
    startPlaybookStep(playbook, ready, "PBS-05", "A", "x").stepExecutions.find(
      (item) => item.stepId === "PBS-05",
    )?.status,
    "Đang thực hiện",
  );
});
test("complete step bắt buộc bằng chứng operational thật", () => {
  const playbook = clone(initialPlaybooks[0]);
  const execution = clone(initialPlaybookExecutions[0]);
  const completed = completePlaybookStep(
    playbook,
    execution,
    "PBS-06",
    context,
    "Chỉ huy",
    "x",
  );
  assert.equal(
    completed.stepExecutions.find((item) => item.stepId === "PBS-06")?.status,
    "Hoàn thành",
  );
  assert.throws(
    () =>
      completePlaybookStep(playbook, execution, "PBS-07", context, "A", "x"),
    /chưa hoàn thành/,
  );
});
test("skip optional không cần override; required cần permission override", () => {
  const playbook = clone(initialPlaybooks[0]);
  const execution = {
    ...clone(initialPlaybookExecutions[0]),
    stepExecutions: clone(initialPlaybookExecutions[0].stepExecutions).map(
      (item) =>
        item.stepId === "PBS-05"
          ? { ...item, status: "Sẵn sàng" as const }
          : item,
    ),
  };
  assert.equal(
    skipPlaybookStep(
      playbook,
      execution,
      "PBS-05",
      "A",
      false,
      "x",
    ).stepExecutions.find((item) => item.stepId === "PBS-05")?.status,
    "Bỏ qua",
  );
  assert.throws(
    () => skipPlaybookStep(playbook, execution, "PBS-08", "A", false, "x"),
    /phê duyệt ngoại lệ/,
  );
});
test("verification evidence và required completion được enforcement", () => {
  const playbook = clone(initialPlaybooks[0]);
  let execution = clone(initialPlaybookExecutions[0]);
  execution = updateStepEvidence(
    execution,
    "PBS-09",
    { verificationNote: "Đã xác minh mực nước ổn định." },
    "x",
  );
  assert.equal(
    (execution.stepExecutions.find((item) => item.stepId === "PBS-09")
      ?.verificationNote?.length ?? 0) > 0,
    true,
  );
  assert.throws(() => completePlaybook(playbook, execution, "x"), /bắt buộc/);
});
test("RBAC phân biệt publish, execute và override", () => {
  assert.equal(hasPermission("operator", "playbook_execute"), true);
  assert.equal(hasPermission("operator", "playbook_publish"), false);
  assert.equal(hasPermission("local_officer", "playbook_execute"), true);
  assert.throws(
    () => assertPermission("local_officer", "playbook_override"),
    /không có quyền/,
  );
  assert.doesNotThrow(() => assertPermission("commander", "playbook_override"));
});
