import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FileClock,
  Home,
  LifeBuoy,
  ListTodo,
  LockKeyhole,
  MapPinned,
  PackageOpen,
  Radio,
  Siren,
  Truck,
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
      // "Điểm sơ tán" là tab của Sơ tán: lập lệnh sơ tán luôn phải xem sức
      // chứa còn trống của điểm đến. Route /shelters vẫn giữ cho cổng công dân.
      { label: "Sơ tán", icon: Truck, path: "/evacuations", permission: "evacuation_view" },
      { label: "Phương án ứng phó", icon: CalendarCheck, path: "/playbooks", permission: "playbook_view" },
    ],
  },
  {
    label: "Hậu cần",
    items: [
      // Một chuỗi cung ứng duy nhất: yêu cầu → giữ hàng ở kho → xuất chuyến →
      // ký nhận. Ba mục cũ trở thành ba tab trong cùng một trang.
      { label: "Cứu trợ", icon: PackageOpen, path: "/relief/requests", permission: "relief_view" },
    ],
  },
  {
    label: "Phục hồi",
    items: [
      // Thẩm định thiệt hại và dự án tái thiết là hai chặng của cùng một hồ sơ
      // khắc phục hậu quả ⇒ một mục, hai tab.
      { label: "Phục hồi & tái thiết", icon: ClipboardCheck, path: "/recovery", permission: "damage_assessment_view" },
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
      { label: "Điểm sơ tán an toàn", icon: Building2, path: "/shelters", permission: "sos_create" },
      { label: "Cảnh báo thiên tai", icon: Bell, path: "/alerts", permission: "sos_create" },
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
 * Trang đích sau đăng nhập theo vai trò.
 *
 * Chỉ lấy "mục đầu tiên được phép" là chưa đủ: thủ kho không có quyền
 * `view` nên rơi vào /alerts — một danh sách cảnh báo mà họ chỉ được đọc,
 * trong khi công việc thật của họ (giữ hàng, xuất kho, chuyến hàng) nằm ở
 * phân hệ Cứu trợ. Bảng dưới đây gán đúng "bàn làm việc" cho từng vai trò và
 * vẫn kiểm tra quyền trước khi dùng; không thỏa thì quay về quy tắc cũ.
 */
const roleLandingPath: Partial<Record<UserRole, { path: string; permission: Permission }>> = {
  warehouse_staff: { path: "/relief/requests", permission: "relief_view" },
  relief_worker: { path: "/relief/requests", permission: "relief_view" },
  rescue_member: { path: "/tasks", permission: "task_view" },
  rescue_leader: { path: "/", permission: "view" },
};
export function landingPathForRole(
  can: NavigationPermissionCheck,
  role: UserRole,
) {
  const preferred = roleLandingPath[role];
  if (preferred && can(preferred.permission)) return preferred.path;
  return firstAccessibleNavPath(can);
}
