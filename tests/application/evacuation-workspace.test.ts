import assert from "node:assert/strict";
import test from "node:test";
import {
  evacuationDetailPath,
  evacuationRecommendations,
  filterAndSortEvacuations,
  getEvacuationPermissions,
  getEvacuationView,
  getLinkedEvacuationAlerts,
  isActiveEvacuation,
  matchesEvacuationFilters,
  sortEvacuations,
  summarizeEvacuations,
  toEvacuationView,
  type EvacuationFilters,
} from "../../src/application/evacuations/evacuationQueries";
import { deriveAuthorizedAlerts } from "../../src/application/alerts/alertQueries";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { authorize } from "../../src/lib/security/authorization";
import type { Permission } from "../../src/lib/permissions/permissions";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const source = () => inMemoryOperationalRepository.load();
const account = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const commanderView = () =>
  createAuthorizedOperationalView(account("Trần Quốc Thuận"), source());
const nationalView = commanderView();
const operations = nationalView.evacuationOperations;

const baseFilters: EvacuationFilters = {
  search: "",
  status: "Tất cả trạng thái",
  priority: "Tất cả ưu tiên",
  route: "Tất cả tuyến",
  progress: "Tất cả tiến độ",
  sort: "Ưu tiên điều hành",
};

const can = (username: string) => {
  const user = account(username);
  return (permission: Permission, resourceScope?: string) =>
    authorize(user, permission, resourceScope).allowed;
};

test("worklist sắp xếp hoạt động trễ/bị chặn lên đầu trong Ưu tiên điều hành", () => {
  const rows = filterAndSortEvacuations(operations, baseFilters);
  assert.deepEqual(
    rows.map((item) => item.id),
    ["EVAC-002", "EVAC-001", "EVAC-003"],
  );
});

test("worklist lọc theo trạng thái, ưu tiên, tuyến và search text", () => {
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      status: "Tạm dừng",
    }).map((item) => item.id),
    ["EVAC-002"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      priority: "Khẩn cấp",
    }).map((item) => item.id),
    ["EVAC-001"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, { ...baseFilters, route: "Bị chặn" })
      .map((item) => item.id),
    ["EVAC-002"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, { ...baseFilters, search: "âu cơ" })
      .map((item) => item.id),
    ["EVAC-002"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      search: "không-tồn-tại",
    }),
    [],
  );
});

test("worklist lọc tiến độ: chưa bắt đầu, đang diễn ra và trễ/bị chặn", () => {
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      progress: "Trễ hoặc bị chặn",
    }).map((item) => item.id),
    ["EVAC-002"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      progress: "Chưa bắt đầu",
    }).map((item) => item.id),
    ["EVAC-003"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      progress: "Đang diễn ra",
    }).map((item) => item.id),
    ["EVAC-002", "EVAC-001"],
  );
  assert.deepEqual(
    filterAndSortEvacuations(operations, {
      ...baseFilters,
      progress: "Hoàn tất",
    }),
    [],
  );
});

test("sort Hoàn thành dự kiến theo trình tự thờii gian", () => {
  const rows = sortEvacuations(operations, { sort: "Hoàn thành dự kiến" });
  assert.deepEqual(
    rows.map((item) => item.id),
    ["EVAC-002", "EVAC-001", "EVAC-003"],
  );
});

test("evacuationDetailPath đi theo History API router", () => {
  assert.equal(
    evacuationDetailPath({ id: "EVAC-002" }),
    "/evacuations/EVAC-002",
  );
});

test("summary tổng hợp đúng số liệu canonical seed", () => {
  assert.deepEqual(summarizeEvacuations(operations), {
    total: 3,
    active: 3,
    delayed: 1,
    noTeam: 2,
    evacuated: 410,
    estimated: 800,
  });
});

test("khuyến nghị suy ra từ canonical state: EVAC-002 bị chặn và thiếu đội", () => {
  const blocked = operations.find((item) => item.id === "EVAC-002")!;
  const recommendations = evacuationRecommendations(blocked);
  assert.equal(recommendations.length, 2);
  assert.ok(recommendations[0].includes("tuyến"));
  assert.ok(recommendations[1].includes("đội"));
  const running = operations.find((item) => item.id === "EVAC-001")!;
  assert.deepEqual(evacuationRecommendations(running), []);
});

test("hoạt động đã kết thúc không còn khuyến nghị hay cờ active", () => {
  const operation = operations.find((item) => item.id === "EVAC-001")!;
  const closed = { ...operation, status: "Hoàn thành" as const };
  assert.equal(isActiveEvacuation(closed), false);
  assert.deepEqual(evacuationRecommendations(closed), []);
});

test("toEvacuationView gộp đúng thực thể liên kết và lifecycle transitions", () => {
  const operation = operations.find((item) => item.id === "EVAC-002")!;
  const view = toEvacuationView(operation, {
    incidents: nationalView.incidents,
    shelters: nationalView.shelters,
    teams: nationalView.teams,
  });
  assert.equal(view.incident?.id, "INC-0241");
  assert.equal(view.shelter?.id, "TH-02");
  assert.equal(view.team, undefined);
  assert.equal(view.remainingPopulation, 90);
  assert.equal(view.delayed, true);
  assert.deepEqual(view.availableTransitions, ["Đang triển khai", "Đã hủy"]);
  assert.equal(view.needsAlternativeRoute, true);
  assert.ok(view.shelterCapacity);
});

test("getEvacuationView trả undefined với id không tồn tại hoặc ngoài phạm vi", () => {
  assert.equal(
    getEvacuationView(operations, "EVAC-999", {
      incidents: nationalView.incidents,
      shelters: nationalView.shelters,
      teams: nationalView.teams,
    }),
    undefined,
  );
});

test("matchesEvacuationFilters bỏ qua khoảng trắng và chữ hoa trong search", () => {
  const operation = operations.find((item) => item.id === "EVAC-001")!;
  assert.equal(
    matchesEvacuationFilters(operation, { ...baseFilters, search: "  evac-001 " }),
    true,
  );
});

test("permission map phản ánh ma trận hiện hữu theo vai trò", () => {
  const planned = operations.find((item) => item.id === "EVAC-003")!;
  const commander = getEvacuationPermissions(
    planned,
    can("Trần Quốc Thuận"),
  );
  assert.deepEqual(commander, {
    approve: true,
    assign: true,
    update: true,
    complete: true,
    cancel: true,
  });
  const rescueLeader = getEvacuationPermissions(
    planned,
    can("Phạm Trung Hiếu"),
  );
  assert.equal(rescueLeader.approve, false);
  assert.equal(rescueLeader.cancel, false);
  const closed = { ...planned, status: "Hoàn thành" as const };
  assert.deepEqual(
    getEvacuationPermissions(closed, can("Trần Quốc Thuận")),
    {
      approve: false,
      assign: false,
      update: false,
      complete: false,
      cancel: false,
    },
  );
});

test("worklist chỉ đọc authorized view: vai trò hạn chế không có dữ liệu phục vụ UI", () => {
  for (const username of [
    "Phạm Văn Đam",
    "Phạm Trung Hiếu",
    "Lê Nguyễn Minh Trí",
    "Nguyễn Nam Anh",
  ]) {
    const view = createAuthorizedOperationalView(account(username), source());
    assert.equal(view.evacuationOperations.length, 0, username);
    assert.equal(view.evacuationEvents.length, 0, username);
    assert.equal(
      filterAndSortEvacuations(view.evacuationOperations, baseFilters).length,
      0,
      username,
    );
  }
});

test("cross-link alerts: cảnh báo EVAC-002 trỏ về route workspace", () => {
  const commander = account("Trần Quốc Thuận");
  const alerts = deriveAuthorizedAlerts(commander, nationalView);
  const linked = getLinkedEvacuationAlerts(alerts, { id: "EVAC-002" });
  assert.deepEqual(
    linked.map((item) => item.key),
    ["evacuation:Evacuation:EVAC-002:evacuation_blocked_or_paused"],
  );
  assert.equal(linked[0].source.path, "/evacuations/EVAC-002");
  assert.equal(getLinkedEvacuationAlerts(alerts, { id: "EVAC-001" }).length, 0);
});
