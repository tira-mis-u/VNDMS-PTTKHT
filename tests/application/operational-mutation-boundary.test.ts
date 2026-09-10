/*
 * V2 (4 vai) — Ranh giới mutation nguyên tử.
 * Thay đổi so với baseline (có ghi lý do):
 *  - Bỏ mọi test phụ thuộc Simulation/Evacuation/Relief/Playbook (module đã xóa thật).
 *  - Control state không còn (mô phỏng gỡ) → generic `Record<string, never>`.
 *  - Kịch bản mặc định là Yagi 2024 (ID INC-YAGI-*, TSK-YAGI-*, CH-*-01, SOS-YAGI-*).
 *  - Test geographic dùng tài khoản công dân (phamdam, scope Tây Hồ) với quyền `sos_create`.
 *  - Test ownership: rescue_unit bị chặn trên Task chưa được phân công (không còn teamId trên user).
 *  - Danh sách command publish qua `atomic(...)` cập nhật theo store V2
 *    (reportTaskDone/reviewTaskResult/reassignTask/createCitizenReport/publishAlert…).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "../../src/application/operations/operationalMutationBoundary";
import type { OperationalSnapshot } from "../../src/application/operations/operationalSnapshot";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import {
  authorizeResources,
  assertAuthorizedResources,
} from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { readFileSync } from "node:fs";

type Control = Record<string, never>;
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const citizen = () => ({
  ...user("thuantq"),
  id: "USR-CITIZEN-TEST",
  username: "citizen-test",
  displayName: "Công dân kiểm thử",
  role: "citizen" as const,
  geographicScope: {
    level: "commune" as const,
    name: "Tứ Liên, Tây Hồ, Hà Nội",
    code: "HN-TAYHO-TULIEN",
  },
});
function harness() {
  const boundary = new OperationalMutationBoundary<OperationalSnapshot, Control>();
  let state: AtomicMutationState<OperationalSnapshot, Control> = {
    snapshot: inMemoryOperationalRepository.load(),
    control: {},
  };
  let commits = 0;
  const execute = <T>(operation: () => T) =>
    boundary.execute(
      state,
      (next) => {
        state = next;
        commits++;
      },
      operation,
    );
  return { boundary, execute, state: () => state, commits: () => commits };
}
const INC = "INC-YAGI-01";
const TASK_ASSIGNED = "TSK-YAGI-01"; // CH-LC-01, Đang thực hiện
const TASK_UNASSIGNED = "TSK-YAGI-02"; // Chờ giao
const TEAM = "CH-LC-01";
const SOS = "SOS-YAGI-01";

test("single-resource mutation commits once", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: snapshot.incidents.map((item) =>
        item.id === INC ? { ...item, progress: 77 } : item,
      ),
    })),
  );
  assert.equal(
    h.state().snapshot.incidents.find((item) => item.id === INC)?.progress,
    77,
  );
  assert.equal(h.commits(), 1);
});

test("Task + Team mutation succeeds atomically", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      tasks: snapshot.tasks.map((item) =>
        item.id === TASK_UNASSIGNED
          ? { ...item, teamId: TEAM, status: "Đã giao" as const }
          : item,
      ),
      teams: snapshot.teams.map((item) =>
        item.id === TEAM
          ? { ...item, currentTask: TASK_UNASSIGNED, currentIncident: INC }
          : item,
      ),
    })),
  );
  assert.equal(
    h.state().snapshot.tasks.find((item) => item.id === TASK_UNASSIGNED)?.teamId,
    TEAM,
  );
  assert.equal(
    h.state().snapshot.teams.find((item) => item.id === TEAM)?.currentTask,
    TASK_UNASSIGNED,
  );
  assert.equal(h.commits(), 1);
});

test("Task + Team failure rolls back both", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        tasks: [{ ...snapshot.tasks[0], id: "TSK-ROLLBACK" }, ...snapshot.tasks],
        teams: snapshot.teams.map((item) =>
          item.id === TEAM ? { ...item, currentTask: "TSK-ROLLBACK" } : item,
        ),
      }));
      throw new Error("Team update failed");
    }),
  );
  assert.deepEqual(h.state(), before);
  assert.equal(h.commits(), 0);
});

test("RBAC authorization failure causes no canonical commit", () => {
  const h = harness();
  assert.throws(() =>
    h.execute(() => {
      assertAuthorizedResources(citizen(), {
        permission: "task_assign",
        resources: [{ type: "Task", id: TASK_ASSIGNED, geographicScope: "Lào Cai" }],
      });
      h.boundary.updateSnapshot((snapshot) => snapshot);
    }),
  );
  assert.equal(h.commits(), 0);
});

test("geographic authorization failure causes no partial state", () => {
  const h = harness();
  // phamdam: công dân, scope Tây Hồ — có sos_create nhưng ngoài phạm vi Long Biên.
  const decision = authorizeResources(user("phamdam"), {
    permission: "sos_create",
    resources: [
      { type: "SosRequest", id: "new", geographicScope: "Long Biên, Hà Nội" },
    ],
  });
  assert.throws(
    () =>
      h.execute(() => {
        if (!decision.allowed) throw new Error(decision.reason);
        h.boundary.updateSnapshot((snapshot) => snapshot);
      }),
    /ngoài phạm vi/,
  );
  assert.equal(h.commits(), 0);
});

test("ownership failure causes no partial state (rescue_unit trên Task chưa phân công)", () => {
  const h = harness();
  assert.throws(
    () =>
      h.execute(() => {
        assertAuthorizedResources(user("phamhieu"), {
          permission: "task_report_done",
          resources: [{ type: "Task", id: TASK_UNASSIGNED, geographicScope: "Lào Cai" }],
        });
        h.boundary.updateSnapshot((snapshot) => snapshot);
      }),
    /đã được cán bộ phân công/,
  );
  assert.equal(h.commits(), 0);
  // Task đã giao cho một đội bất kỳ → đơn vị cứu hộ (chỉ huy toàn lực lượng) được thao tác.
  assert.doesNotThrow(() =>
    assertAuthorizedResources(user("phamhieu"), {
      permission: "task_report_done",
      resources: [
        { type: "Task", id: TASK_ASSIGNED, geographicScope: "Lào Cai", assignedTeamId: TEAM },
      ],
    }),
  );
});

test("admin không mặc định có quyền xác minh/điều phối/chấp nhận kết quả", () => {
  for (const permission of ["sos_verify", "sos_dispatch", "task_review", "report_review", "published_alert_manage"] as const)
    assert.equal(
      authorizeResources(user("thuantq"), {
        permission,
        resources: [{ type: "Task", id: TASK_ASSIGNED, assignedTeamId: TEAM }],
      }).allowed,
      false,
      `admin không được có ${permission}`,
    );
  assert.equal(
    authorizeResources(user("nguyentrung"), {
      permission: "task_review",
      resources: [{ type: "Task", id: TASK_ASSIGNED, assignedTeamId: TEAM }],
    }).allowed,
    true,
  );
});

test("SOS + Task + Team dispatch publishes one coordinated snapshot", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === SOS
          ? {
              ...item,
              assignedTeamId: TEAM,
              linkedTaskId: "TSK-SOS-ATOMIC",
              status: "Đã điều phối" as const,
            }
          : item,
      ),
      tasks: [
        { ...snapshot.tasks[0], id: "TSK-SOS-ATOMIC", teamId: TEAM, status: "Đã giao" as const },
        ...snapshot.tasks,
      ],
      teams: snapshot.teams.map((item) =>
        item.id === TEAM ? { ...item, currentTask: "TSK-SOS-ATOMIC" } : item,
      ),
    })),
  );
  const state = h.state().snapshot;
  assert.equal(state.sosRequests.find((item) => item.id === SOS)?.linkedTaskId, "TSK-SOS-ATOMIC");
  assert.equal(state.tasks.some((item) => item.id === "TSK-SOS-ATOMIC"), true);
  assert.equal(state.teams.find((item) => item.id === TEAM)?.currentTask, "TSK-SOS-ATOMIC");
  assert.equal(h.commits(), 1);
});

test("Task report-done + TaskReview ghi cùng một commit; từ chối rollback cả hai", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      tasks: snapshot.tasks.map((item) =>
        item.id === TASK_ASSIGNED ? { ...item, status: "Chờ xác nhận" as const, progress: 90 } : item,
      ),
      taskReviews: [
        {
          id: "TRV-ATOMIC",
          taskId: TASK_ASSIGNED,
          incidentId: INC,
          reportedBy: "Đội",
          reportedAt: "x",
          reportNote: "Xong",
          decision: "Chờ xác nhận" as const,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
        ...snapshot.taskReviews,
      ],
    })),
  );
  assert.equal(h.state().snapshot.tasks.find((t) => t.id === TASK_ASSIGNED)?.status, "Chờ xác nhận");
  assert.equal(h.state().snapshot.taskReviews[0]?.id, "TRV-ATOMIC");
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.map((item) =>
          item.id === TASK_ASSIGNED ? { ...item, status: "Hoàn thành" as const, progress: 100 } : item,
        ),
      }));
      throw new Error("review failed");
    }),
  );
  assert.deepEqual(h.state(), before);
});

test("audit/timeline draft is committed on success and discarded on failure", () => {
  const h = harness();
  const initial = h.state().snapshot.events.length;
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      events: [{ ...snapshot.events[0], id: "EV-ATOMIC" }, ...snapshot.events],
    })),
  );
  assert.equal(h.state().snapshot.events.length, initial + 1);
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        events: [{ ...snapshot.events[0], id: "EV-ROLLBACK" }, ...snapshot.events],
      }));
      throw new Error("command failed");
    }),
  );
  assert.equal(h.state().snapshot.events.some((item) => item.id === "EV-ROLLBACK"), false);
});

test("reset publishes repository baseline", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: snapshot.incidents.map((item) => ({ ...item, progress: 99 })),
    })),
  );
  h.execute(() => h.boundary.updateSnapshot(() => inMemoryOperationalRepository.load()));
  assert.deepEqual(h.state().snapshot, inMemoryOperationalRepository.load());
});

test("nested application command does not publish before outer command finishes", () => {
  const h = harness();
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: snapshot.incidents.map((item) =>
        item.id === INC ? { ...item, progress: 44 } : item,
      ),
    }));
    h.execute(() =>
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        teams: snapshot.teams.map((item) =>
          item.id === TEAM ? { ...item, notes: "nested" } : item,
        ),
      })),
    );
    assert.equal(h.commits(), 0);
  });
  assert.equal(h.commits(), 1);
});

test("Provider publishes every operational command through atomic boundary", () => {
  const source = readFileSync("src/state/operations/OperationalContext.tsx", "utf8");
  const valueBlock = source.slice(source.indexOf("const value = {"));
  const commands = [
    "createIncident",
    "dispatchTeam",
    "assignTaskTeam",
    "createRescueTaskFromSos",
    "reportTaskDone",
    "reviewTaskResult",
    "reassignTask",
    "createCitizenReport",
    "reviewCitizenReport",
    "draftPublishedAlert",
    "publishAlert",
    "withdrawPublishedAlert",
    "createSos",
    "closeIncident",
  ];
  for (const command of commands)
    assert.match(valueBlock, new RegExp(`${command}: atomic\\(${command}\\)`));
  // Không còn command nào của module đã xóa.
  for (const removed of ["stepSimulation", "resetSimulation", "assignEvacuationTeam", "dispatchReliefReservation", "completePlaybookStep", "createTaskFromRecoveryProject"])
    assert.doesNotMatch(valueBlock, new RegExp(`${removed}:`));
  assert.equal(
    (readFileSync("src/lib/permissions/permissions.ts", "utf8").match(/export const permissionMatrix/g) ?? []).length,
    1,
  );
});
