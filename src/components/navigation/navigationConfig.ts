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
      // SOS + Phản ánh GỘP MỘT hàng đợi tiếp nhận: cùng người gửi, cùng vị trí,
      // cùng vòng đời tiếp nhận → xác minh → điều phối. Tách hai mục khiến cán
      // bộ trực phải đảo qua lại và dễ sót phản ánh đang leo thang thành SOS.
      // Đứng đầu nhóm vì đây là mục duy nhất mà độ trễ tính bằng mạng người.
      { label: "Tiếp nhận yêu cầu", icon: Radio, path: "/sos", permission: "sos_view" },
      { label: "Nhiệm vụ", icon: ListTodo, badge: "9", path: "/tasks", permission: "task_view" },
      { label: "Đội cứu hộ", icon: LifeBuoy, path: "/teams", permission: "team_view" },
      // Điểm sơ tán GIỮ MỤC RIÊNG (quyết định sau tranh luận — xem ghi chú cuối
      // file): nó là danh mục tra cứu, không phải hàng đợi cần xử lý.
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
      { label: "Trang chủ", icon: Home, path: "/", permission: "sos_create" },
      { label: "Bản đồ tác nghiệp", icon: MapPinned, path: "/map", permission: "sos_create" },
      { label: "Yêu cầu của tôi", icon: Radio, path: "/my-requests", permission: "sos_create" },
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

/**
 * TRANH LUẬN: ĐIỂM SƠ TÁN ĐẶT Ở ĐÂU SAU KHI GỘP SOS + PHẢN ÁNH?
 * ─────────────────────────────────────────────────────────────
 * - Phương án A (gộp vào hàng đợi tiếp nhận): ❌ loại. Hàng đợi là nơi "việc
 *   đang chờ xử lý" (tiếp nhận → xác minh → điều phối); điểm sơ tán là danh
 *   mục tra cứu tĩnh (mở/đóng/sức chứa). Trộn hai nhịp khác nhau vào một danh
 *   sách sẽ làm cán bộ lẫn lộn "cái nào cần làm ngay".
 * - Phương án B (nhét vào Cổng công dân, bỏ mục riêng): ❌ loại. Lực lượng cần
 *   tra cứu nhanh điểm còn chỗ khi điều phối SOS; giấu trong cổng dân thì mỗi
 *   lần điều phối phải thoát vai — thêm thao tác trong lúc khẩn cấp.
 * - Phương án C (giữ mục riêng trong nhóm Ứng phó): ✅ chọn. Điểm sơ tán là
 *   "hạ tầng của pha ứng phó" (nơi nhận người từ SOS/nhiệm vụ), đặt cạnh Đội
 *   cứu hộ là đúng nhịp công việc: tiếp nhận → giao nhiệm vụ → điều đội → đưa
 *   dân tới điểm. Không thêm nhóm mới, không phá thói quen điều hướng cũ.
 */
