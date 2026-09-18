/**
 * Nhật ký bảo mật phải phủ mọi thao tác nghiệp vụ (điều hành/ứng phó), không
 * chỉ login/logout/quản trị tài khoản — và mỗi dòng phải đọc được bằng tiếng
 * Việt. Test lớp trình bày thuần dùng chung cho runtime hook và trang Nhật ký.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  auditActionForMutation,
  operationalAuditReason,
} from "../../src/application/auth/auditPresentation";
import {
  auditActionLabel,
  auditResourceLabel,
} from "../../src/domain/auth/labels";

test("thao tác trên bản ghi nghiệp vụ là OPERATIONAL_MUTATION, tài khoản vẫn là MUTATION_AUTHORIZED", () => {
  assert.equal(auditActionForMutation("User"), "MUTATION_AUTHORIZED");
  assert.equal(auditActionForMutation("Session"), "MUTATION_AUTHORIZED");
  assert.equal(auditActionForMutation("RoleModel"), "MUTATION_AUTHORIZED");
  for (const resourceType of [
    "Incident",
    "Task",
    "Team",
    "Shelter",
    "SOS",
    "CitizenReport",
    "PublishedAlert",
    "OperationalAlert",
    "DutyLog",
    // authorizeResources ghép loại khi lệnh chạm nhiều bản ghi (điều phối đội…)
    "Incident+Team",
    "Task+Team",
    "System",
  ]) {
    assert.equal(
      auditActionForMutation(resourceType),
      "OPERATIONAL_MUTATION",
      `${resourceType} phải vào nhóm nghiệp vụ`,
    );
  }
});

test("lý do nhật ký nghiệp vụ nêu thao tác, đối tượng và quyết định quyền", () => {
  const reason = operationalAuditReason({
    operation: "điều phối đội tới sự cố",
    permissionLabel: "Điều phối lực lượng",
    decisionReason: "Được phép theo vai trò và phạm vi quản lý hiện tại.",
    resources: [
      { type: "Incident", id: "INC-0001" },
      { type: "Team", id: "TEAM-03" },
      { type: "Team", id: "TEAM-03" },
    ],
  });
  assert.equal(
    reason,
    "điều phối đội tới sự cố — đối tượng: Incident:INC-0001, Team:TEAM-03 — Được phép theo vai trò và phạm vi quản lý hiện tại.",
  );
});

test("lý do tự suy nhãn quyền khi nơi gọi không đặt tên thao tác, và bỏ qua tài nguyên trống", () => {
  const reason = operationalAuditReason({
    permissionLabel: "Cập nhật sự cố",
    decisionReason: "Được phép theo vai trò và phạm vi quản lý hiện tại.",
    resources: [{ type: "Incident", id: "INC-0002" }],
  });
  assert.match(reason, /^Cập nhật sự cố — đối tượng: Incident:INC-0002/);
  const bare = operationalAuditReason({
    permissionLabel: "Xem dữ liệu vận hành",
    decisionReason: "",
    resources: [],
  });
  assert.equal(bare, "Xem dữ liệu vận hành");
});

test("mọi mã hành động trong AuditAction đều có nhãn tiếng Việt riêng", () => {
  const actions = [
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "LOGOUT",
    "SESSION_RESTORED",
    "SESSION_EXPIRED",
    "PERMISSION_DENIED",
    "MUTATION_AUTHORIZED",
    "OPERATIONAL_MUTATION",
    "ALERT_INTERACTION",
    "USER_REGISTERED",
    "USER_ACTIVATED",
    "USER_DEACTIVATED",
    "USER_ROLE_CHANGED",
    "USER_SCOPE_CHANGED",
    "ROLE_MODEL_MIGRATED",
    "PANIC_ALERT_TRIGGERED",
    "LIVE_BEACON_TOGGLED",
  ];
  for (const action of actions) {
    const label = auditActionLabel(action);
    assert.notEqual(label, action, `${action} thiếu nhãn tiếng Việt`);
    assert.ok(label.length > 3);
  }
  // Hành động lạ không được ẩn sau nhãn chung "Hành động hệ thống".
  assert.equal(auditActionLabel("SOMETHING_NEW"), "SOMETHING_NEW");
});

test("nhãn tài nguyên dịch từng loại của chuỗi ghép và không gộp về nhãn chung", () => {
  assert.equal(
    auditResourceLabel("Incident+Team"),
    "Sự cố + Đội cứu hộ",
  );
  assert.equal(auditResourceLabel("DutyLog"), "Sổ trực ban");
  assert.equal(auditResourceLabel("OperationalAlert"), "Cảnh báo tác nghiệp");
  assert.equal(auditResourceLabel("User"), "Tài khoản");
});
