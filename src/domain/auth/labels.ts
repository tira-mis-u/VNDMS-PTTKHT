import type { Role } from "./types";
export const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên",
  disaster_officer: "Cán bộ phòng chống thiên tai",
  rescue_unit: "Đơn vị cứu hộ",
  citizen: "Công dân",
};
export const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({
  value: value as Role,
  label,
}));
const auditActionLabels: Record<string, string> = {
  LOGIN_SUCCESS: "Đăng nhập thành công",
  LOGIN_FAILED: "Đăng nhập không thành công",
  LOGOUT: "Đăng xuất",
  SESSION_EXPIRED: "Phiên làm việc hết hạn",
  SESSION_RESTORED: "Khôi phục phiên làm việc",
  MUTATION_AUTHORIZED: "Cập nhật thông tin tài khoản",
  OPERATIONAL_MUTATION: "Thao tác nghiệp vụ",
  ALERT_INTERACTION: "Tương tác hàng đợi cảnh báo",
  PERMISSION_DENIED: "Từ chối quyền thao tác",
  USER_REGISTERED: "Đăng ký tài khoản mới",
  USER_ACTIVATED: "Kích hoạt tài khoản",
  USER_DEACTIVATED: "Vô hiệu hóa tài khoản",
  USER_ROLE_CHANGED: "Thay đổi vai trò",
  USER_SCOPE_CHANGED: "Thay đổi phạm vi địa bàn",
  ROLE_MODEL_MIGRATED: "Chuyển đổi mô hình vai trò (V2)",
  PANIC_ALERT_TRIGGERED: "Phát tín hiệu SOS khẩn cấp",
  LIVE_BEACON_TOGGLED: "Bật/Tắt phát định vị thời gian thực",
};
const auditResultLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  DENIED: "Bị từ chối",
  FAILED: "Không thành công",
};
const auditResourceLabels: Record<string, string> = {
  Session: "Phiên làm việc",
  User: "Tài khoản",
  Security: "An ninh phiên",
  RoleModel: "Mô hình vai trò",
  PermissionBoundary: "Ranh giới phân quyền",
  System: "Hệ thống",
  Resource: "Tài nguyên",
  // Nghiệp vụ điều hành / ứng phó
  Incident: "Sự cố",
  Task: "Nhiệm vụ",
  TaskReview: "Kết quả nhiệm vụ",
  Team: "Đội cứu hộ",
  Shelter: "Điểm sơ tán",
  SOS: "Yêu cầu SOS",
  SosRequest: "Yêu cầu SOS",
  CitizenReport: "Phản ánh hiện trường",
  PublishedAlert: "Cảnh báo công bố",
  OperationalAlert: "Cảnh báo tác nghiệp",
  DutyLog: "Sổ trực ban",
  // Module mở rộng (dữ liệu nghiệp vụ khác)
  ReliefRequest: "Yêu cầu cứu trợ",
  Warehouse: "Kho cứu trợ",
  Shipment: "Chuyến hàng cứu trợ",
  EvacuationOperation: "Ca trực",
  RecoveryProject: "Dự án phục hồi",
  DamageAssessment: "Đánh giá thiệt hại",
  Playbook: "Kịch bản vận hành",
  PlaybookExecution: "Thực thi kịch bản",
  Simulation: "Mô phỏng",
};
/** Mã hành động lạ hiển thị nguyên vẹn — nhật ký không được ẩn hành vi sau nhãn chung. */
export const auditActionLabel = (value: string) =>
  auditActionLabels[value] ?? value;
export const auditResultLabel = (value: string) =>
  auditResultLabels[value] ?? "Chưa xác định";
/**
 * resourceType có thể là chuỗi ghép nhiều loại ("Incident+Team") do
 * authorizeResources; tách từng loại để dịch, không gộp về nhãn chung.
 */
export const auditResourceLabel = (value: string) =>
  value
    .split("+")
    .map((part) => auditResourceLabels[part] ?? part)
    .join(" + ") || "Dữ liệu nghiệp vụ";
export const auditTimestampLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
