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

/* V2 (4 vai): các test theo vai cũ (commander/warehouse_staff/operator/relief_worker/
 * rescue_member) chuyển sang admin/disaster_officer/rescue_unit/citizen. */

test("cán bộ PCTT nhìn thấy toàn bộ mục nghiệp vụ; admin thấy Phân quyền và chỉ đọc Phản ánh", () => {
  const officer = visibleNavigationGroups(canFor("disaster_officer"));
  const officerLabels = officer.flatMap((group) => group.items.map((item) => item.label));
  for (const label of ["Trung tâm điều hành", "Bản đồ tác nghiệp", "Cảnh báo", "Sự cố", "SOS", "Nhiệm vụ", "Đội cứu hộ", "Phản ánh", "Điểm sơ tán"])
    assert.ok(officerLabels.includes(label), `disaster_officer thiếu mục ${label}`);
  assert.ok(!officerLabels.includes("Phân quyền"), "cán bộ không có user_manage");
  const admin = visibleNavigationGroups(canFor("admin"));
  const adminLabels = admin.flatMap((group) => group.items.map((item) => item.label));
  assert.ok(adminLabels.includes("Phân quyền"));
  assert.ok(adminLabels.includes("Nhật ký bảo mật"));
  // Admin đọc được danh sách Phản ánh (report_view) nhưng không có report_review.
  assert.ok(adminLabels.includes("Phản ánh"));
  assert.ok(!canFor("admin")("report_review"));
  assert.ok(adminLabels.includes("Điểm sơ tán"));
});

test("đơn vị cứu hộ chỉ thấy đúng các module được phân quyền", () => {
  const groups = visibleNavigationGroups(canFor("rescue_unit"));
  const labels = groups.flatMap((group) => group.items.map((item) => item.label));
  for (const label of ["SOS", "Nhiệm vụ", "Đội cứu hộ", "Điểm sơ tán", "Cảnh báo"])
    assert.ok(labels.includes(label), `rescue_unit thiếu mục ${label}`);
  assert.ok(!labels.includes("Phản ánh"));
  assert.ok(groups.every((group) => group.label !== "Quản trị"));
});

test("công dân dùng nhóm điều hướng riêng của Cổng công dân", () => {
  const groups = visibleNavigationGroups(canFor("citizen"), "citizen");
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.label)),
    ["Trang chủ & Bản đồ", "Điểm sơ tán an toàn", "Cảnh báo thiên tai", "Hồ sơ & Địa bàn"],
  );
});

test("trang đích sau đăng nhập theo vai trò", () => {
  assert.equal(firstAccessibleNavPath(canFor("admin")), "/");
  assert.equal(firstAccessibleNavPath(canFor("disaster_officer")), "/");
  assert.equal(firstAccessibleNavPath(() => false), "/");
  assert.equal(landingPathForRole(canFor("admin"), "admin"), "/");
  assert.equal(landingPathForRole(canFor("disaster_officer"), "disaster_officer"), "/");
  // Đơn vị cứu hộ vào thẳng Nhiệm vụ — nơi tiếp nhận/báo cáo kết quả.
  assert.equal(landingPathForRole(canFor("rescue_unit"), "rescue_unit"), "/tasks");
  // Công dân về Cổng công dân tại "/".
  assert.equal(landingPathForRole(canFor("citizen"), "citizen"), "/");
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
