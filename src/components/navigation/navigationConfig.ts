import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  FileClock,
  Home,
  LifeBuoy,
  ListTodo,
  LockKeyhole,
  MapPinned,
  MessageSquareWarning,
  Radio,
  Siren,
  UserRound,
} from "lucide-react";
import type { UserRole } from "@/domain/shared/auth";
import type { Permission } from "@/lib/permissions/permissions";
import {
  OPERATIONAL_MAP_WORKSPACE_PATH,
  PERMISSIONS_WORKSPACE_PATH,
} from "../../app/routes/router";
export type NavItem = {
  label: string;
  icon: ComponentType<{ size?: number }>;
  badge?: string;
  path?: string;
  /**
   * Quyền đọc tối thiểu để mục điều hướng xuất hiện trên sidebar.
   * Phải khớp 1-1 với quyền mà route tương ứng kiểm tra tại App.tsx
   * (ẩn mục chỉ là UX; ranh giới route vẫn là nơi chặn truy cập).
   */
  permission: Permission;
};
export type NavGroup = { label: string; items: NavItem[]; admin?: boolean };
export const navigationGroups: NavGroup[] = [
  {
    label: "Điều hành",
    items: [
      // "Tình hình thiên tai" không còn là mục riêng: nó là tab thứ hai của
      // Trung tâm điều hành (cùng dữ liệu, cùng quyền, cùng nhịp cập nhật).
      // Đường dẫn cũ SITUATION_WORKSPACE_PATH vẫn sống để deep-link không hỏng.
      { label: "Trung tâm điều hành", icon: Home, path: "/", permission: "view" },
      { label: "Bản đồ tác nghiệp", icon: MapPinned, path: OPERATIONAL_MAP_WORKSPACE_PATH, permission: "view" },
      { label: "Cảnh báo", icon: Bell, path: "/alerts", permission: "alert_view" },
      { label: "Sự cố", icon: Siren, badge: "6", path: "/incidents", permission: "view" },
      // Phân tích tác nghiệp nằm trong nhóm điều hành: báo cáo là một tab bên
      // trong phân hệ phân tích, không còn là mục điều hướng riêng.
      { label: "Phân tích tác nghiệp", icon: BarChart3, path: "/analytics", permission: "view" },
    ],
  },
  {
    label: "Ứng phó",
    items: [
      // SOS đứng đầu: đây là mục duy nhất mà độ trễ tính bằng mạng người.
      { label: "SOS", icon: Radio, path: "/sos", permission: "sos_view" },
      { label: "Nhiệm vụ", icon: ListTodo, badge: "9", path: "/tasks", permission: "task_view" },
      { label: "Đội cứu hộ", icon: LifeBuoy, path: "/teams", permission: "team_view" },
      // Phản ánh của người dân: cán bộ đánh giá Hợp lệ / Không hợp lệ / Trùng.
      { label: "Phản ánh", icon: MessageSquareWarning, path: "/reports", permission: "report_view" },
      // Điểm sơ tán là danh mục tra cứu dùng chung (phân hệ Sơ tán đã gỡ ở V2).
      { label: "Điểm sơ tán", icon: Building2, path: "/shelters", permission: "shelter_view" },
    ],
  },
  {
    label: "Quản trị",
    admin: true,
    items: [
      { label: "Phân quyền", icon: LockKeyhole, path: PERMISSIONS_WORKSPACE_PATH, permission: "user_manage" },
      { label: "Nhật ký bảo mật", icon: FileClock, path: "/admin/audit", permission: "audit_view" },
    ],
  },
];
export const citizenNavigationGroups: NavGroup[] = [
  {
    label: "Cổng thông tin công dân",
    items: [
      { label: "Trang chủ & Bản đồ", icon: Home, path: "/", permission: "sos_create" },
      { label: "Điểm sơ tán an toàn", icon: Building2, path: "/shelters", permission: "published_alert_view" },
      { label: "Cảnh báo thiên tai", icon: Bell, path: "/alerts", permission: "published_alert_view" },
      { label: "Hồ sơ & Địa bàn", icon: UserRound, path: "/profile", permission: "sos_create" },
    ],
  },
];

export function findNavigationItem(label: string) {
  for (const group of [...navigationGroups, ...citizenNavigationGroups]) {
    const item = group.items.find((entry) => entry.label === label);
    if (item) return { group, item };
  }
  return undefined;
}
export type NavigationPermissionCheck = (permission: Permission) => boolean;
/**
 * Nhóm điều hướng mà tài khoản hiện tại được phép thấy: mục không có quyền
 * đọc bị ẩn hoàn toàn khỏi sidebar, nhóm không còn mục nào cũng bị ẩn.
 * Truy cập trực tiếp bằng URL vẫn do route guard xử lý (AccessDeniedPage).
 */
export function visibleNavigationGroups(can: NavigationPermissionCheck, role?: UserRole) {
  if (role === "citizen") return citizenNavigationGroups;
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}
/**
 * Module đầu tiên (theo thứ tự sidebar) mà tài khoản được phép mở trực tiếp —
 * dùng làm trang đích sau đăng nhập cho vai trò không vào được Trung tâm
 * điều hành. Trả về "/" khi không có lựa chọn nào khác.
 */
export function firstAccessibleNavPath(can: NavigationPermissionCheck) {
  for (const group of navigationGroups)
    for (const item of group.items)
      if (item.path && can(item.permission)) return item.path;
  return "/";
}
/**
 * Trang đích sau đăng nhập theo vai trò (V2). Đơn vị cứu hộ vào thẳng
 * Nhiệm vụ — nơi họ tiếp nhận/báo cáo; các vai khác theo thứ tự sidebar.
 */
const roleLandingPath: Partial<Record<UserRole, { path: string; permission: Permission }>> = {
  rescue_unit: { path: "/tasks", permission: "task_view" },
};
export function landingPathForRole(
  can: NavigationPermissionCheck,
  role: UserRole,
) {
  const preferred = roleLandingPath[role];
  if (preferred && can(preferred.permission)) return preferred.path;
  return firstAccessibleNavPath(can);
}
