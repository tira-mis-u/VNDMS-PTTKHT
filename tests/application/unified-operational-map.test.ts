/*
 * V2 (4 vai): bản đồ hợp nhất còn 5 lớp canonical (incident/sos/task/team/shelter).
 * Test simulation tick (10) và tuyến sơ tán (11) đã gỡ cùng module Mô phỏng/Sơ tán;
 * test vai kho (5) chuyển thành "công dân cũ là thủ kho không còn thấy lớp tác nghiệp".
 * Người dân thấy lớp Điểm sơ tán (danh mục tra cứu) nhưng không lớp tác nghiệp nào khác.
 */
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
} from "../../src/application/map/unifiedMapQueries";
import { operationalMapFocusPath } from "../../src/app/routes/router";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

// Baseline tra theo displayName nên luôn undefined; V2 tra đúng theo username.
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const citizen = () => ({
  ...user("thuantq"),
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

test("2. Admin và Cán bộ PCTT nhìn đủ lớp operational trên toàn quốc", () => {
  const commander = createAuthorizedOperationalView(
    user("thuantq"),
    load(),
  );
  const operator = createAuthorizedOperationalView(
    user("nguyentrung"),
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
      `cán bộ PCTT không có global visibility tại layer ${key}`,
    );
  }
});

test("3. Cán bộ địa phương cũ (nay là công dân) không còn thấy lớp sự cố", () => {
  const view = createAuthorizedOperationalView(user("phamdam"), load());
  const points = getUnifiedMapPoints(view);
  assert.equal(points.some((p) => p.kind === "incident"), false);
  assert.equal(points.some((p) => p.kind === "sos"), false);
  assert.equal(points.some((p) => p.kind === "task"), false);
  assert.equal(points.some((p) => p.kind === "team"), false);
  // Điểm sơ tán là danh mục tra cứu chung cho mọi vai.
  assert.ok(points.some((p) => p.kind === "shelter"));
});

test("4. Đơn vị cứu hộ: chỉ huy toàn bộ đội, layer đội khớp authorized view", () => {
  const view = createAuthorizedOperationalView(user("phamhieu"), load());
  const points = getUnifiedMapPoints(view);
  const allowedTeamIds = new Set(view.teams.map((team) => team.id));
  const visibleTeams = points.filter((p) => p.kind === "team");
  assert.equal(
    visibleTeams.length,
    load().teams.length,
    "đơn vị cứu hộ (chỉ huy toàn lực lượng) thấy mọi đội, không bị khóa vào một đội",
  );
  for (const point of visibleTeams) assert.ok(allowedTeamIds.has(point.id));
  // Không có point nào thuộc entity đã bị authorized view loại ra.
  const allowedIncidentIds = new Set(view.incidents.map((i) => i.id));
  for (const point of points.filter((p) => p.kind === "incident"))
    assert.ok(allowedIncidentIds.has(point.id));
});

test("5. Thủ kho cũ (nay là công dân) không còn quyền kho/lớp tác nghiệp", () => {
  const view = createAuthorizedOperationalView(user("namanh"), load());
  const points = getUnifiedMapPoints(view);
  assert.equal(points.some((p) => p.kind === "incident"), false);
  assert.equal(points.some((p) => p.kind === "sos"), false);
  assert.equal(points.some((p) => p.kind === "team"), false);
  assert.equal(points.some((p) => p.kind === "task"), false);
});

test("6. Citizen chỉ nhận lớp Điểm sơ tán (danh mục tra cứu)", () => {
  const view = createAuthorizedOperationalView(citizen(), load());
  const points = getUnifiedMapPoints(view);
  assert.ok(points.length > 0);
  assert.ok(
    points.every((p) => p.kind === "shelter"),
    "công dân không được nhận bất kỳ layer tác nghiệp nào ngoài điểm sơ tán",
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
    search: "SOS-YAGI-01",
    severity: "",
    layers: defaultUnifiedMapLayers(),
  });
  assert.deepEqual(
    searched.map((p) => p.id),
    ["SOS-YAGI-01"],
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

test("10. Lớp bản đồ mặc định chỉ gồm 5 kind canonical V2", () => {
  const layers = defaultUnifiedMapLayers();
  assert.deepEqual(Object.keys(layers).sort(), [
    "incident",
    "shelter",
    "sos",
    "task",
    "team",
  ]);
  assert.ok(Object.values(layers).every(Boolean));
});

test("12. Data stamp & drawer detail không rò dữ liệu cho query ngoài quyền", () => {
  const view = createAuthorizedOperationalView(user("phamdam"), load());
  const stamp = getUnifiedMapDataStamp(view);
  assert.ok(stamp === null || typeof stamp === "string");
  const leak = findUnifiedMapDetail(view, {
    kind: "incident",
    id: "INC-0234",
  });
  assert.equal(
    leak,
    undefined,
    "drawer resolve được sự cố dù tài khoản công dân không có quyền view",
  );
  const authorizedIds = {
    incident: new Set(view.incidents.map((item) => item.id)),
    sos: new Set(view.sosRequests.map((item) => item.id)),
    task: new Set(view.tasks.map((item) => item.id)),
    team: new Set(view.teams.map((item) => item.id)),
    shelter: new Set(view.shelters.map((item) => item.id)),
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
