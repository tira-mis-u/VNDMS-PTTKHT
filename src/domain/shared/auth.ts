/**
 * Bốn vai trò hệ thống (PROMPT V2).
 * - admin: quản trị tài khoản/phân quyền/nhật ký; KHÔNG mặc định có quyền
 *   xác minh, điều phối hay chấp nhận kết quả nghiệp vụ.
 * - disaster_officer: cán bộ phòng chống thiên tai — xác minh, điều phối,
 *   xác nhận kết quả, công bố cảnh báo.
 * - rescue_unit: đơn vị cứu hộ — tiếp nhận/thực hiện/báo cáo nhiệm vụ.
 * - citizen: công dân — SOS, phản ánh, tra cứu.
 */
export type UserRole = "admin" | "disaster_officer" | "rescue_unit" | "citizen";

export const USER_ROLES: readonly UserRole[] = [
  "admin",
  "disaster_officer",
  "rescue_unit",
  "citizen",
] as const;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Vai trò cũ (trước V2) → vai trò mới. Dùng cho migration dữ liệu lưu cục bộ;
 * không dùng để cấp quyền động.
 */
export const LEGACY_ROLE_MAP: Readonly<Record<string, UserRole>> = {
  commander: "admin",
  operator: "disaster_officer",
  local_officer: "citizen",
  rescue_leader: "rescue_unit",
  rescue_member: "citizen",
  warehouse_staff: "citizen",
  relief_worker: "citizen",
  citizen: "citizen",
};
