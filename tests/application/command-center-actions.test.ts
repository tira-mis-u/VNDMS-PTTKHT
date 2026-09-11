/*
 * V2 (4 vai) — hành động Command Center.
 *  - Actor mặc định là Cán bộ PCTT (nguyentrung): admin V2 KHÔNG còn quyền tạo sự cố,
 *    điều phối, xác minh SOS; test quyền kiểm cả admin bị từ chối.
 *  - Bỏ test Simulation (module đã xóa) và mọi ID kịch bản cũ → dùng kịch bản Yagi 2024.
 *  - Test "warehouse staff / rescue_member" → tài khoản đó nay là công dân (namanh, minhtri).
 */
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
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";
import { readFileSync } from "node:fs";

type Control = Record<string, never>;
const NOW = "10/09/2024 14:55";
const source = () => inMemoryOperationalRepository.load();
const account = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
/** Cán bộ PCTT — vai duy nhất giữ quyền tạo sự cố/điều phối/xác minh trong V2. */
const commanderView = () => {
  const commander = account("nguyentrung");
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
  const boundary = new OperationalMutationBoundary<OperationalSnapshot, Control>();
  let state: AtomicMutationState<OperationalSnapshot, Control> = {
    snapshot: source(),
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

test("selectors đọc authorized view: seed Yagi không có đội sẵn sàng/thu hồi được; sự cố mở & SOS còn vòng đời", () => {
  const { context } = commanderView();
  assert.deepEqual(dispatchableTeams(context), []);
  assert.deepEqual(recallableTeams(context), [], "mọi đội đang giữ nhiệm vụ 'Đang thực hiện' → không thu hồi theo lifecycle");
  assert.deepEqual(
    openIncidents(context).map((item) => item.id),
    ["INC-YAGI-01", "INC-YAGI-02", "INC-YAGI-03", "INC-YAGI-04", "INC-YAGI-05", "INC-YAGI-06", "INC-YAGI-07"],
  );
  assert.ok(acknowledgeableAlerts(context).length >= 5);
  assert.deepEqual(
    triageableSos(context).map((item) => item.id),
    ["SOS-YAGI-02", "SOS-YAGI-01", "SOS-YAGI-03", "SOS-YAGI-04"],
    "SOS-YAGI-05 đã đóng không còn triage được",
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
      incidentId: "INC-YAGI-01",
      title: "X",
      type: "Cứu hộ",
      priority: "Cao",
      teamId: "",
      dueAt: "10/09/2024 18:00",
      description: "",
    }).ok,
    false,
  );
  assert.equal(
    buildAcknowledgeAlertPlan(context, {
      confirmed: false,
      alertKey: "shelter:Shelter:SHELTER-HN-03:shelter_overloaded",
    }).ok,
    false,
  );
  assert.equal(
    buildDispatchTeamPlan(context, {
      confirmed: false,
      incidentId: "INC-YAGI-01",
      teamId: "CH-LC-01",
    }).ok,
    false,
  );
  assert.equal(
    buildRecallTeamPlan(context, { confirmed: false, teamId: "CH-LC-01" }).ok,
    false,
  );
  assert.equal(
    buildSosTriagePlan(context, {
      confirmed: false,
      sosId: "SOS-YAGI-04",
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
    incidentId: "INC-YAGI-01",
    title: "Tìm kiếm nạn nhân mất tích tại Làng Nủ",
    type: "Cứu hộ",
    priority: "Cao",
    teamId: "",
    dueAt: "10/09/2024 20:00",
    description: "",
  });
  assert.ok(plan.ok);
  assert.equal(plan.plan.kind, "create_task");
  assert.equal(plan.plan.permission, "task_create");
  const closed = buildCreateTaskPlan(context, {
    confirmed: true,
    incidentId: "INC-YAGI-07",
    title: "X",
    type: "Cứu hộ",
    priority: "Cao",
    teamId: "",
    dueAt: "10/09/2024 20:00",
    description: "",
  });
  assert.equal(closed.ok, true, "INC-YAGI-07 Đã kiểm soát vẫn còn mở");
  const taskOnClosed = buildCreateTaskPlan(
    {
      ...context,
      incidents: context.incidents.map((item) =>
        item.id === "INC-YAGI-02" ? { ...item, status: "Đã đóng" as const } : item,
      ),
    },
    {
      confirmed: true,
      incidentId: "INC-YAGI-02",
      title: "X",
      type: "Cứu hộ",
      priority: "Cao",
      teamId: "",
      dueAt: "10/09/2024 20:00",
      description: "",
    },
  );
  assert.equal(taskOnClosed.ok, false);
  const ghostTeam = buildCreateTaskPlan(context, {
    confirmed: true,
    incidentId: "INC-YAGI-01",
    title: "X",
    type: "Cứu hộ",
    priority: "Cao",
    teamId: "CH-99",
    dueAt: "10/09/2024 20:00",
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

test("Điều phối đội: dispatch bị chặn khi đội bận; thu hồi theo lifecycle rồi dispatch hợp lệ", () => {
  const { context } = commanderView();
  const blocked = buildDispatchTeamPlan(context, {
    confirmed: true,
    incidentId: "INC-YAGI-01",
    teamId: "CH-LC-01",
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.ok ? "" : blocked.error, /không sẵn sàng/);
  const recallRunning = buildRecallTeamPlan(context, {
    confirmed: true,
    teamId: "CH-LC-01",
  });
  assert.equal(
    recallRunning.ok,
    false,
    "TSK-YAGI-01 đang thực hiện — không thể thu hồi theo lifecycle",
  );
  const noTask = buildRecallTeamPlan(context, {
    confirmed: true,
    teamId: "CH-QN-01",
  });
  assert.equal(noTask.ok, false);
  // Đưa TSK-YAGI-06 về "Đã giao" (chưa bắt đầu) → CH-YB-01 thu hồi được theo lifecycle.
  const assignedContext: CommandCenterActionContext = {
    ...context,
    tasks: context.tasks!.map((task) =>
      task.id === "TSK-YAGI-06" ? { ...task, status: "Đã giao" as const } : task,
    ),
  };
  const recallPlan = buildRecallTeamPlan(assignedContext, {
    confirmed: true,
    teamId: "CH-YB-01",
  });
  assert.ok(recallPlan.ok);
  assert.equal(recallPlan.plan.permission, "team_assign");
  const task = assignedContext.tasks!.find((item) => item.id === "TSK-YAGI-06")!;
  const released = releaseTaskAssignment(task, NOW);
  const tasks = assignedContext.tasks!.map((item) => (item.id === task.id ? released : item));
  const teams = context.teams.map((team) =>
    team.id === "CH-YB-01" ? recalculateTeamAssignment(team, tasks, NOW) : team,
  );
  const nextContext: CommandCenterActionContext = { ...context, teams, tasks };
  assert.ok(dispatchableTeams(nextContext).some((item) => item.id === "CH-YB-01"));
  const dispatchPlan = buildDispatchTeamPlan(nextContext, {
    confirmed: true,
    incidentId: "INC-YAGI-05",
    teamId: "CH-YB-01",
  });
  assert.ok(dispatchPlan.ok);
  assert.equal(dispatchPlan.plan.permission, "dispatch");
});

test("Xử lý SOS: verify SOS chưa xác minh; điều đội theo lifecycle; triage mức mới", () => {
  const { context } = commanderView();
  const verify = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-YAGI-04",
    mode: "verify",
  });
  assert.ok(verify.ok);
  assert.equal(verify.plan.permission, "sos_verify");
  const verifiedAgain = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-YAGI-02",
    mode: "verify",
  });
  assert.equal(verifiedAgain.ok, false);
  const rescueUnverified = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-YAGI-04",
    mode: "rescue",
    teamId: "CH-LC-01",
  });
  assert.equal(rescueUnverified.ok, false);
  const samePriority = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-YAGI-01",
    mode: "priority",
    priority: "P1 — Khẩn cấp",
  });
  assert.equal(samePriority.ok, false);
  const triage = buildSosTriagePlan(context, {
    confirmed: true,
    sosId: "SOS-YAGI-01",
    mode: "priority",
    priority: "P2 — Cao",
  });
  assert.ok(triage.ok);
  assert.equal(triage.plan.permission, "sos_triage");
});

/* --- Authorization giống hệt boundary (cùng resource context với provider) --- */

test("cán bộ PCTT và Quản trị viên được phép; công dân bị từ chối đúng resource", () => {
  const snapshot = source();
  const resources = createOperationalResourceContext(() => snapshot);
  const officer = account("nguyentrung");
  const admin = account("thuantq");
  for (const [permission, resource] of [
    ["create", { type: "Incident", id: "new", geographicScope: "Lào Cai" }],
    ["task_create", resources.incident("INC-YAGI-01")],
    ["dispatch", resources.incident("INC-YAGI-01")],
    ["team_assign", resources.team("CH-LC-01")],
    ["sos_verify", resources.sos("SOS-YAGI-04")],
  ] as const) {
    assert.equal(
      authorizeResources(officer, { permission, resources: [resource as never] }).allowed,
      true,
      permission,
    );
    assert.equal(
      authorizeResources(admin, { permission, resources: [resource as never] }).allowed,
      true,
      `Quản trị viên phải có ${permission}`,
    );
  }
  const citizen = { ...officer, id: "USR-CITIZEN-TEST", role: "citizen" as const };
  assert.equal(
    authorizeResources(citizen, {
      permission: "create",
      resources: [{ type: "Incident", id: "new", geographicScope: "Lào Cai" }],
    }).allowed,
    false,
  );
  assert.equal(
    authorizeResources(citizen, {
      permission: "sos_verify",
      resources: [resources.sos("SOS-YAGI-04")],
    }).allowed,
    false,
  );
});

test("tài khoản kho/đội viên cũ nay là công dân: không dispatch/ack; công dân khác địa bàn không tạo SOS ngoài phạm vi", () => {
  const snapshot = source();
  const resources = createOperationalResourceContext(() => snapshot);
  const formerWarehouse = account("namanh");
  assert.equal(formerWarehouse.role, "citizen");
  assert.equal(
    authorizeResources(formerWarehouse, {
      permission: "dispatch",
      resources: [resources.incident("INC-YAGI-01"), resources.team("CH-LC-01")],
    }).allowed,
    false,
  );
  const formerMember = account("minhtri");
  assert.equal(formerMember.role, "citizen");
  const view = createAuthorizedOperationalView(formerMember, snapshot);
  assert.deepEqual(view.incidents, [], "công dân không có quyền view sự cố");
  const alerts = deriveAuthorizedAlerts(formerMember, view);
  assert.equal(
    alerts.some((alert) => alert.requiresAcknowledgement && !alert.acknowledgedAt),
    false,
    "công dân không nhận cảnh báo tác nghiệp chờ xác nhận",
  );
  assert.equal(
    authorizeResources(formerMember, {
      permission: "alert_acknowledge",
      resources: [{ type: "OperationalAlert", id: "any", geographicScope: "Hà Nội" }],
    }).allowed,
    false,
  );
  const localCitizen = account("phamdam");
  assert.equal(
    authorizeResources(localCitizen, {
      permission: "sos_verify",
      resources: [resources.sos("SOS-YAGI-01")],
    }).allowed,
    false,
  );
  assert.equal(
    authorizeResources(localCitizen, {
      permission: "sos_create",
      resources: [{ type: "SosRequest", id: "new", geographicScope: "Bảo Yên, Lào Cai" }],
    }).allowed,
    false,
    "công dân Tây Hồ không tạo SOS ngoài địa bàn",
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
      "INC-YAGI-08",
      plan.plan.kind === "create_incident" ? plan.plan.input : ({} as never),
      "Nguyễn Quốc Trung",
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
  assert.equal(incidentIds[0], "INC-YAGI-08");
});

test("rollback atomic: lỗi giữa chuỗi mutation không để lại state nửa vờii", () => {
  const h = harness();
  const before = structuredClone(h.state());
  assert.throws(() =>
    h.execute(() => {
      h.boundary.updateSnapshot((snapshot) =>
        applyDispatch(snapshot, "INC-YAGI-05", "CH-YB-01"),
      );
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        incidents: snapshot.incidents.map((item) =>
          item.id === "INC-YAGI-05" ? { ...item, assignedTeamId: "CH-99" } : item,
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
      // Đưa TSK-YAGI-06 về "Đã giao" rồi gỡ đội theo application contracts.
      const task = { ...snapshot.tasks.find((item) => item.id === "TSK-YAGI-06")!, status: "Đã giao" as const };
      const released = releaseTaskAssignment(task, NOW);
      const tasks = snapshot.tasks.map((item) => (item.id === task.id ? released : item));
      const teams = snapshot.teams.map((team) =>
        team.id === "CH-YB-01" ? recalculateTeamAssignment(team, tasks, NOW) : team,
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
  assert.ok(dispatchableTeams(contextAfterRecall).some((item) => item.id === "CH-YB-01"));
  const releasedTask = h.state().snapshot.tasks.find((item) => item.id === "TSK-YAGI-06")!;
  assert.equal(releasedTask.teamId, "");
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => applyDispatch(snapshot, "INC-YAGI-05", "CH-YB-01"));
  });
  assert.equal(h.commits(), 2);
  const contextAfterDispatch: CommandCenterActionContext = {
    ...contextAfterRecall,
    incidents: h.state().snapshot.incidents,
    teams: h.state().snapshot.teams,
  };
  assert.ok(!dispatchableTeams(contextAfterDispatch).some((item) => item.id === "CH-YB-01"));
  const incident = h.state().snapshot.incidents.find((item) => item.id === "INC-YAGI-05")!;
  assert.equal(incident.assignedTeamId, "CH-YB-01");
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
    { confirmed: true, sosId: "SOS-YAGI-04", mode: "verify" },
  );
  assert.ok(beforePlan.ok);
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === "SOS-YAGI-04" ? verifySos(item, NOW) : item,
      ),
    }));
  });
  const sos = h
    .state()
    .snapshot.sosRequests.find((item) => item.id === "SOS-YAGI-04")!;
  assert.equal(sos.verificationStatus, "Đã xác minh");
  const again = buildSosTriagePlan(
    {
      incidents: [],
      teams: [],
      sosRequests: h.state().snapshot.sosRequests,
      alerts: [],
    },
    { confirmed: true, sosId: "SOS-YAGI-04", mode: "verify" },
  );
  assert.equal(again.ok, false, "không thể verify lần hai — lifecycle re-check");
  h.execute(() => {
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === "SOS-YAGI-04" ? retriageSos(item, NOW, "P2 — Cao") : item,
      ),
    }));
  });
  const queue = getCommandCenterActionQueue(h.state().snapshot);
  const sosItem = queue.find((item) => item.id === "SOS-YAGI-04");
  assert.ok(sosItem);
  assert.equal(sosItem?.priority, "P2 — Cao");
});

test("Xác nhận cảnh báo qua boundary: alert tự hết trạng thái chờ nhờ canonical derivation", () => {
  const h = harness();
  const commander = account("nguyentrung");
  const beforeAlerts = deriveAuthorizedAlerts(
    commander,
    createAuthorizedOperationalView(commander, h.state().snapshot),
  );
  const target = beforeAlerts.find(
    (alert) => alert.key === "shelter:Shelter:SHELTER-HN-03:shelter_overloaded",
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
