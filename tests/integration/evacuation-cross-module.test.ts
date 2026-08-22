import assert from "node:assert/strict";
import test from "node:test";
import {
  transitionEvacuation,
  updateRouteStatus,
} from "../../src/application/evacuations/evacuationUseCases";
import {
  assignTeamToEvacuation,
  releaseTeamFromEvacuation,
} from "../../src/application/teams/teamUseCases";
import {
  filterAndSortEvacuations,
  getEvacuationView,
  summarizeEvacuations,
  type EvacuationFilters,
} from "../../src/application/evacuations/evacuationQueries";
import { deriveOperationalAlerts } from "../../src/domain/alerts/rules";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import type { OperationalSnapshot } from "../../src/application/operations/operationalSnapshot";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const account = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const commander = () => account("Trần Quốc Thuận");
const authorized = (snapshot: OperationalSnapshot) =>
  createAuthorizedOperationalView(commander(), snapshot);

const baseFilters: EvacuationFilters = {
  search: "",
  status: "Tất cả trạng thái",
  priority: "Tất cả ưu tiên",
  route: "Tất cả tuyến",
  progress: "Tất cả tiến độ",
  sort: "Ưu tiên điều hành",
};

test("mutation canonical qua use case làm cảnh báo sơ tán xuất hiện rồi tự hết hiệu lực", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const baseline = deriveOperationalAlerts(snapshot).filter(
    (alert) => alert.source.type === "Evacuation",
  );
  assert.deepEqual(
    baseline.map((alert) => alert.key),
    ["evacuation:Evacuation:EVAC-002:evacuation_blocked_or_paused"],
  );

  const blockedSnapshot: OperationalSnapshot = {
    ...snapshot,
    evacuationOperations: snapshot.evacuationOperations.map((operation) =>
      operation.id === "EVAC-001"
        ? updateRouteStatus(operation, "Bị chặn", "21/08/2026 10:50")
        : operation,
    ),
  };
  const running = blockedSnapshot.evacuationOperations.find(
    (operation) => operation.id === "EVAC-001",
  )!;
  assert.equal(running.status, "Tạm dừng");
  const blockedAlerts = deriveOperationalAlerts(blockedSnapshot).filter(
    (alert) => alert.source.type === "Evacuation",
  );
  assert.ok(
    blockedAlerts.some(
      (alert) =>
        alert.key ===
          "evacuation:Evacuation:EVAC-001:evacuation_blocked_or_paused" &&
        alert.source.path === "/evacuations/EVAC-001" &&
        alert.severity === "high",
    ),
  );

  const restoredSnapshot: OperationalSnapshot = {
    ...blockedSnapshot,
    evacuationOperations: blockedSnapshot.evacuationOperations.map(
      (operation) => {
        if (operation.id !== "EVAC-001") return operation;
        const alternative = updateRouteStatus(
          operation,
          "Đang dùng tuyến thay thế",
          "21/08/2026 10:55",
        );
        return transitionEvacuation(
          alternative,
          "Đang triển khai",
          "21/08/2026 10:56",
        );
      },
    ),
  };
  const restoredAlerts = deriveOperationalAlerts(restoredSnapshot)
    .filter((alert) => alert.source.type === "Evacuation")
    .map((alert) => alert.key);
  assert.ok(
    !restoredAlerts.includes(
      "evacuation:Evacuation:EVAC-001:evacuation_blocked_or_paused",
    ),
  );
  assert.deepEqual(restoredAlerts, [
    "evacuation:Evacuation:EVAC-002:evacuation_blocked_or_paused",
  ]);
});

test("worklist đọc lại authoritative view sau thay đổi canonical: hoàn thành không bị xếp nhóm cần can thiệp", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const completed: OperationalSnapshot = {
    ...snapshot,
    evacuationOperations: snapshot.evacuationOperations.map((operation) =>
      operation.id === "EVAC-002"
        ? {
            ...transitionEvacuation(
              { ...operation, status: "Đang triển khai" as const },
              "Hoàn thành",
              "21/08/2026 11:00",
            ),
            assignedTeamId: null,
          }
        : operation,
    ),
  };
  const view = authorized(completed);
  const evac002 = view.evacuationOperations.find(
    (operation) => operation.id === "EVAC-002",
  )!;
  assert.equal(evac002.status, "Hoàn thành");
  assert.equal(evac002.progress, 100);
  const summary = summarizeEvacuations(view.evacuationOperations);
  assert.equal(summary.active, 2);
  assert.equal(summary.delayed, 0);
  const rows = filterAndSortEvacuations(view.evacuationOperations, baseFilters);
  assert.equal(rows[rows.length - 1].id, "EVAC-002");
  const alerts = deriveOperationalAlerts(view).map((alert) => alert.key);
  assert.ok(
    !alerts.includes(
      "evacuation:Evacuation:EVAC-002:evacuation_blocked_or_paused",
    ),
  );
});

test("đổi đội phụ trách đồng bộ hai phía operation/team theo application contracts", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const operation = snapshot.evacuationOperations.find(
    (item) => item.id === "EVAC-002",
  )!;
  const team = snapshot.teams.find((item) => item.id === "YT-01")!;
  const assignedTeam = assignTeamToEvacuation(
    team,
    operation.id,
    operation.incidentId,
    "21/08/2026 10:52",
  );
  assert.equal(assignedTeam.currentEvacuationOperation, "EVAC-002");
  const released = releaseTeamFromEvacuation(
    assignedTeam,
    "21/08/2026 11:30",
  );
  assert.equal(released.currentEvacuationOperation, null);
});

test("authorized view loại hoạt động khi thực thể liên kết ngoài phạm vi địa bàn", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const localOfficer = account("Phạm Văn Đam");
  const view = createAuthorizedOperationalView(localOfficer, snapshot);
  assert.equal(view.evacuationOperations.length, 0);
  assert.equal(view.evacuationEvents.length, 0);
  assert.equal(
    getEvacuationView(view.evacuationOperations, "EVAC-002", {
      incidents: view.incidents,
      shelters: view.shelters,
      teams: view.teams,
    }),
    undefined,
  );
});
