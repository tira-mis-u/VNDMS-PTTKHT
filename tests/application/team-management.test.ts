import test from "node:test";
import assert from "node:assert/strict";
import {
  assignTaskToTeam,
  releaseTaskAssignment,
} from "../../src/application/tasks/taskUseCases";
import {
  applyTeamLocation,
  assertTeamDispatchable,
  changeTeamStatus,
  recalculateTeamAssignment,
  updateTeamCapabilities,
} from "../../src/application/teams/teamUseCases";
import {
  initialTasks,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";
import {
  assertPermission,
  hasPermission,
} from "../../src/lib/permissions/permissions";
import { filterAndSortTeams } from "../../src/application/teams/teamQueries";

const clone = <T>(value: T): T => structuredClone(value);

test("gán nhiệm vụ dùng Task use case và đưa task Chờ giao sang Đã giao", () => {
  const task = clone(initialTasks.find((item) => item.id === "TSK-0242")!);
  const assigned = assignTaskToTeam(
    task,
    { teamId: "YT-01", teamLeader: "Đồng Lệ Quyên" },
    "21/08/2026 10:45",
  );
  assert.equal(assigned.teamId, "YT-01");
  assert.equal(assigned.status, "Đã giao");
  assert.equal(assigned.assignee, "Đồng Lệ Quyên");
});

test("gỡ phân công trả task về Chờ giao và tính lại đội sẵn sàng", () => {
  const team = clone(initialTeams.find((item) => item.id === "CH-03")!);
  const task = clone(initialTasks.find((item) => item.id === "TSK-0243")!);
  task.status = "Đã giao";
  const released = releaseTaskAssignment(task, "21/08/2026 10:45");
  const nextTasks = initialTasks.map((item) =>
    item.id === task.id ? released : item,
  );
  const recalculated = recalculateTeamAssignment(
    team,
    nextTasks,
    "21/08/2026 10:45",
  );
  assert.equal(released.teamId, "");
  assert.equal(released.status, "Chờ giao");
  assert.equal(recalculated.currentTask, null);
  assert.equal(recalculated.status, "Sẵn sàng");
  assert.equal(
    recalculated.personnel.every((member) => member.status === "Sẵn sàng"),
    true,
  );
});

test("domain/application chặn điều phối và status tùy tiện", () => {
  const unavailable = clone(initialTeams.find((item) => item.id === "CN-01")!);
  assert.throws(
    () => assertTeamDispatchable(unavailable),
    /không thể điều phối/,
  );
  const active = clone(initialTeams.find((item) => item.id === "CH-01")!);
  assert.throws(
    () => changeTeamStatus(active, "Sẵn sàng", "21/08/2026 10:45"),
    /còn phân công/,
  );
});

test("cập nhật vị trí phục hồi đội mất liên lạc và cập nhật năng lực có validation", () => {
  const lost = clone(initialTeams.find((item) => item.id === "CH-04")!);
  const located = applyTeamLocation(
    lost,
    {
      latitude: 21.04,
      longitude: 105.83,
      accuracy: 10,
      timestamp: "21/08/2026 10:45:00",
      source: "Điều hành viên",
      communicationStatus: "Kết nối",
    },
    "21/08/2026 10:45",
  );
  assert.equal(located.status, "Sẵn sàng");
  assert.equal(located.availability, "Có thể điều phối");
  assert.throws(
    () => updateTeamCapabilities(located, [], "21/08/2026 10:45"),
    /ít nhất một năng lực/,
  );
});

test("query danh sách kết hợp tìm kiếm, loại đội, năng lực và phân công", () => {
  const result = filterAndSortTeams(clone(initialTeams), {
    tab: "Tất cả",
    search: "y tế cơ động",
    status: "Tất cả trạng thái",
    type: "Đội y tế khẩn cấp",
    capability: "Y tế sơ cấp",
    region: "Ba Đình",
    assignment: "Chưa có nhiệm vụ",
    sort: "Ưu tiên vận hành",
  });
  assert.deepEqual(
    result.map((team) => team.id),
    ["YT-01"],
  );
  const exceptions = filterAndSortTeams(clone(initialTeams), {
    tab: "Tất cả",
    search: "",
    status: "Tất cả trạng thái",
    type: "Tất cả loại đội",
    capability: "Tất cả năng lực",
    region: "Tất cả khu vực",
    assignment: "Tất cả phân công",
    sort: "Ưu tiên vận hành",
  });
  assert.deepEqual(
    exceptions.slice(0, 2).map((team) => team.id),
    ["CH-04", "CN-01"],
  );
});

test("RBAC không cấp quyền quản lý đội cho Citizen", () => {
  assert.equal(hasPermission("citizen", "team_view"), false);
  assert.equal(hasPermission("operator", "team_assign"), true);
  assert.throws(
    () => assertPermission("citizen", "team_update_location"),
    /không có quyền/,
  );
});
