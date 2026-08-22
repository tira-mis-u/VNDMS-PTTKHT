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
  VIETNAM_ISLAND_ZONES,
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
    "Báo cáo",
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
    "Nhật ký hệ thống",
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

test("điều hành viên thấy Nhật ký hệ thống nhưng không thấy mục Người dùng", () => {
  const groups = visibleNavigationGroups(canFor("operator"));
  const labels = groups.flatMap((group) =>
    group.items.map((item) => item.label),
  );
  assert.ok(labels.includes("Nhật ký hệ thống"));
  assert.ok(!labels.includes("Người dùng"));
});

test("trang đích sau đăng nhập theo vai trò", () => {
  assert.equal(firstAccessibleNavPath(canFor("commander")), "/");
  assert.equal(firstAccessibleNavPath(canFor("warehouse_staff")), "/alerts");
  assert.equal(firstAccessibleNavPath(canFor("rescue_member")), "/alerts");
  assert.equal(firstAccessibleNavPath(() => false), "/");
});

test("nhãn hai quần đảo giữ nguyên và có vùng khái quát bao phủ", () => {
  const names = VIETNAM_SEA_LABELS.features.map((feature) => feature.properties.name);
  assert.deepEqual(names, ["Quần Đảo Hoàng Sa", "Quần Đảo Trường Sa"]);
  const zones = VIETNAM_ISLAND_ZONES.features;
  assert.equal(zones.length, 2);
  const contains = (
    ring: readonly (readonly number[])[],
    [x, y]: readonly number[],
  ) => {
    // Ray casting đơn giản trên mặt phẳng lon/lat.
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  };
  for (const feature of VIETNAM_SEA_LABELS.features) {
    const zone = zones.find(
      (entry) => entry.properties.name === feature.properties.name,
    );
    assert.ok(zone, `${feature.properties.name} cần vùng khái quát riêng`);
    const ring = zone.geometry.coordinates[0];
    assert.ok(ring.length >= 48, "vùng quần đảo đủ mịn để nhìn rõ khi zoom");
    assert.ok(
      contains(ring, feature.geometry.coordinates),
      `${feature.properties.name}: nhãn phải nằm trong vùng khái quát`,
    );
  }
});
