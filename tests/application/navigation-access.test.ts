import assert from "node:assert/strict";
import test from "node:test";
import {
  activeNavigationLabel,
  parseRoute,
} from "../../src/app/routes/router";
import {
  firstAccessibleNavPath,
  navigationGroups,
  visibleNavigationGroups,
} from "../../src/components/navigation/navigationConfig";
import {
  permissionMatrix,
  type Permission,
} from "../../src/lib/permissions/permissions";
import type { UserRole } from "../../src/domain/shared/auth";
import {
  VIETNAM_SEA_LABEL_PROVENANCE,
  VIETNAM_SEA_LABELS,
} from "../../src/infrastructure/gis/mapConfig";

const canFor =
  (role: UserRole) =>
  (permission: Permission) =>
    (permissionMatrix[role] as readonly Permission[]).includes(permission);

const allLabels = navigationGroups.flatMap((group) =>
  group.items.map((item) => item.label),
);

test("nhãn điều hướng tách biệt: Báo cáo vs Phân tích vs Quản trị", () => {
  assert.equal(
    activeNavigationLabel(parseRoute("/analytics/reports")),
    "Báo cáo tác nghiệp",
  );
  assert.equal(
    activeNavigationLabel(parseRoute("/analytics")),
    "Phân tích tác nghiệp",
  );
  assert.equal(
    activeNavigationLabel(parseRoute("/analytics/incidents")),
    "Phân tích tác nghiệp",
  );
  assert.equal(
    activeNavigationLabel(parseRoute("/admin/audit")),
    "Nhật ký bảo mật",
  );
  assert.equal(
    activeNavigationLabel(parseRoute("/admin/users")),
    "Người dùng",
  );
  assert.equal(
    activeNavigationLabel(parseRoute("/admin")),
    "Người dùng",
  );
});

test("mọi mục sidebar có path đều route được và highlight đúng nhãn", () => {
  for (const group of navigationGroups)
    for (const item of group.items) {
      if (!item.path) continue;
      const route = parseRoute(item.path);
      assert.notEqual(route.name, "not-found", `${item.label}: ${item.path}`);
      assert.equal(
        activeNavigationLabel(route),
        item.label,
        `${item.path} phải highlight đúng "${item.label}"`,
      );
    }
});

test("mọi permission của mục điều hướng đều tồn tại trong ma trận quyền", () => {
  const known = new Set<string>(
    Object.values(permissionMatrix).flatMap((list) => [...list]),
  );
  for (const group of navigationGroups)
    for (const item of group.items)
      assert.ok(
        known.has(item.permission),
        `${item.label}: permission không hợp lệ ${item.permission}`,
      );
});

test("commander nhìn thấy toàn bộ nhóm điều hướng", () => {
  const groups = visibleNavigationGroups(canFor("commander"));
  assert.equal(groups.length, navigationGroups.length);
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.label)),
    allLabels,
  );
});

test("tài khoản kho chỉ thấy đúng các module được phân quyền", () => {
  const groups = visibleNavigationGroups(canFor("warehouse_staff"));
  const labels = groups.flatMap((group) =>
    group.items.map((item) => item.label),
  );
  assert.deepEqual(labels, ["Cảnh báo", "Kho vật tư", "Phân phối cứu trợ", "Trợ lý AI"]);
  // Nhóm Quản trị bị ẩn hoàn toàn vì không còn mục nào hợp lệ.
  assert.ok(groups.every((group) => group.label !== "Quản trị"));
});

test("điều hành viên thấy Nhật ký bảo mật nhưng không thấy mục Người dùng", () => {
  const groups = visibleNavigationGroups(canFor("operator"));
  const labels = groups.flatMap((group) =>
    group.items.map((item) => item.label),
  );
  assert.ok(labels.includes("Nhật ký bảo mật"));
  assert.ok(!labels.includes("Người dùng"));
});

test("trang đích sau đăng nhập theo vai trò", () => {
  assert.equal(firstAccessibleNavPath(canFor("commander")), "/");
  assert.equal(firstAccessibleNavPath(canFor("warehouse_staff")), "/alerts");
  assert.equal(firstAccessibleNavPath(canFor("rescue_member")), "/alerts");
  assert.equal(firstAccessibleNavPath(() => false), "/");
});

test("nhãn hai quần đảo chỉ dùng điểm neo có nguồn, không suy diễn vùng", () => {
  const names = VIETNAM_SEA_LABELS.features.map((feature) => feature.properties.name);
  assert.deepEqual(names, ["Quần đảo Hoàng Sa", "Quần đảo Trường Sa"]);
  assert.equal(VIETNAM_SEA_LABEL_PROVENANCE.displayCrs, "EPSG:4326");
  assert.match(VIETNAM_SEA_LABEL_PROVENANCE.geometryPolicy, /không suy diễn polygon/i);
  for (const feature of VIETNAM_SEA_LABELS.features) {
    assert.equal(feature.geometry.type, "Point");
    assert.equal(feature.properties.kind, "place-label");
    assert.match(feature.properties.sourceUrl, /^https:\/\//);
    assert.equal(feature.properties.displayCrs, "EPSG:4326");
    assert.equal(feature.properties.conversion, "DMS sang độ thập phân");
    assert.equal(feature.properties.accessedAt, "2026-08-23");
    const [longitude, latitude] = feature.geometry.coordinates;
    assert.ok(longitude >= 111 && longitude <= 118);
    assert.ok(latitude >= 6 && latitude <= 18);
  }
});
