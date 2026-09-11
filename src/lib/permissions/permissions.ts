import type { UserRole } from "../../domain/shared/auth";

/**
 * Quyền nghiệp vụ theo mô hình 4 vai (PROMPT V2).
 *
 * Nguyên tắc:
 * - `admin` quản trị tài khoản/phân quyền/nhật ký và được XEM dữ liệu điều
 *   hành, nhưng KHÔNG mặc định có quyền xác minh, điều phối, chấp nhận kết quả
 *   hay công bố cảnh báo.
 * - `disaster_officer` là người ra quyết định nghiệp vụ.
 * - `rescue_unit` chỉ tác động lên nhiệm vụ được giao và đội của mình; báo
 *   xong không tự đóng — cán bộ xác nhận.
 * - `citizen` gửi SOS/phản ánh, tra cứu điểm sơ tán và cảnh báo công bố.
 * - Tiện ích chung (bản đồ, thời tiết, vị trí, SOS 1 chạm, theo dõi SOS mình
 *   gửi) không đi qua matrix này — xem `sos_create` và `sos_view_own`.
 */
export type Permission =
  | "view"
  | "create"
  | "dispatch"
  | "severity"
  | "update"
  | "close"
  | "update_progress"
  | "task_view"
  | "task_create"
  | "task_assign"
  | "task_accept"
  | "task_start"
  | "task_update"
  | "task_report_done"
  | "task_review"
  | "task_complete"
  | "task_cancel"
  | "team_view"
  | "team_create"
  | "team_edit"
  | "team_assign"
  | "team_update_status"
  | "team_update_location"
  | "team_manage_members"
  | "shelter_view"
  | "shelter_create"
  | "shelter_update"
  | "shelter_open"
  | "shelter_close"
  | "shelter_manage_capacity"
  | "sos_view"
  | "sos_view_own"
  | "sos_create"
  | "sos_verify"
  | "sos_update"
  | "sos_triage"
  | "sos_assign_incident"
  | "sos_create_task"
  | "sos_dispatch"
  | "sos_update_field"
  | "sos_resolve"
  | "sos_close"
  | "sos_cancel"
  | "report_view"
  | "report_view_own"
  | "report_create"
  | "report_review"
  | "published_alert_view"
  | "published_alert_manage"
  | "user_manage"
  | "alert_view"
  | "alert_acknowledge"
  | "audit_view";

export const permissionMatrix: Record<UserRole, readonly Permission[]> = {
  // Quản trị viên: toàn quyền trên mọi phân hệ (xem + tác nghiệp + quản trị).
  admin: [
    "view",
    "create",
    "dispatch",
    "severity",
    "update",
    "close",
    "update_progress",
    "task_view",
    "task_create",
    "task_assign",
    "task_accept",
    "task_start",
    "task_update",
    "task_report_done",
    "task_review",
    "task_complete",
    "task_cancel",
    "team_view",
    "team_create",
    "team_edit",
    "team_assign",
    "team_update_status",
    "team_update_location",
    "team_manage_members",
    "shelter_view",
    "shelter_create",
    "shelter_update",
    "shelter_open",
    "shelter_close",
    "shelter_manage_capacity",
    "sos_view",
    "sos_view_own",
    "sos_create",
    "sos_verify",
    "sos_update",
    "sos_triage",
    "sos_assign_incident",
    "sos_create_task",
    "sos_dispatch",
    "sos_update_field",
    "sos_resolve",
    "sos_close",
    "sos_cancel",
    "report_view",
    "report_view_own",
    "report_create",
    "report_review",
    "published_alert_view",
    "published_alert_manage",
    "user_manage",
    "alert_view",
    "alert_acknowledge",
    "audit_view",
  ],
  disaster_officer: [
    "view",
    "create",
    "dispatch",
    "severity",
    "update",
    "close",
    "task_view",
    "task_create",
    "task_assign",
    "task_update",
    "task_review",
    "task_complete",
    "task_cancel",
    "team_view",
    "team_create",
    "team_edit",
    "team_assign",
    "team_update_status",
    "team_update_location",
    "team_manage_members",
    "shelter_view",
    "shelter_create",
    "shelter_update",
    "shelter_open",
    "shelter_close",
    "shelter_manage_capacity",
    "sos_view",
    "sos_view_own",
    "sos_create",
    "sos_verify",
    "sos_update",
    "sos_triage",
    "sos_assign_incident",
    "sos_create_task",
    "sos_dispatch",
    "sos_update_field",
    "sos_resolve",
    "sos_close",
    "sos_cancel",
    "report_view",
    "report_view_own",
    "report_create",
    "report_review",
    "published_alert_view",
    "published_alert_manage",
    "alert_view",
    "alert_acknowledge",
    "audit_view",
  ],
  rescue_unit: [
    "view",
    "update_progress",
    "task_view",
    "task_accept",
    "task_start",
    "task_update",
    "task_report_done",
    "team_view",
    "team_update_status",
    "team_update_location",
    "team_manage_members",
    "shelter_view",
    "sos_view",
    "sos_view_own",
    "sos_create",
    "sos_update_field",
    "report_view_own",
    "report_create",
    "published_alert_view",
    "alert_view",
    "alert_acknowledge",
  ],
  citizen: [
    "sos_create",
    "sos_view_own",
    "report_create",
    "report_view_own",
    "published_alert_view",
  ],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return permissionMatrix[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission))
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
}
