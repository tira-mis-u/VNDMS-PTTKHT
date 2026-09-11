import type { UserRole } from "@/domain/shared/auth";

export type AppRoute =
  | { name: "login" }
  | { name: "command-center" }
  | { name: "citizen-map" }
  | { name: "citizen-requests" }
  | { name: "incident-list" }
  | { name: "incident-detail"; id: string }
  | { name: "task-list" }
  | { name: "task-detail"; id: string }
  | { name: "team-list" }
  | { name: "team-detail"; id: string }
  | { name: "shelter-list" }
  | { name: "shelter-detail"; id: string }
  | { name: "sos-list" }
  | { name: "sos-detail"; id: string }
  | { name: "report-list" }
  | { name: "analytics-operations" }
  | { name: "analytics-resources" }
  | { name: "analytics-incidents" }
  | { name: "analytics-reports" }
  | { name: "alert-list" }
  | { name: "alert-detail"; id: string }
  | { name: "operational-map"; focus: string | null }
  | { name: "operational-situation" }
  | { name: "operational-history" }
  | { name: "operational-trends" }
  | { name: "profile" }
  | { name: "admin-users" }
  | { name: "admin-permissions" }
  | { name: "admin-audit" }
  | { name: "system-configuration-blocked" }
  | { name: "placeholder"; label: string }
  | { name: "not-found" };
export const OPERATIONAL_MAP_WORKSPACE_LABEL = "Bản đồ tác nghiệp";
export const OPERATIONAL_MAP_WORKSPACE_PATH = `/workspace/${encodeURIComponent(
  OPERATIONAL_MAP_WORKSPACE_LABEL,
)}`;
export const SITUATION_WORKSPACE_PATH = `/workspace/${encodeURIComponent("Tình hình thiên tai")}`;
export const HISTORY_WORKSPACE_PATH = `/workspace/${encodeURIComponent("Lịch sử thiên tai")}`;
export const TRENDS_WORKSPACE_PATH = `/workspace/${encodeURIComponent("Xu hướng")}`;
export const PERMISSIONS_WORKSPACE_PATH = `/workspace/${encodeURIComponent("Phân quyền")}`;
export const CONFIGURATION_WORKSPACE_PATH = `/workspace/${encodeURIComponent("Cấu hình")}`;
export function operationalMapFocusPath(entityId: string) {
  return `${OPERATIONAL_MAP_WORKSPACE_PATH}?focus=${encodeURIComponent(entityId)}`;
}

export function parseRoute(pathname: string, search = ""): AppRoute {
  if (pathname === "/login") return { name: "login" };
  if (pathname === "/" || pathname === "/command")
    return { name: "command-center" };
  // Trang riêng của Cổng công dân: bản đồ tác nghiệp + dòng thời gian yêu cầu.
  if (pathname === "/map") return { name: "citizen-map" };
  if (pathname === "/my-requests") return { name: "citizen-requests" };
  if (pathname === "/incidents") return { name: "incident-list" };
  const incident = pathname.match(/^\/incidents\/([^/]+)$/);
  if (incident)
    return { name: "incident-detail", id: decodeURIComponent(incident[1]) };
  if (pathname === "/tasks") return { name: "task-list" };
  const task = pathname.match(/^\/tasks\/([^/]+)$/);
  if (task) return { name: "task-detail", id: decodeURIComponent(task[1]) };
  if (pathname === "/teams") return { name: "team-list" };
  const team = pathname.match(/^\/teams\/([^/]+)$/);
  if (team) return { name: "team-detail", id: decodeURIComponent(team[1]) };
  if (pathname === "/shelters") return { name: "shelter-list" };
  const shelter = pathname.match(/^\/shelters\/([^/]+)$/);
  if (shelter)
    return { name: "shelter-detail", id: decodeURIComponent(shelter[1]) };
  if (pathname === "/sos") return { name: "sos-list" };
  const sos = pathname.match(/^\/sos\/([^/]+)$/);
  if (sos) return { name: "sos-detail", id: decodeURIComponent(sos[1]) };
  if (pathname === "/reports") return { name: "report-list" };
  if (pathname === "/analytics" || pathname === "/analytics/operations")
    return { name: "analytics-operations" };
  if (pathname === "/analytics/resources")
    return { name: "analytics-resources" };
  if (pathname === "/analytics/incidents")
    return { name: "analytics-incidents" };
  if (pathname === "/analytics/reports") return { name: "analytics-reports" };
  if (pathname === "/alerts") return { name: "alert-list" };
  const alert = pathname.match(/^\/alerts\/([^/]+)$/);
  if (alert) return { name: "alert-detail", id: decodeURIComponent(alert[1]) };
  if (pathname === "/profile") return { name: "profile" };
  if (pathname === "/admin" || pathname === "/admin/users")
    return { name: "admin-users" };
  if (pathname === "/admin/audit") return { name: "admin-audit" };
  const workspace = pathname.match(/^\/workspace\/(.+)$/);
  if (workspace) {
    const label = decodeURIComponent(workspace[1]);
    if (label === OPERATIONAL_MAP_WORKSPACE_LABEL) {
      const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
      );
      return { name: "operational-map", focus: params.get("focus") };
    }
    if (label === "Tình hình thiên tai") return { name: "operational-situation" };
    if (label === "Lịch sử thiên tai") return { name: "operational-history" };
    if (label === "Xu hướng") return { name: "operational-trends" };
    if (label === "Phân quyền") return { name: "admin-permissions" };
    if (label === "Cấu hình") return { name: "system-configuration-blocked" };
    return {
      name: "placeholder",
      label,
    };
  }
  return { name: "not-found" };
}
/**
 * Nhãn mục sidebar đang mở — PHẢI khớp đúng nhãn trong navigationConfig thì
 * mục mới được tô sáng (.nav-item.active). Vì nhãn của công dân khác nhãn nội
 * bộ (vd "Trang chủ" thay vì "Trung tâm điều hành") nên hàm nhận thêm vai trò
 * để trả nhãn đúng cho từng đối tượng.
 */
export function activeNavigationLabel(route: AppRoute, role?: UserRole) {
  const citizen = role === "citizen";
  if (route.name.startsWith("incident")) return "Sự cố";
  if (route.name.startsWith("task")) return "Nhiệm vụ";
  if (route.name.startsWith("team")) return "Đội cứu hộ";
  // Điểm sơ tán là danh mục tra cứu; công dân thấy mục "Điểm sơ tán an toàn".
  if (route.name.startsWith("shelter")) return citizen ? "Điểm sơ tán an toàn" : "Điểm sơ tán";
  if (route.name.startsWith("sos")) return "Tiếp nhận yêu cầu";
  if (route.name.startsWith("report")) return "Tiếp nhận yêu cầu";
  if (route.name === "alert-detail" || route.name === "alert-list")
    return citizen ? "Cảnh báo thiên tai" : "Cảnh báo";
  // Báo cáo là tab bên trong phân hệ Phân tích tác nghiệp, không còn là mục
  // điều hướng riêng nên vẫn highlight mục "Phân tích tác nghiệp" trên sidebar.
  if (route.name.startsWith("analytics")) return "Phân tích tác nghiệp";
  if (route.name === "operational-map") return "Bản đồ tác nghiệp";
  // "Tình hình thiên tai" là tab thứ hai BÊN TRONG Trung tâm điều hành (không
  // còn mục sidebar riêng) nên phải highlight "Trung tâm điều hành".
  if (route.name === "operational-situation")
    return citizen ? "Trang chủ" : "Trung tâm điều hành";
  if (route.name === "operational-history") return "Phân tích tác nghiệp";
  if (route.name === "operational-trends") return "Phân tích tác nghiệp";
  if (route.name === "profile") return citizen ? "Hồ sơ & Địa bàn" : "Hồ sơ cá nhân";
  if (route.name === "admin-audit") return "Nhật ký bảo mật";
  if (route.name === "admin-permissions") return "Phân quyền";
  // /admin/users giữ nhãn "Người dùng" theo hợp đồng test (không có mục
  // sidebar trùng tên nên trang này không highlight — đúng vì nó không nằm
  // trong điều hướng; vào trang Phân quyền để thấy mục sáng).
  if (route.name === "system-configuration-blocked") return "Cấu hình";
  if (route.name.startsWith("admin")) return "Người dùng";
  if (route.name === "placeholder") return route.label;
  // Trang riêng của Cổng công dân — nhãn trùng mục sidebar của công dân.
  if (route.name === "citizen-map") return "Bản đồ tác nghiệp";
  if (route.name === "citizen-requests")
    return citizen ? "Yêu cầu của tôi" : "Tiếp nhận yêu cầu";
  if (route.name === "command-center" || route.name === "login")
    return citizen ? "Trang chủ" : "Trung tâm điều hành";
  return "Trung tâm điều hành";
}
export function placeholderPath(label: string) {
  return `/workspace/${encodeURIComponent(label)}`;
}
