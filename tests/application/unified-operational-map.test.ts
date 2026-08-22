import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthorizedOperationalView,
} from "../../src/application/authorization/authorizedOperationalView";
import {
  countByLayer,
  defaultUnifiedMapLayers,
  filterUnifiedMapPoints,
  findUnifiedMapDetail,
  getUnifiedMapDataStamp,
  getUnifiedMapPoints,
  getUnifiedMapRoutes,
  visibleUnifiedMapRoutes,
  type UnifiedMapRouteLine,
} from "../../src/application/map/unifiedMapQueries";
import { applyNextSimulationTick, resetSimulationState } from "../../src/application/simulation/simulationUseCases";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const citizen = () => ({
  ...user("Trần Quốc Thuận"),
  id: "USR-CITIZEN-TEST",
  displayName: "Công dân kiểm thử",
  role: "citizen" as const,
  geographicScope: {
    level: "commune" as const,
    name: "Tứ Liên, Tây Hồ, Hà Nội",
    code: "HN-TAYHO-TULIEN",
  },
});
const load = () => inMemoryOperationalRepository.load();

test("1. Unified geospatial query đọc đúng canonical entities có tọa độ", () => {
  const source = load();
  const points = getUnifiedMapPoints(source);
  const kinds = new Set(points.map((p) => p.kind));
  for (const kind of [
    "incident",
    "sos",
    "task",
    "team",
    "shelter",
    "evacuation",
    "relief",
    "warehouse",
    "recovery",
  ])
    assert.ok(kinds.has(kind as never), `thiếu layer ${kind}`);
  // mọi point dẫn thẳng tới canonical entity qua id
  for (const point of points) {
    const detail = findUnifiedMapDetail(source, point);
    assert.ok(detail, `không resolve được ${point.kind}:${point.id}`);
    assert.ok(
      point.detailPath.endsWith(`/${point.id}`),
      `route sai cho ${point.id}`,
    );
  }
});

test("2. Commander nhìn đủ lớp operational trên toàn Hà Nội", () => {
  const view = createAuthorizedOperationalView(user("Trần Quốc Thuận"), load());
  const counts = countByLayer(getUnifiedMapPoints(view));
  for (const key of Object.keys(counts))
    assert.ok(
      counts[key as keyof typeof counts] > 0,
      `commander thiếu dữ liệu layer ${key}`,
    );
});

test("3. Local Officer chỉ thấy entity trong scope Tây Hồ trên bản đồ", () => {
  const view = createAuthorizedOperationalView(user("Phạm Văn Đam"), load());
  const points = getUnifiedMapPoints(view);
  const incidents = points.filter((p) => p.kind === "incident");
  assert.ok(incidents.some((p) => p.id === "INC-0241"));
  assert.equal(
    incidents.some((p) => p.id === "INC-0234"),
    false,
    "INC-0234 Long Biên không được lọt vào map của Local Officer Tây Hồ",
  );
});

test("4. Rescue role: team/ownership filtering được bảo tồn trong map points", () => {
  const view = createAuthorizedOperationalView(user("Phạm Trung Hiếu"), load());
  const points = getUnifiedMapPoints(view);
  const allowedTeamIds = new Set(view.teams.map((team) => team.id));
  for (const point of points.filter((p) => p.kind === "team"))
    assert.ok(allowedTeamIds.has(point.id));
  // Không có point nào thuộc entity đã bị authorized view loại ra.
  const allowedIncidentIds = new Set(view.incidents.map((i) => i.id));
  for (const point of points.filter((p) => p.kind === "incident"))
    assert.ok(allowedIncidentIds.has(point.id));
});

test("5. Warehouse role chỉ thấy kho được phân quyền", () => {
  const view = createAuthorizedOperationalView(user("Nguyễn Nam Anh"), load());
  const points = getUnifiedMapPoints(view);
  const warehouses = points.filter((p) => p.kind === "warehouse");
  assert.ok(warehouses.length > 0, "warehouse_staff cần thấy kho của mình");
  for (const point of warehouses)
    assert.ok(view.warehouses.some((w) => w.id === point.id));
  // warehouse_staff không có quyền incident/sos → các lớp này rỗng
  assert.equal(points.some((p) => p.kind === "incident"), false);
  assert.equal(points.some((p) => p.kind === "sos"), false);
});

test("6. Citizen bị từ chối toàn bộ operational layers", () => {
  const view = createAuthorizedOperationalView(citizen(), load());
  const points = getUnifiedMapPoints(view);
  const operationalKinds = new Set([
    "incident",
    "sos",
    "task",
    "team",
    "evacuation",
  ]);
  assert.equal(
    points.some((p) => operationalKinds.has(p.kind)),
    false,
  );
});

test("7. Entity click mapping → detail route canonical cho mọi layer", () => {
  const source = load();
  const cases = [
    ["incident", "/incidents/"],
    ["sos", "/sos/"],
    ["task", "/tasks/"],
    ["team", "/teams/"],
    ["shelter", "/shelters/"],
    ["evacuation", "/evacuations/"],
    ["relief", "/relief/requests/"],
    ["warehouse", "/relief/warehouses/"],
    ["recovery", "/recovery/projects/"],
  ] as const;
  for (const [kind, prefix] of cases) {
    const point = getUnifiedMapPoints(source).find((p) => p.kind === kind);
    assert.ok(point, `không có point ${kind}`);
    assert.ok(
      point.detailPath.startsWith(prefix),
      `${kind} -> ${point.detailPath}`,
    );
  }
});

test("8. Layer filter chỉ giữ layer bật; search lọc trong tập authorized", () => {
  const source = load();
  const points = getUnifiedMapPoints(source);
  const layers = defaultUnifiedMapLayers();
  layers.sos = false;
  layers.task = false;
  const filtered = filterUnifiedMapPoints(points, {
    search: "",
    severity: "",
    layers,
  });
  assert.equal(filtered.some((p) => p.kind === "sos"), false);
  assert.equal(filtered.some((p) => p.kind === "task"), false);
  const searched = filterUnifiedMapPoints(points, {
    search: "SOS-0241",
    severity: "",
    layers: defaultUnifiedMapLayers(),
  });
  assert.deepEqual(
    searched.map((p) => p.id),
    ["SOS-0241"],
  );
  const sev = filterUnifiedMapPoints(points, {
    search: "",
    severity: "Khẩn cấp",
    layers: defaultUnifiedMapLayers(),
  });
  assert.ok(sev.length > 0);
  assert.ok(sev.every((p) => p.severity === "Khẩn cấp"));
});

test("9. Không duplicate dataset: id unique trong từng kind", () => {
  const source = load();
  const points = getUnifiedMapPoints(source);
  const seen = new Set<string>();
  for (const point of points) {
    const key = `${point.kind}:${point.id}`;
    assert.equal(seen.has(key), false, `duplicate ${key}`);
    seen.add(key);
  }
  // mỗi point tương ứng đúng một entity canonical, không seed phụ nào
  assert.ok(
    points.every((p) => findUnifiedMapDetail(source, p) !== undefined),
  );
});

test("10. Simulation tick → canonical mutation phản ánh trong map query", () => {
  let simulation = resetSimulationState();
  let snapshot = load();
  const baselinePoints = getUnifiedMapPoints(
    createAuthorizedOperationalView(user("Trần Quốc Thuận"), snapshot),
  ).length;
  const baselineRoutes = getUnifiedMapRoutes(snapshot).map((r) => r.id);
  for (let i = 0; i < 13; i++) {
    const result = applyNextSimulationTick(simulation, snapshot);
    simulation = result.simulation;
    snapshot = result.snapshot;
  }
  const after = getUnifiedMapRoutes(snapshot);
  const afterPoints = getUnifiedMapPoints(
    createAuthorizedOperationalView(user("Trần Quốc Thuận"), snapshot),
  );
  assert.notEqual(afterPoints.length, baselinePoints);
  const afterIds = new Set(after.map((r: UnifiedMapRouteLine) => r.id));
  assert.ok(
    baselineRoutes.some((id) => !afterIds.has(id)) ||
      baselineRoutes.length !== after.length ||
      JSON.stringify(after.map((r) => r.status)) !==
        JSON.stringify(
          getUnifiedMapRoutes(load()).map((r) => r.status),
        ),
    "simulation phải biến đổi canonical state của routes/points",
  );
});

test("11. Tuyến sơ tán bị chặn render dashed; ẩn khi layer evacuation tắt", () => {
  const source = load();
  const routes = getUnifiedMapRoutes(source);
  assert.ok(routes.length > 0);
  assert.ok(
    routes.every((r) => r.points.length > 1),
    "route cần polyline canonical",
  );
  assert.ok(
    routes.some((r) => r.blocked),
    "kịch bản Red River có tuyến bị chặn/hạn chế",
  );
  const layers = defaultUnifiedMapLayers();
  layers.evacuation = false;
  const points = filterUnifiedMapPoints(getUnifiedMapPoints(source), {
    search: "",
    severity: "",
    layers,
  });
  assert.equal(visibleUnifiedMapRoutes(routes, points).length, 0);
});

test("12. Data stamp & drawer detail không rò dữ liệu cho query ngoài scope", () => {
  const view = createAuthorizedOperationalView(user("Phạm Văn Đam"), load());
  const stamp = getUnifiedMapDataStamp(view);
  assert.ok(stamp === null || typeof stamp === "string");
  const leak = findUnifiedMapDetail(view, {
    kind: "incident",
    id: "INC-0234",
  });
  assert.equal(
    leak,
    undefined,
    "drawer resolve được entity ngoài scope của Local Officer",
  );
});
