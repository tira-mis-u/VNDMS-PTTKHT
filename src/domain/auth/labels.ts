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
export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
