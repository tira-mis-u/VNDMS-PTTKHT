import type { Role } from "./types";
export const roleLabels: Record<Role, string> = {
  commander: "Chỉ huy",
  operator: "Điều hành viên",
  local_officer: "Cán bộ địa phương",
  rescue_leader: "Đội trưởng đội cứu hộ",
  rescue_member: "Thành viên cứu hộ",
  warehouse_staff: "Nhân viên kho",
  relief_worker: "Nhân viên cứu trợ",
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
  PERMISSION_DENIED: "Từ chối quyền thao tác",
  USER_REGISTERED: "Đăng ký tài khoản mới",
  USER_ACTIVATED: "Kích hoạt tài khoản",
  USER_DEACTIVATED: "Vô hiệu hóa tài khoản",
  USER_ROLE_CHANGED: "Thay đổi vai trò",
  USER_SCOPE_CHANGED: "Thay đổi phạm vi địa bàn",
  PANIC_ALERT_TRIGGERED: "Bật cảnh báo 1 chạm (SOS Panic)",
  LIVE_BEACON_TOGGLED: "Bật/Tắt phát định vị Realtime",
};
const auditResultLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  DENIED: "Bị từ chối",
  FAILED: "Không thành công",
};
const auditResourceLabels: Record<string, string> = {
  Session: "Phiên làm việc",
  User: "Tài khoản",
};
export const auditActionLabel = (value: string) =>
  auditActionLabels[value] ?? "Hành động hệ thống";
export const auditResultLabel = (value: string) =>
  auditResultLabels[value] ?? "Chưa xác định";
export const auditResourceLabel = (value: string) =>
  auditResourceLabels[value] ?? "Dữ liệu nghiệp vụ";
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
