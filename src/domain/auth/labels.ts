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
  MUTATION_AUTHORIZED: "Cho phép thay đổi dữ liệu",
  PERMISSION_DENIED: "Từ chối quyền thao tác",
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
