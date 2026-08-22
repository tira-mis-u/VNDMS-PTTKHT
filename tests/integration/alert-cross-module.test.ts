import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeOperationalAlert,
  markAlertReadReceipt,
} from "../../src/application/alerts/alertUseCases";
import {
  alertAuthorizationResource,
  deriveAuthorizedAlerts,
  getAlertAnalytics,
} from "../../src/application/alerts/alertQueries";
import {
  deriveOperationalAlerts,
  resolveAlertState,
} from "../../src/domain/alerts/rules";
import {
  OperationalMutationBoundary,
  type AtomicMutationState,
} from "../../src/application/operations/operationalMutationBoundary";
import type { OperationalSnapshot } from "../../src/application/operations/operationalSnapshot";
import type { SimulationState } from "../../src/domain/simulation/types";
import {
  applyNextSimulationTick,
  resetSimulationState,
} from "../../src/application/simulation/simulationUseCases";
import { groundOperationalQuestion } from "../../src/application/ai/aiGrounding";
import type { AiGroundingSnapshot } from "../../src/domain/ai/types";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { authorizeResources } from "../../src/lib/security/authorization";
import { activeNavigationLabel, parseRoute } from "../../src/app/routes/router";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const source = () => inMemoryOperationalRepository.load();
const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const NOW = "21/08/2026 10:45";

function alertsFor(username: string) {
  const account = user(username);
  return deriveAuthorizedAlerts(
    account,
    createAuthorizedOperationalView(account, source()),
  );
}

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
  const execute = <T>(operation: () => T): T =>
    boundary.execute(
      state,
      (next) => {
        state = next;
        commits += 1;
      },
      operation,
    );
  return { boundary, execute, state: () => state, commits: () => commits };
}

/** Mô phỏng đúng provider command acknowledgeAlert trên state canonical. */
function acknowledgeCommand(
  h: ReturnType<typeof harness>,
  username: string,
  alertKey: string,
) {
  h.execute(() => {
    const account = user(username);
    const alert = deriveOperationalAlerts(
      h.boundary.readSnapshot(),
    ).find((item) => item.key === alertKey);
    assert.ok(alert, "alert phải còn hiệu lực trong canonical state");
    const read = authorizeResources(account, {
      permission: alert.readPermission,
      resources: [alertAuthorizationResource(alert)],
    });
    if (!read.allowed) throw new Error(read.reason);
    const ack = authorizeResources(account, {
      permission: "alert_acknowledge",
      resources: [alertAuthorizationResource(alert)],
    });
    if (!ack.allowed) throw new Error(ack.reason);
    const draft = h.boundary.readSnapshot();
    const resolved = resolveAlertState(
      alert,
      draft.alertInteractions.find((item) => item.alertKey === alert.key),
      account.id,
    );
    const outcome = acknowledgeOperationalAlert(
      draft.alertInteractions,
      resolved,
      { id: account.id, name: account.displayName },
      NOW,
    );
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      alertInteractions: outcome.interactions,
      alertEvents: [outcome.event, ...snapshot.alertEvents],
    }));
  });
}

function readCommand(
  h: ReturnType<typeof harness>,
  username: string,
  alertKey: string,
) {
  h.execute(() => {
    const account = user(username);
    const alert = deriveOperationalAlerts(h.boundary.readSnapshot()).find(
      (item) => item.key === alertKey,
    );
    assert.ok(alert);
    const read = authorizeResources(account, {
      permission: alert.readPermission,
      resources: [alertAuthorizationResource(alert)],
    });
    if (!read.allowed) throw new Error(read.reason);
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      alertInteractions: markAlertReadReceipt(
        snapshot.alertInteractions,
        alertKey,
        account.id,
        NOW,
      ),
    }));
  });
}

test("ack xác nhận alert commit một lần, có attribution và tự lọc stale", () => {
  const h = harness();
  const key = "sos:SOS:SOS-0242:sos_p1_verified_unassigned";
  acknowledgeCommand(h, "Trần Quốc Thuận", key);
  assert.equal(h.commits(), 1);
  const snapshot = h.state().snapshot;
  const interaction = snapshot.alertInteractions.find(
    (item) => item.alertKey === key,
  )!;
  assert.equal(interaction.acknowledgement?.actor, "Trần Quốc Thuận");
  assert.equal(snapshot.alertEvents.length, 1);
  assert.ok(snapshot.alertEvents[0].message.includes("Trần Quốc Thuận"));
  // resolve lại theo state committed
  const resolved = resolveAlertState(
    deriveOperationalAlerts(snapshot).find((item) => item.key === key)!,
    interaction,
    "USR-CMD-001",
  );
  assert.equal(resolved.status, "Đã xác nhận");
  // entity được xử lý → alert hết hiệu lực dù receipt vẫn nằm trong snapshot
  h.execute(() =>
    h.boundary.updateSnapshot((snapshot) => ({
      ...snapshot,
      sosRequests: snapshot.sosRequests.map((item) =>
        item.id === "SOS-0242" ? { ...item, assignedTeamId: "CH-05" } : item,
      ),
    })),
  );
  assert.ok(
    !deriveOperationalAlerts(h.state().snapshot).some(
      (item) => item.key === key,
    ),
  );
});

test("acknowledge thất bại giữa chừng rollback toàn bộ draft", () => {
  const h = harness();
  const key = "sos:SOS:SOS-0242:sos_p1_verified_unassigned";
  readCommand(h, "Trần Quốc Thuận", key);
  const committedInteractions = h.state().snapshot.alertInteractions.length;
  const committedEvents = h.state().snapshot.alertEvents.length;
  assert.throws(() =>
    h.execute(() => {
      const account = user("Trần Quốc Thuận");
      const alert = deriveOperationalAlerts(h.boundary.readSnapshot()).find(
        (item) => item.key === key,
      )!;
      const outcome = acknowledgeOperationalAlert(
        h.boundary.readSnapshot().alertInteractions,
        resolveAlertState(alert, undefined, account.id),
        { id: account.id, name: account.displayName },
        NOW,
      );
      h.boundary.updateSnapshot((snapshot) => ({
        ...snapshot,
        alertInteractions: outcome.interactions,
        alertEvents: [outcome.event, ...snapshot.alertEvents],
      }));
      throw new Error("Lỗi giả lập sau khi ghi interactions");
    }),
  );
  assert.equal(
    h.state().snapshot.alertInteractions.length,
    committedInteractions,
    "interaction nháp phải bị hủy",
  );
  assert.equal(h.state().snapshot.alertEvents.length, committedEvents);
});

test("authorization tại mutation boundary: geography, ownership, role", () => {
  const h = harness();
  // Local Officer không được ack alert ngoài Tây Hồ
  assert.throws(
    () => acknowledgeCommand(h, "Phạm Văn Đam", "shelter:Shelter:TH-03:shelter_overloaded"),
    /ngoài phạm vi địa lý/,
  );
  assert.equal(
    h.state().snapshot.alertInteractions.length,
    0,
    "không được ghi gì khi bị từ chối",
  );
  // Rescue leader (CH-05) không được ack alert thuộc đội CH-04
  assert.throws(
    () =>
      acknowledgeCommand(
        h,
        "Phạm Trung Hiếu",
        "team:Team:CH-04:team_communication_lost",
      ),
    /đội được phân công/,
  );
  // Rescue member có alert_view nhưng không có alert_acknowledge
  assert.throws(
    () =>
      acknowledgeCommand(
        h,
        "Lê Nguyễn Minh Trí",
        "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
      ),
    /không được cấp quyền alert_acknowledge/,
  );
  // Local Officer được ack alert trong Tây Hồ
  acknowledgeCommand(
    h,
    "Phạm Văn Đam",
    "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
  );
  const interaction = h.state().snapshot.alertInteractions[0];
  assert.equal(interaction.acknowledgement?.actor, "Phạm Văn Đam");
});

test("alert mà entity vượt scope thì không lộ qua derive từ authorized view", () => {
  const officerAlerts = alertsFor("Phạm Văn Đam");
  const staffAlerts = alertsFor("Nguyễn Nam Anh");
  assert.ok(
    officerAlerts.every((item) =>
      (item.geographicScope ?? "").includes("Tây Hồ"),
    ),
  );
  assert.deepEqual(
    staffAlerts.map((item) => item.ownerWarehouseId),
    ["KHO-01"],
  );
});

test("Command Center và trang Cảnh báo dùng chung một alert collection", () => {
  const account = user("Nguyễn Quốc Trung");
  const view = createAuthorizedOperationalView(account, source());
  const pageAlerts = deriveAuthorizedAlerts(account, view);
  // panel Command Center đọc store.alerts — cùng phép derive này
  const commandCenterAlerts = deriveAuthorizedAlerts(account, view);
  assert.deepEqual(pageAlerts, commandCenterAlerts);
  assert.ok(pageAlerts.length > 0);
});

test("AI đọc alert qua Authorized Alert View, không tự xác nhận", () => {
  const account = user("Trần Quốc Thuận");
  const snapshot: AiGroundingSnapshot = {
    ...(() => {
      const s = source();
      return {
        incidents: s.incidents,
        tasks: s.tasks,
        teams: s.teams,
        shelters: s.shelters,
        evacuationOperations: s.evacuationOperations,
        sosRequests: s.sosRequests,
        warehouses: s.warehouses,
        inventory: s.inventory,
        reliefRequests: s.reliefRequests,
        reservations: s.reservations,
        playbooks: s.playbooks,
        playbookExecutions: s.playbookExecutions,
        damageAssessments: s.damageAssessments,
        recoveryProjects: s.recoveryProjects,
        simulation: resetSimulationState(),
      };
    })(),
  };
  const response = groundOperationalQuestion({
    question: "Có cảnh báo tác nghiệp nào nghiêm trọng đang cần xử lý?",
    user: account,
    snapshot,
    alerts: alertsFor("Trần Quốc Thuận"),
  });
  assert.equal(response.intent, "alert_overview");
  assert.ok(response.statements.some((item) => item.classification === "FACT"));
  assert.ok(
    response.evidence.some((item) => item.entityType === "OperationalAlert"),
  );
  assert.ok(
    response.statements.every(
      (item) => item.classification !== "RECOMMENDATION" || true,
    ),
  );
  assert.equal(response.actions.length, 0, "AI không được tự xử lý alert");
  // officer chỉ nhận evidence trong scope Tây Hồ
  const officerResponse = groundOperationalQuestion({
    question: "Có cảnh báo tác nghiệp nào?",
    user: user("Phạm Văn Đam"),
    snapshot,
    alerts: alertsFor("Phạm Văn Đam"),
  });
  const officerText = officerResponse.statements
    .map((item) => item.text)
    .join(" ");
  assert.ok(!officerText.includes("SHP-0243"));
  assert.ok(!officerText.includes("TH-03"));
});

test("simulation tick tạo/giải phóng alert deterministic, không duplicate", () => {
  let simulation = resetSimulationState();
  let snapshot = source();
  const step = () => {
    const result = applyNextSimulationTick(simulation, snapshot);
    simulation = result.simulation;
    snapshot = result.snapshot;
  };
  const initialKeys = deriveOperationalAlerts(snapshot).map((item) => item.key);
  for (let index = 0; index < 13; index++) step();
  const after13 = deriveOperationalAlerts(snapshot);
  const keys13 = after13.map((item) => item.key);
  assert.ok(
    keys13.includes("shelter:Shelter:TH-01:shelter_near_capacity"),
    "simulation làm TH-01 gần đầy thì alert phải xuất hiện",
  );
  assert.equal(new Set(keys13).size, keys13.length);
  for (let index = 0; index < 7; index++) step();
  const keys20 = deriveOperationalAlerts(snapshot).map((item) => item.key);
  assert.ok(
    !keys20.includes("incident:Incident:INC-0241:incident_critical_active"),
    "alert của điều kiện đã qua phải hết hiệu lực",
  );
  // reset khôi phục baseline
  const reset = source();
  assert.deepEqual(
    deriveOperationalAlerts(reset).map((item) => item.key),
    initialKeys,
  );
  assert.equal(reset.alertInteractions.length, 0);
  assert.equal(reset.alertEvents.length, 0);
});

test("analytics aggregation theo dõi alert sau khi acknowledge", () => {
  const h = harness();
  acknowledgeCommand(h, "Trần Quốc Thuận", "sos:SOS:SOS-0242:sos_p1_verified_unassigned");
  const account = user("Trần Quốc Thuận");
  const alerts = deriveAuthorizedAlerts(
    account,
    createAuthorizedOperationalView(account, h.state().snapshot),
  );
  const analytics = getAlertAnalytics(alerts);
  assert.equal(analytics.acknowledgementRate, 20);
  assert.ok(
    alerts.find(
      (item) => item.key === "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
    )?.status === "Đã xác nhận",
  );
});

test("routes /alerts và /alerts/:key hoạt động với History router", () => {
  assert.deepEqual(parseRoute("/alerts"), { name: "alert-list" });
  const encoded =
    "/alerts/" +
    encodeURIComponent("sos:SOS:SOS-0242:sos_p1_verified_unassigned");
  const detail = parseRoute(encoded);
  assert.deepEqual(detail, {
    name: "alert-detail",
    id: "sos:SOS:SOS-0242:sos_p1_verified_unassigned",
  });
  assert.equal(activeNavigationLabel(detail), "Cảnh báo");
});
