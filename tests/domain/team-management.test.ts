import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilityForStatus,
  getAllowedTeamTransitions,
  getTeamTransitions,
  openTasksForTeam,
} from "../../src/domain/teams/rules";
import { isTeamAvailableForNewAssignment } from "../../src/application/teams/teamUseCases";
import {
  initialTasks,
  initialTeams,
} from "../../src/data/scenarios/red-river-flood/operationalSeed";

test("vòng đời đội chỉ công bố transition hợp lệ", () => {
  const statuses = [
    "Sẵn sàng",
    "Đang điều động",
    "Đang thực hiện",
    "Tạm nghỉ",
    "Mất liên lạc",
    "Không khả dụng",
  ] as const;
  for (const current of statuses) {
    const targets = getTeamTransitions(current);
    assert.equal(targets.includes(current), false);
    assert.deepEqual([...targets].sort(), statuses.filter((status) => status !== current).sort());
  }
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

test("biểu mẫu chỉ cho giao nhiệm vụ ngay cho đội còn điều phối được", () => {
  const resting = initialTeams.find((team) => team.id === "CH-05")!;
  const busy = initialTeams.find((team) => team.id === "CH-01")!;
  const ready = { ...resting, status: "Sẵn sàng" as const };

  assert.equal(isTeamAvailableForNewAssignment(resting), false);
  assert.equal(isTeamAvailableForNewAssignment(busy), false);
  assert.equal(isTeamAvailableForNewAssignment(ready), true);
});
