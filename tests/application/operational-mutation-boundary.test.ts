import assert from "node:assert/strict";
import test from "node:test";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "../../src/application/operations/operationalMutationBoundary";
import type { OperationalSnapshot } from "../../src/application/operations/operationalSnapshot";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import {
  resetSimulationState,
  applyNextSimulationTick,
} from "../../src/application/simulation/simulationUseCases";
import type { SimulationState } from "../../src/domain/simulation/types";
import {
  authorizeResources,
  assertAuthorizedResources,
} from "../../src/lib/security/authorization";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { readFileSync } from "node:fs";

const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const citizen = () => ({
  ...user("Trần Quốc Thuận"),
  id: "USR-CITIZEN-TEST",
  username: "Công dân kiểm thử",
  displayName: "Công dân kiểm thử",
  role: "citizen" as const,
  geographicScope: {
    level: "commune" as const,
    name: "Tứ Liên, Tây Hồ, Hà Nội",
    code: "HN-TAYHO-TULIEN",
  },
});
function harness() {
  const boundary = new OperationalMutationBoundary<
    OperationalSnapshot,
    SimulationState
  >();
  let state: AtomicMutationState<OperationalSnapshot, SimulationState> = {
    snapshot: inMemoryOperationalRepository.load(),
    control: resetSimulationState(),
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

test("single-resource mutation commits once", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: snapshot.incidents.map((item) =>
        item.id === "INC-0241" ? { ...item, progress: 77 } : item,
      ),
    })),
  );
  assert.equal(
    h.state().snapshot.incidents.find((item) => item.id === "INC-0241")
      ?.progress,
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
        item.id === "TSK-0244"
          ? { ...item, teamId: "CH-05", status: "Đã giao" }
          : item,
      ),
      teams: snapshot.teams.map((item) =>
        item.id === "CH-05"
          ? {
              ...item,
              currentTask: "TSK-0244",
              currentIncident: "INC-0241",
              status: "Đang điều động",
            }
          : item,
      ),
    })),
  );
  assert.equal(
    h.state().snapshot.tasks.find((item) => item.id === "TSK-0244")?.teamId,
    "CH-05",
  );
  assert.equal(
    h.state().snapshot.teams.find((item) => item.id === "CH-05")?.currentTask,
    "TSK-0244",
  );
  assert.equal(h.commits(), 1);
});

test("failure during second mutation discards first mutation", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(
    () =>
      h.execute(() => {
        h.boundary.updateSnapshot((snapshot) => ({
          ...snapshot,
          tasks: snapshot.tasks.map((item) =>
            item.id === "TSK-0244" ? { ...item, teamId: "CH-05" } : item,
          ),
        }));
        throw new Error("Team update failed");
      }),
    /Team update failed/,
  );
  assert.deepEqual(h.state(), before);
  assert.equal(h.commits(), 0);
});

test("failure during later mutation restores all prior slices", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        sosRequests: snapshot.sosRequests.map((item) =>
          item.id === "SOS-0241" ? { ...item, assignedTeamId: "CH-05" } : item,
        ),
      }));
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        tasks: [
          { ...snapshot.tasks[0], id: "TSK-ROLLBACK" },
          ...snapshot.tasks,
        ],
      }));
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        teams: snapshot.teams.map((item) =>
          item.id === "CH-05" ? { ...item, currentTask: "TSK-ROLLBACK" } : item,
        ),
      }));
      throw new Error("timeline failed");
    }),
  );
  assert.deepEqual(h.state(), before);
});

test("RBAC authorization failure causes no canonical commit", () => {
  const h = harness();
  assert.throws(() =>
    h.execute(() => {
      assertAuthorizedResources(citizen(), {
        permission: "task_assign",
        resources: [
          { type: "Task", id: "TSK-0244", geographicScope: "Tây Hồ, Hà Nội" },
        ],
      });
      h.boundary.updateSnapshot((snapshot) => snapshot);
    }),
  );
  assert.equal(h.commits(), 0);
});

test("geographic authorization failure causes no partial state", () => {
  const h = harness();
  const decision = authorizeResources(user("Phạm Văn Đam"), {
    permission: "update",
    resources: [
      {
        type: "Incident",
        id: "INC-0234",
        geographicScope: "Long Biên, Hà Nội",
      },
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

test("ownership failure causes no partial state", () => {
  const h = harness();
  assert.throws(
    () =>
      h.execute(() => {
        assertAuthorizedResources(user("Phạm Trung Hiếu"), {
          permission: "team_update_status",
          resources: [
            {
              type: "Team",
              id: "CH-03",
              geographicScope: "Tây Hồ, Hà Nội",
              assignedTeamId: "CH-03",
            },
          ],
        });
        h.boundary.updateSnapshot((snapshot) => snapshot);
      }),
    /đội được phân công/,
  );
  assert.equal(h.commits(), 0);
});

test("SOS + Task + Team dispatch publishes one coordinated snapshot", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === "SOS-0241"
          ? {
              ...item,
              assignedTeamId: "CH-05",
              linkedTaskId: "TSK-SOS-ATOMIC",
              status: "Đã điều phối",
            }
          : item,
      ),
      tasks: [
        {
          ...snapshot.tasks[0],
          id: "TSK-SOS-ATOMIC",
          teamId: "CH-05",
          status: "Đã giao",
        },
        ...snapshot.tasks,
      ],
      teams: snapshot.teams.map((item) =>
        item.id === "CH-05" ? { ...item, currentTask: "TSK-SOS-ATOMIC" } : item,
      ),
    })),
  );
  const state = h.state().snapshot;
  assert.equal(
    state.sosRequests.find((item) => item.id === "SOS-0241")?.linkedTaskId,
    "TSK-SOS-ATOMIC",
  );
  assert.equal(
    state.tasks.some((item) => item.id === "TSK-SOS-ATOMIC"),
    true,
  );
  assert.equal(
    state.teams.find((item) => item.id === "CH-05")?.currentTask,
    "TSK-SOS-ATOMIC",
  );
});

test("Shelter + Evacuation + Team coordination is one commit", () => {
  const h = harness();
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      shelters: snapshot.shelters.map((item) =>
        item.id === "TH-01"
          ? { ...item, reservedCapacity: item.reservedCapacity + 10 }
          : item,
      ),
      evacuationOperations: snapshot.evacuationOperations.map((item) =>
        item.id === "EVAC-001" ? { ...item, assignedTeamId: "CH-05" } : item,
      ),
      teams: snapshot.teams.map((item) =>
        item.id === "CH-05"
          ? { ...item, currentEvacuationOperation: "EVAC-001" }
          : item,
      ),
    })),
  );
  assert.equal(h.commits(), 1);
  assert.equal(
    h
      .state()
      .snapshot.evacuationOperations.find((item) => item.id === "EVAC-001")
      ?.assignedTeamId,
    "CH-05",
  );
});

test("Relief + Warehouse + Shipment + Team rollback together", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        inventory: snapshot.inventory.map((item) =>
          item.warehouseId === "KHO-01"
            ? { ...item, quantityOnHand: item.quantityOnHand - 1 }
            : item,
        ),
        shipments: [
          {
            ...snapshot.shipments[0],
            id: "SHP-ATOMIC",
            assignedTeamId: "CH-05",
          },
          ...snapshot.shipments,
        ],
        teams: snapshot.teams.map((item) =>
          item.id === "CH-05"
            ? { ...item, currentReliefShipment: "SHP-ATOMIC" }
            : item,
        ),
      }));
      throw new Error("warehouse reservation failed");
    }),
  );
  assert.deepEqual(h.state(), before);
});

test("Playbook linked canonical mutation rolls back with execution", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        playbookExecutions: snapshot.playbookExecutions.map((item) =>
          item.id === "PBX-0241" ? { ...item, status: "Hoàn thành" } : item,
        ),
      }));
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        tasks: [
          { ...snapshot.tasks[0], id: "TSK-PB-ATOMIC" },
          ...snapshot.tasks,
        ],
      }));
      throw new Error("linked Task failed");
    }),
  );
  assert.deepEqual(h.state(), before);
});

test("Simulation propagation commits snapshot and control deterministically", () => {
  const first = harness();
  const second = harness();
  for (const h of [first, second])
    h.execute(() => {
      const result = applyNextSimulationTick(
        h.boundary.readControl(),
        h.boundary.readSnapshot(),
      );
      h.boundary.updateSnapshot(() => result.snapshot);
      h.boundary.updateControl(() => result.simulation);
    });
  assert.deepEqual(first.state(), second.state());
  assert.equal(first.state().control.tick, 1);
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
        events: [
          { ...snapshot.events[0], id: "EV-ROLLBACK" },
          ...snapshot.events,
        ],
      }));
      throw new Error("command failed");
    }),
  );
  assert.equal(
    h.state().snapshot.events.some((item) => item.id === "EV-ROLLBACK"),
    false,
  );
});

test("reset publishes repository baseline and Simulation baseline together", () => {
  const h = harness();
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: snapshot.incidents.map((item) => ({ ...item, progress: 99 })),
    }));
    h.boundary.updateControl((control) => ({ ...control, tick: 9 }));
  });
  h.execute(() => {
    h.boundary.updateSnapshot(() => inMemoryOperationalRepository.load());
    h.boundary.updateControl(() => resetSimulationState());
  });
  assert.deepEqual(h.state().snapshot, inMemoryOperationalRepository.load());
  assert.deepEqual(h.state().control, resetSimulationState());
});

test("nested application command does not publish before outer command finishes", () => {
  const h = harness();
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: snapshot.incidents.map((item) =>
        item.id === "INC-0241" ? { ...item, progress: 44 } : item,
      ),
    }));
    h.execute(() =>
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        teams: snapshot.teams.map((item) =>
          item.id === "CH-05" ? { ...item, notes: "nested" } : item,
        ),
      })),
    );
    assert.equal(h.commits(), 0);
  });
  assert.equal(h.commits(), 1);
});

test("Provider publishes every operational command through atomic boundary", () => {
  const source = readFileSync(
    "src/state/operations/OperationalContext.tsx",
    "utf8",
  );
  const valueBlock = source.slice(source.indexOf("const value = {"));
  const commands = [
    "createIncident",
    "dispatchTeam",
    "assignTaskTeam",
    "createRescueTaskFromSos",
    "assignEvacuationTeam",
    "dispatchReliefReservation",
    "completePlaybookStep",
    "createTaskFromRecoveryProject",
    "stepSimulation",
    "resetSimulation",
    "closeIncident",
  ];
  for (const command of commands)
    assert.match(valueBlock, new RegExp(`${command}: atomic\\(${command}\\)`));
  assert.equal(
    (
      readFileSync("src/lib/permissions/permissions.ts", "utf8").match(
        /export const permissionMatrix/g,
      ) ?? []
    ).length,
    1,
  );
});
