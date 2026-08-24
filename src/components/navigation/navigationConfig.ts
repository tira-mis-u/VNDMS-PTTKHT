import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FileBarChart,
  FileClock,
  FlaskConical,
  History,
  Home,
  LifeBuoy,
  ListTodo,
  LockKeyhole,
  Map,
  PackageOpen,
  Radio,
  Settings,
  Siren,
  Truck,
  Users,
  Warehouse,
  Waves,
} from "lucide-react";
import type { Permission } from "@/lib/permissions/permissions";
import {
  CONFIGURATION_WORKSPACE_PATH,
  HISTORY_WORKSPACE_PATH,
  PERMISSIONS_WORKSPACE_PATH,
  RECONSTRUCTION_WORKSPACE_PATH,
  SITUATION_WORKSPACE_PATH,
  TRENDS_WORKSPACE_PATH,
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
    label: "Quản lý & điều hành",
    items: [
      { label: "Trung tâm điều hành", icon: Home, path: "/", permission: "view" },
      { label: "Tình hình thiên tai", icon: Waves, path: SITUATION_WORKSPACE_PATH, permission: "view" },
      { label: "Bản đồ tác nghiệp", icon: Map, path: `/workspace/${encodeURIComponent("Bản đồ tác nghiệp")}`, permission: "view" },
      { label: "Cảnh báo", icon: Bell, path: "/alerts", permission: "alert_view" },
      { label: "Sự cố", icon: Siren, badge: "6", path: "/incidents", permission: "view" },
    ],
  },
  {
    label: "Ứng phó",
    items: [
      { label: "Phương án ứng phó", icon: CalendarCheck, path: "/playbooks", permission: "playbook_view" },
      { label: "Nhiệm vụ", icon: ListTodo, badge: "9", path: "/tasks", permission: "task_view" },
      { label: "Đội cứu hộ", icon: LifeBuoy, path: "/teams", permission: "team_view" },
      { label: "Sơ tán", icon: Truck, path: "/evacuations", permission: "evacuation_view" },
      { label: "SOS", icon: Radio, path: "/sos", permission: "sos_view" },
    ],
  },
  {
    label: "Nguồn lực",
    items: [
      { label: "Điểm sơ tán", icon: Building2, path: "/shelters", permission: "shelter_view" },
      { label: "Kho vật tư", icon: Warehouse, path: "/relief/warehouses", permission: "warehouse_view" },
      { label: "Phân phối cứu trợ", icon: PackageOpen, path: "/relief", permission: "relief_view" },
    ],
  },
  {
    label: "Phục hồi",
    items: [
      { label: "Đánh giá thiệt hại", icon: ClipboardCheck, path: "/recovery", permission: "damage_assessment_view" },
      { label: "Tái thiết", icon: Boxes, path: RECONSTRUCTION_WORKSPACE_PATH, permission: "recovery_project_view" },
    ],
  },
  {
    label: "Phân tích",
    items: [
      { label: "Phân tích tác nghiệp", icon: BarChart3, path: "/analytics", permission: "view" },
      { label: "Báo cáo tác nghiệp", icon: FileBarChart, path: "/analytics/reports", permission: "view" },
      { label: "Mô phỏng ứng phó", icon: FlaskConical, path: "/simulation", permission: "simulation_view" },
      { label: "Lịch sử thiên tai", icon: History, path: HISTORY_WORKSPACE_PATH, permission: "view" },
      { label: "Xu hướng", icon: Activity, path: TRENDS_WORKSPACE_PATH, permission: "view" },
    ],
  },
  {
    label: "Hỗ trợ",
    items: [{ label: "Trợ lý AI", icon: Bot, path: "/ai-assistant", permission: "ai_assistant_use" }],
  },
  {
    label: "Quản trị",
    admin: true,
    items: [
      { label: "Người dùng", icon: Users, path: "/admin/users", permission: "user_manage" },
      { label: "Phân quyền", icon: LockKeyhole, path: PERMISSIONS_WORKSPACE_PATH, permission: "user_manage" },
      { label: "Nhật ký bảo mật", icon: FileClock, path: "/admin/audit", permission: "audit_view" },
      { label: "Cấu hình", icon: Settings, path: CONFIGURATION_WORKSPACE_PATH, permission: "user_manage" },
    ],
  },
];
export function findNavigationItem(label: string) {
  for (const group of navigationGroups) {
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
export function visibleNavigationGroups(can: NavigationPermissionCheck) {
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
