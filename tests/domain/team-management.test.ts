import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilityForStatus,
  getAllowedTeamTransitions,
  getTeamTransitions,
  openTasksForTeam,
} from "../../src/domain/teams/rules";
import {
  initialTasks,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";

test("vòng đời đội chỉ công bố transition hợp lệ", () => {
  assert.deepEqual(getTeamTransitions("Sẵn sàng"), [
    "Đang điều động",
    "Tạm nghỉ",
    "Không khả dụng",
  ]);
  assert.equal(
    getTeamTransitions("Đang thực hiện").includes("Tạm nghỉ"),
    false,
  );
  assert.equal(
    getAllowedTeamTransitions(
      initialTeams.find((team) => team.id === "CH-01")!,
    ).includes("Sẵn sàng"),
    false,
  );
  assert.equal(availabilityForStatus("Mất liên lạc"), "Không sẵn sàng");
});

test("nhiệm vụ mở của đội loại nhiệm vụ đã kết thúc", () => {
  assert.deepEqual(
    openTasksForTeam("CH-01", initialTasks).map((task) => task.id),
    ["TSK-0241"],
  );
  assert.deepEqual(openTasksForTeam("CH-04", initialTasks), []);
  assert.equal(
    initialTeams.find((team) => team.id === "CH-01")?.currentTask,
    "TSK-0241",
  );
});
