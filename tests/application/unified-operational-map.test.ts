import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
import { operationalMapFocusPath } from "../../src/app/routes/router";
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

test("2. Commander và Operator nhìn đủ lớp operational trên toàn Hà Nội", () => {
  const commander = createAuthorizedOperationalView(
    user("Trần Quốc Thuận"),
    load(),
  );
  const operator = createAuthorizedOperationalView(
    user("Nguyễn Quốc Trung"),
    load(),
  );
  const commanderCounts = countByLayer(getUnifiedMapPoints(commander));
  const operatorCounts = countByLayer(getUnifiedMapPoints(operator));
  for (const key of Object.keys(commanderCounts)) {
    assert.ok(
      commanderCounts[key as keyof typeof commanderCounts] > 0,
      `commander thiếu dữ liệu layer ${key}`,
    );
    assert.equal(
      operatorCounts[key as keyof typeof operatorCounts],
      commanderCounts[key as keyof typeof commanderCounts],
      `operator không có global visibility tại layer ${key}`,
    );
  }
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
  const visibleTeams = points.filter((p) => p.kind === "team");
  assert.deepEqual(
    visibleTeams.map((point) => point.id),
    ["CH-05"],
    "đội trưởng chỉ được nhận layer đội thuộc ownership",
  );
  for (const point of visibleTeams) assert.ok(allowedTeamIds.has(point.id));
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
  assert.deepEqual(
    points,
    [],
    "công dân không được nhận bất kỳ layer tác nghiệp nào",
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
    assert.equal(
      operationalMapFocusPath(point.id),
      `/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p?focus=${encodeURIComponent(point.id)}`,
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
  const authorizedIds = {
    incident: new Set(view.incidents.map((item) => item.id)),
    sos: new Set(view.sosRequests.map((item) => item.id)),
    task: new Set(view.tasks.map((item) => item.id)),
    team: new Set(view.teams.map((item) => item.id)),
    shelter: new Set(view.shelters.map((item) => item.id)),
    evacuation: new Set(view.evacuationOperations.map((item) => item.id)),
    relief: new Set(view.reliefRequests.map((item) => item.id)),
    warehouse: new Set(view.warehouses.map((item) => item.id)),
    recovery: new Set(view.recoveryProjects.map((item) => item.id)),
  };
  for (const point of getUnifiedMapPoints(view))
    assert.ok(
      authorizedIds[point.kind].has(point.id),
      `query làm rò ${point.kind}:${point.id}`,
    );
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

test("13. Static architecture scan: feature không bypass Provider hoặc tạo GIS store", () => {
  const featureFiles = sourceFiles("src/features/operational-map");
  const featureSource = featureFiles
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const querySource = readFileSync(
    "src/application/map/unifiedMapQueries.ts",
    "utf8",
  );
  for (const forbidden of [
    "inMemoryOperationalRepository",
    "infrastructure/persistence",
    "createAuthorizedOperationalView",
  ])
    assert.equal(
      featureSource.includes(forbidden),
      false,
      `presentation bypass qua ${forbidden}`,
    );
  for (const forbidden of [
    "inMemoryOperationalRepository",
    "infrastructure/persistence",
    'from "@/state/operations/OperationalStateContext"',
    "createContext(",
  ])
    assert.equal(
      querySource.includes(forbidden),
      false,
      `application query phụ thuộc ${forbidden}`,
    );
  assert.equal(
    featureFiles.some((path) => /(?:Store|Context|Repository)\.(?:ts|tsx)$/.test(path)),
    false,
    "feature tạo GIS store/context/repository riêng",
  );
});
