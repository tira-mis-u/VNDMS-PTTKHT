import assert from "node:assert/strict";
import test from "node:test";
import {
  activeNavigationLabel,
  parseRoute,
} from "../../src/app/routes/router";
import {
  firstAccessibleNavPath,
  landingPathForRole,
  navigationGroups,
  visibleNavigationGroups,
} from "../../src/components/navigation/navigationConfig";
import {
  permissionMatrix,
  type Permission,
} from "../../src/lib/permissions/permissions";
import type { UserRole } from "../../src/domain/shared/auth";
import { readFileSync } from "node:fs";

const canFor =
  (role: UserRole) =>
  (permission: Permission) =>
    (permissionMatrix[role] as readonly Permission[]).includes(permission);

const allLabels = navigationGroups.flatMap((group) =>
  group.items.map((item) => item.label),
);

test("nhãn điều hướng tách biệt: Phân tích vs Quản trị", () => {
  // Báo cáo là tab trong phân hệ Phân tích tác nghiệp nên dùng chung nhãn
  // điều hướng với mục sidebar "Phân tích tác nghiệp".
  assert.equal(
    activeNavigationLabel(parseRoute("/analytics/reports")),
    "Phân tích tác nghiệp",
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
  // Sau khi gộp chuỗi hậu cần, thủ kho chỉ còn hai mục: Cảnh báo và Cứu trợ
  // (kho & tồn, chuyến hàng là tab bên trong phân hệ Cứu trợ).
  assert.deepEqual(labels, ["Cảnh báo", "Cứu trợ"]);
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
  // Quy tắc thô: mục đầu tiên được phép đọc theo thứ tự sidebar.
  assert.equal(firstAccessibleNavPath(canFor("commander")), "/");
  assert.equal(firstAccessibleNavPath(canFor("warehouse_staff")), "/alerts");
  assert.equal(firstAccessibleNavPath(() => false), "/");
  // Quy tắc theo vai trò: đưa người dùng về đúng bàn làm việc của họ thay vì
  // một danh sách chỉ đọc. Thủ kho và nhân viên cứu trợ vào thẳng phân hệ Cứu
  // trợ; thành viên đội cứu hộ vào danh sách nhiệm vụ.
  assert.equal(landingPathForRole(canFor("commander"), "commander"), "/");
  assert.equal(
    landingPathForRole(canFor("warehouse_staff"), "warehouse_staff"),
    "/relief/requests",
  );
  assert.equal(
    landingPathForRole(canFor("relief_worker"), "relief_worker"),
    "/relief/requests",
  );
  assert.equal(landingPathForRole(canFor("rescue_member"), "rescue_member"), "/tasks");
  // Không có quyền nào thì vẫn quay về quy tắc thô, không văng ra ngoài.
  assert.equal(landingPathForRole(() => false, "citizen"), "/");
});

test("nhãn hai quần đảo do nền bản đồ quốc gia cung cấp, không tự chèn điểm neo", () => {
  // Trước đây ứng dụng tự chèn hai điểm nhãn Hoàng Sa / Trường Sa từ hằng số
  // trong mã nguồn. Từ khi nền bản đồ là NDAMaps (bản đồ số quốc gia), nhãn
  // hai quần đảo nằm sẵn trong vector tile chính thức, nên hàm chèn nhãn được
  // giữ lại ở dạng no-op có ghi chú. Kiểm thử này khóa lại quyết định đó để
  // không ai lặng lẽ chèn lại toạ độ tự suy diễn.
  const source = readFileSync("src/infrastructure/gis/mapConfig.ts", "utf8");
  assert.match(source, /export function addVietnamSeaLabels/);
  assert.match(source, /Hoàng Sa/);
  assert.match(source, /Trường Sa/);
  assert.doesNotMatch(source, /VIETNAM_SEA_LABELS/);
});
