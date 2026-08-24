import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeableAlerts,
  buildAcknowledgeAlertPlan,
  buildCreateIncidentPlan,
  buildCreateTaskPlan,
  buildDispatchTeamPlan,
  buildRecallTeamPlan,
  buildSosTriagePlan,
  dispatchableTeams,
  openIncidents,
  recallableTeams,
  triageableSos,
  type CommandCenterActionContext,
} from "../../src/application/command-center/commandCenterActions";
import {
  getCommandCenterActionQueue,
  getSituationSummary,
} from "../../src/application/command-center/commandCenterQueries";
import { createIncidentEntity } from "../../src/application/incidents/incidentUseCases";
import { releaseTaskAssignment } from "../../src/application/tasks/taskUseCases";
import { recalculateTeamAssignment } from "../../src/application/teams/teamUseCases";
import {
  retriageSos,
  verifySos,
} from "../../src/application/sos/sosUseCases";
import { acknowledgeOperationalAlert } from "../../src/application/alerts/alertUseCases";
import { deriveAuthorizedAlerts } from "../../src/application/alerts/alertQueries";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "../../src/application/operations/operationalMutationBoundary";
import type { OperationalSnapshot } from "../../src/application/operations/operationalSnapshot";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { createOperationalResourceContext } from "../../src/application/authorization/operationalResourceContext";
import { authorizeResources } from "../../src/lib/security/authorization";
import {
  applyNextSimulationTick,
  resetSimulationState,
} from "../../src/application/simulation/simulationUseCases";
import type { SimulationState } from "../../src/domain/simulation/types";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import { readFileSync } from "node:fs";

const NOW = "21/08/2026 10:55";
const source = () => inMemoryOperationalRepository.load();
const account = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const commanderView = () => {
  const commander = account("Trần Quốc Thuận");
  const view = createAuthorizedOperationalView(commander, source());
  const context: CommandCenterActionContext = {
    incidents: view.incidents,
    teams: view.teams,
    sosRequests: view.sosRequests,
    alerts: deriveAuthorizedAlerts(commander, view),
    tasks: view.tasks,
  };
  return { commander, view, context };
};

function harness() {
  const boundary = new OperationalMutationBoundary<
    OperationalSnapshot,
    SimulationState
  >();
  let state: AtomicMutationState<OperationalSnapshot, SimulationState> = {
    snapshot: source(),
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

/** Cập nhật canonical giống hệt command dispatchTeam của provider. */
const applyDispatch = (
  snapshot: OperationalSnapshot,
  incidentId: string,
  teamId: string,
): OperationalSnapshot => ({
  ...snapshot,
  incidents: snapshot.incidents.map((item) =>
    item.id === incidentId
      ? {
          ...item,
          assignedTeamId: teamId,
          status: "Đang điều phối" as const,
          updatedAt: NOW,
        }
      : item,
  ),
  teams: snapshot.teams.map((team) =>
    team.id === teamId
      ? {
          ...team,
          status: "Đang điều động" as const,
          currentIncident: incidentId,
          availability: "Đang bận" as const,
          updatedAt: NOW,
        }
      : team,
  ),
});

/* --- Candidate selectors --- */

test("selectors đọc authorized view: seed không có đội sẵn sàng, 1 đội thu hồi được theo lifecycle", () => {
  const { context } = commanderView();
  assert.deepEqual(dispatchableTeams(context), []);
  assert.deepEqual(
    recallableTeams(context).map((item) => item.team.id).sort(),
    ["CH-03"],
  );
  assert.deepEqual(
    openIncidents(context).map((item) => item.id),
    ["INC-0241", "INC-0238", "INC-0234", "INC-0229"],
  );
  assert.deepEqual(
    acknowledgeableAlerts(context).length,
    5,
  );
  assert.deepEqual(
    triageableSos(context).map((item) => item.id),
    ["SOS-0242", "SOS-0241", "SOS-0243"],
  );
});

/* --- Confirmation bắt buộc --- */

test("mọi builder từ chối khi chưa xác nhận", () => {
  const { context } = commanderView();
  assert.equal(
    buildCreateIncidentPlan({
      confirmed: false,
      title: "Ngập",
      type: "Ngập đô thị",
      severity: "Cao",
      area: "Tây Hồ",
      description: "",
    }).ok,
    false,
  );
  assert.equal(
    buildCreateTaskPlan(context, {
      confirmed: false,
      incidentId: "INC-0241",
      title: "X",
      type: "Cứu hộ",
      priority: "Cao",
      teamId: "",
      dueAt: "21/08/2026 12:00",
      description: "",
    }).ok,
    false,
  );
  assert.equal(
    buildAcknowledgeAlertPlan(context, {
      confirmed: false,
      alertKey: "shelter:Shelter:TH-03:shelter_overloaded",
    }).ok,
    false,
  );
  assert.equal(
    buildDispatchTeamPlan(context, {
      confirmed: false,
      incidentId: "INC-0241",
      teamId: "CH-01",
    }).ok,
    false,
  );
  assert.equal(
    buildRecallTeamPlan(context, { confirmed: false, teamId: "CH-01" }).ok,
    false,
  );
  assert.equal(
    buildSosTriagePlan(context, {
      confirmed: false,
      sosId: "SOS-0243",
      mode: "verify",
    }).ok,
    false,
  );
});

/* --- Happy path + validation theo action --- */

test("Tạo sự cố: plan hợp lệ; thiếu tiêu đề/khu vực bị chặn trước khi commit", () => {
  const plan = buildCreateIncidentPlan({
    confirmed: true,
    title: "Ngập cục bộ ngõ 124 Âu Cơ",
    type: "Ngập đô thị",
    severity: "Trung bình",
    area: "Tứ Liên, Tây Hồ, Hà Nội",
    description: "",
  });
  assert.ok(plan.ok);
  assert.equal(plan.plan.kind, "create_incident");
  assert.equal(plan.plan.permission, "create");
  assert.ok(plan.summaryLines.length >= 2);
  assert.equal(
    buildCreateIncidentPlan({
      confirmed: true,
      title: "  ",
      type: "Ngập đô thị",
      severity: "Cao",
      area: "Tây Hồ",
      description: "",
    }).ok,
    false,
  );
});

test("Giao nhiệm vụ: plan hợp lệ không đội; sự cố đã đóng/đội ngoài phạm vi bị chặn", () => {
  const { context } = commanderView();
  const plan = buildCreateTaskPlan(context, {
    confirmed: true,
    incidentId: "INC-0241",
    title: "Trục vớt phương tiện tại Phúc Tân",
    type: "Cứu hộ",
    priority: "Cao",
    teamId: "",
    dueAt: "21/08/2026 15:00",
    description: "",
  });
  assert.ok(plan.ok);
  assert.equal(plan.plan.kind, "create_task");
  assert.equal(plan.plan.permission, "task_create");
  const closed = buildCreateTaskPlan(context, {
    confirmed: true,
    incidentId: "INC-0229",
    title: "X",
    type: "Cứu hộ",
    priority: "Cao",
    teamId: "",
    dueAt: "21/08/2026 15:00",
    description: "",
  });
  assert.equal(closed.ok, true, "INC-0229 Đã kiểm soát vẫn còn mở");
  const taskOnClosed = buildCreateTaskPlan(
    {
      ...context,
      incidents: context.incidents.map((item) =>
        item.id === "INC-0234" ? { ...item, status: "Đã đóng" as const } : item,
      ),
    },
    {
      confirmed: true,
      incidentId: "INC-0234",
      title: "X",
      type: "Cứu hộ",
      priority: "Cao",
      teamId: "",
      dueAt: "21/08/2026 15:00",
      description: "",
    },
  );
  assert.equal(taskOnClosed.ok, false);
  const ghostTeam = buildCreateTaskPlan(context, {
    confirmed: true,
    incidentId: "INC-0241",
    title: "X",
    type: "Cứu hộ",
    priority: "Cao",
    teamId: "CH-99",
    dueAt: "21/08/2026 15:00",
    description: "",
  });
  assert.equal(ghostTeam.ok, false);
});

test("Gửi cảnh báo: chỉ nhận cảnh báo chờ xác nhận; key lạ/không còn chờ bị chặn", () => {
  const { context } = commanderView();
  const pending = acknowledgeableAlerts(context)[0];
  const plan = buildAcknowledgeAlertPlan(context, {
    confirmed: true,
    alertKey: pending.key,
  });
  assert.ok(plan.ok);
  assert.equal(plan.plan.permission, "alert_acknowledge");
  assert.equal(
    buildAcknowledgeAlertPlan(context, {
      confirmed: true,
      alertKey: "unknown:key",
    }).ok,
    false,
  );
  assert.equal(
    buildAcknowledgeAlertPlan(
      { ...context, alerts: [] },
      { confirmed: true, alertKey: pending.key },
    ).ok,
    false,
  );
});

test("Điều phối đội: dispatch bị chặn khi đội bận; thu hồi CH-03 theo lifecycle rồi dispatch hợp lệ", () => {
  const { context } = commanderView();
  const blocked = buildDispatchTeamPlan(context, {
    confirmed: true,
    incidentId: "INC-0241",
    teamId: "CH-01",
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.ok ? "" : blocked.error, /không sẵn sàng/);
  const recallRunning = buildRecallTeamPlan(context, {
    confirmed: true,
    teamId: "CH-01",
  });
  assert.equal(
    recallRunning.ok,
    false,
    "TSK-0241 đang thực hiện — không thể thu hồi theo lifecycle",
  );
  const noTask = buildRecallTeamPlan(context, {
    confirmed: true,
    teamId: "CH-04",
  });
  assert.equal(noTask.ok, false);
  const recallPlan = buildRecallTeamPlan(context, {
    confirmed: true,
    teamId: "CH-03",
  });
  assert.ok(recallPlan.ok);
  assert.equal(recallPlan.plan.permission, "team_assign");
  // Canonical change: thu hồi CH-03 khỏi TSK-0243 (Chờ giao) theo application contracts
  const snapshot = source();
  const task = snapshot.tasks.find((item) => item.id === "TSK-0243")!;
  const released = releaseTaskAssignment(task, NOW);
  const tasks = snapshot.tasks.map((item) =>
    item.id === task.id ? released : item,
  );
  const teams = snapshot.teams.map((team) =>
    team.id === "CH-03" ? recalculateTeamAssignment(team, tasks, NOW) : team,
  );
  const nextContext: CommandCenterActionContext = {
    ...context,
    teams,
    tasks,
  };
  assert.ok(dispatchableTeams(nextContext).some((item) => item.id === "CH-03"));
  const dispatchPlan = buildDispatchTeamPlan(nextContext, {
    confirmed: true,
    incidentId: "INC-0241",
    teamId: "CH-03",
  });
  assert.ok(dispatchPlan.ok);
  assert.equal(dispatchPlan.plan.permission, "dispatch");
});

test("Xử lý SOS: verify SOS chưa xác minh; điều đội theo lifecycle; triage mức mới", () => {
  const { context } = commanderView();
  const verify = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-0243",
    mode: "verify",
  });
  assert.ok(verify.ok);
  assert.equal(verify.plan.permission, "sos_verify");
  const verifiedAgain = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-0242",
    mode: "verify",
  });
  assert.equal(verifiedAgain.ok, false);
  const rescueUnverified = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-0243",
    mode: "rescue",
    teamId: "CH-01",
  });
  assert.equal(rescueUnverified.ok, false);
  const samePriority = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-0241",
    mode: "priority",
    priority: "P1 — Khẩn cấp",
  });
  assert.equal(samePriority.ok, false);
  const triage = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-0241",
    mode: "priority",
    priority: "P2 — Cao",
  });
  assert.ok(triage.ok);
  assert.equal(triage.plan.permission, "sos_triage");
});

/* --- Authorization giống hệt boundary (cùng resource context với provider) --- */

test("commander được phép; công dân/vai trò hạn chế bị từ chối đúng resource", () => {
  const snapshot = source();
  const resources = createOperationalResourceContext(() => snapshot);
  const commander = account("Trần Quốc Thuận");
  for (const [permission, resource] of [
    ["create", { type: "Incident", id: "new", geographicScope: "Tây Hồ" }],
    ["task_create", resources.incident("INC-0241")],
    ["dispatch", resources.incident("INC-0241")],
    ["team_assign", resources.team("CH-01")],
    ["sos_verify", resources.sos("SOS-0243")],
  ] as const) {
    assert.equal(
      authorizeResources(commander, {
        permission,
        resources: [resource as never],
      }).allowed,
      true,
      permission,
    );
  }
  const citizen = {
    ...commander,
    id: "USR-CITIZEN-TEST",
    role: "citizen" as const,
  };
  assert.equal(
    authorizeResources(citizen, {
      permission: "create",
      resources: [{ type: "Incident", id: "new", geographicScope: "Tây Hồ" }],
    }).allowed,
    false,
  );
  assert.equal(
    authorizeResources(citizen, {
      permission: "sos_verify",
      resources: [resources.sos("SOS-0243")],
    }).allowed,
    false,
  );
});

test("geographic/ownership denial: warehouse staff không dispatch được; rescue_member không ack được", () => {
  const snapshot = source();
  const resources = createOperationalResourceContext(() => snapshot);
  const warehouseStaff = account("Nguyễn Nam Anh");
  assert.equal(
    authorizeResources(warehouseStaff, {
      permission: "dispatch",
      resources: [resources.incident("INC-0241"), resources.team("CH-01")],
    }).allowed,
    false,
  );
  const rescueMember = account("Lê Nguyễn Minh Trí");
  const view = createAuthorizedOperationalView(rescueMember, snapshot);
  const alerts = deriveAuthorizedAlerts(rescueMember, view);
  const pending = alerts.filter(
    (alert) => alert.requiresAcknowledgement && !alert.acknowledgedAt,
  )[0];
  if (pending) {
    assert.equal(
      authorizeResources(rescueMember, {
        permission: "alert_acknowledge",
        resources: [
          {
            type: "OperationalAlert",
            id: pending.key,
            geographicScope: pending.geographicScope,
            assignedTeamId: pending.ownerTeamId ?? null,
          },
        ],
      }).allowed,
      false,
    );
  }
  const localOfficer = account("Phạm Văn Đam");
  assert.equal(
    authorizeResources(localOfficer, {
      permission: "sos_verify",
      resources: [resources.sos("SOS-0241")],
    }).allowed,
    false,
    "SOS-0241 ngoài địa bàn Tây Hồ",
  );
});

/* --- Mutation boundary: commit/rollback/projection --- */

test("Tạo sự cố qua boundary commit 1 lần và projection Command Center cập nhật", () => {
  const h = harness();
  const summaryBefore = getSituationSummary(h.state().snapshot);
  const plan = buildCreateIncidentPlan({
    confirmed: true,
    title: "Ngập cục bộ ngõ 124 Âu Cơ",
    type: "Ngập đô thị",
    severity: "Trung bình",
    area: "Tứ Liên, Tây Hồ, Hà Nội",
    description: "Mưa lớn kéo dài",
  });
  assert.ok(plan.ok);
  h.execute(() => {
    const incident = createIncidentEntity(
      "INC-0245",
      plan.plan.kind === "create_incident" ? plan.plan.input : ({} as never),
      "Trần Quốc Thuận",
      NOW,
    );
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: [incident, ...snapshot.incidents],
    }));
  });
  assert.equal(h.commits(), 1);
  const summaryAfter = getSituationSummary(h.state().snapshot);
  assert.ok(
    JSON.stringify(summaryAfter) !== JSON.stringify(summaryBefore),
    "Situation Summary phải thay đổi khi canonical incidents thay đổi",
  );
  const incidentIds = h.state().snapshot.incidents.map((item) => item.id);
  assert.equal(incidentIds[0], "INC-0245");
});

test("rollback atomic: lỗi giữa chuỗi mutation không để lại state nửa vờii", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) =>
        applyDispatch(snapshot, "INC-0241", "CH-05"),
      );
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        incidents: snapshot.incidents.map((item) =>
          item.id === "INC-0241" ? { ...item, assignedTeamId: "CH-99" } : item,
        ),
      }));
      throw new Error("Team update failed");
    }),
  );
  assert.deepEqual(h.state(), before);
  assert.equal(h.commits(), 0);
});

test("dispatch + thu hồi lưu thông nhất: projection đội sẵn sàng thay đổi theo canonical", () => {
  const h = harness();
  const { context } = commanderView();
  assert.deepEqual(dispatchableTeams(context), []);
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => {
      const task = snapshot.tasks.find((item) => item.id === "TSK-0243")!;
      const released = releaseTaskAssignment(task, NOW);
      const tasks = snapshot.tasks.map((item) =>
        item.id === task.id ? released : item,
      );
      const teams = snapshot.teams.map((team) =>
        team.id === "CH-03"
          ? recalculateTeamAssignment(team, tasks, NOW)
          : team,
      );
      return { ...snapshot, tasks, teams };
    });
  });
  assert.equal(h.commits(), 1);
  const contextAfterRecall: CommandCenterActionContext = {
    incidents: h.state().snapshot.incidents,
    teams: h.state().snapshot.teams,
    sosRequests: h.state().snapshot.sosRequests,
    alerts: [],
    tasks: h.state().snapshot.tasks,
  };
  assert.ok(
    dispatchableTeams(contextAfterRecall).some((item) => item.id === "CH-03"),
  );
  const releasedTask = h
    .state()
    .snapshot.tasks.find((item) => item.id === "TSK-0243")!;
  assert.equal(releasedTask.teamId, "");
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) =>
      applyDispatch(snapshot, "INC-0234", "CH-03"),
    );
  });
  assert.equal(h.commits(), 2);
  const contextAfterDispatch: CommandCenterActionContext = {
    ...contextAfterRecall,
    incidents: h.state().snapshot.incidents,
    teams: h.state().snapshot.teams,
  };
  assert.ok(
    !dispatchableTeams(contextAfterDispatch).some((item) => item.id === "CH-03"),
  );
  const incident = h
    .state()
    .snapshot.incidents.find((item) => item.id === "INC-0234")!;
  assert.equal(incident.assignedTeamId, "CH-03");
  assert.equal(incident.status, "Đang điều phối");
});

test("Xử lý SOS qua boundary: verify/triage cập nhật candidates và queue từ canonical", () => {
  const h = harness();
  const beforePlan = buildSosTriagePlan(
    {
      incidents: h.state().snapshot.incidents,
      teams: h.state().snapshot.teams,
      sosRequests: h.state().snapshot.sosRequests,
      alerts: [],
    },
    { confirmed: true, sosId: "SOS-0243", mode: "verify" },
  );
  assert.ok(beforePlan.ok);
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === "SOS-0243" ? verifySos(item, NOW) : item,
      ),
    }));
  });
  const sos = h
    .state()
    .snapshot.sosRequests.find((item) => item.id === "SOS-0243")!;
  assert.equal(sos.verificationStatus, "Đã xác minh");
  const again = buildSosTriagePlan(
    {
      incidents: [],
      teams: [],
      sosRequests: h.state().snapshot.sosRequests,
      alerts: [],
    },
    { confirmed: true, sosId: "SOS-0243", mode: "verify" },
  );
  assert.equal(again.ok, false, "không thể verify lần hai — lifecycle re-check");
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === "SOS-0243" ? retriageSos(item, NOW, "P2 — Cao") : item,
      ),
    }));
  });
  const queue = getCommandCenterActionQueue(h.state().snapshot);
  const sosItem = queue.find((item) => item.id === "SOS-0243");
  assert.ok(sosItem);
  assert.equal(sosItem?.priority, "P2 — Cao");
});

test("Xác nhận cảnh báo qua boundary: alert tự hết trạng thái chờ nhờ canonical derivation", () => {
  const h = harness();
  const commander = account("Trần Quốc Thuận");
  const beforeAlerts = deriveAuthorizedAlerts(
    commander,
    createAuthorizedOperationalView(commander, h.state().snapshot),
  );
  const target = beforeAlerts.find(
    (alert) => alert.key === "shelter:Shelter:TH-03:shelter_overloaded",
  )!;
  assert.equal(target.acknowledgedAt, null);
  h.execute(() => {
    const outcome = acknowledgeOperationalAlert(
      h.state().snapshot.alertInteractions,
      target,
      { id: commander.id, name: commander.displayName },
      NOW,
    );
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      alertInteractions: outcome.interactions,
      alertEvents: [outcome.event, ...snapshot.alertEvents],
    }));
  });
  assert.equal(h.commits(), 1);
  const afterAlerts = deriveAuthorizedAlerts(
    commander,
    createAuthorizedOperationalView(commander, h.state().snapshot),
  );
  const updated = afterAlerts.find((alert) => alert.key === target.key)!;
  assert.equal(updated.status, "Đã xác nhận");
  assert.equal(updated.acknowledgedBy, commander.displayName);
  const stillPending = acknowledgeableAlerts({
    incidents: [],
    teams: [],
    sosRequests: [],
    alerts: afterAlerts,
  });
  assert.ok(!stillPending.some((alert) => alert.key === target.key));
});

test("Simulation compatibility: tick sau khi đã tạo sự cố mới vẫn deterministic", () => {
  const h = harness();
  h.execute(() => {
    const incident = createIncidentEntity(
      "INC-0246",
      {
        title: "Ngập sâu khu vực Nhật Tân",
        type: "Ngập đô thị",
        severity: "Cao",
        location: { name: "Nhật Tân, Tây Hồ", coordinates: [105.85, 21.06] },
        description: "",
      },
      "Trần Quốc Thuận",
      NOW,
    );
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      incidents: [incident, ...snapshot.incidents],
    }));
  });
  const next = applyNextSimulationTick(h.state().control, h.state().snapshot);
  assert.ok(next);
  const created = next.snapshot.incidents.find(
    (item) => item.id === "INC-0246",
  );
  assert.ok(created, "sự cố vừa tạo vẫn tồn tại sau tick mô phỏng");
  assert.ok(next.simulation.tick > 0);
});

/* --- Kiến trúc: không dataset/state song song --- */

test("command-center action layer không import state/infrastructure và không tạo store/context", () => {
  const sourceText = readFileSync(
    "src/application/command-center/commandCenterActions.ts",
    "utf-8",
  );
  assert.ok(!sourceText.includes("from \"../../state/"));
  assert.ok(!sourceText.includes("from \"../../infrastructure/"));
  assert.ok(!sourceText.includes("createContext"));
  assert.ok(!sourceText.includes("useState"));
  assert.ok(!sourceText.includes("new Event"));
  const dialog = readFileSync(
    "src/features/command-center/components/ActionDialog.tsx",
    "utf-8",
  );
  assert.ok(!dialog.includes("inMemoryOperationalRepository"));
  assert.ok(!dialog.includes("localStorage"));
  assert.ok(!dialog.includes("createContext"));
});
