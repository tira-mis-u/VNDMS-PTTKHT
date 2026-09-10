export type AppRoute =
  | { name: "login" }
  | { name: "command-center" }
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
export function activeNavigationLabel(route: AppRoute) {
  if (route.name.startsWith("incident")) return "Sự cố";
  if (route.name.startsWith("task")) return "Nhiệm vụ";
  if (route.name.startsWith("team")) return "Đội cứu hộ";
  // Điểm sơ tán là danh mục tra cứu; công dân thấy mục "Điểm sơ tán an toàn".
  if (route.name.startsWith("shelter")) return "Điểm sơ tán";
  if (route.name.startsWith("sos")) return "SOS";
  if (route.name.startsWith("report")) return "Phản ánh";
  if (route.name === "alert-detail" || route.name === "alert-list") return "Cảnh báo";
  // Báo cáo là tab bên trong phân hệ Phân tích tác nghiệp, không còn là mục
  // điều hướng riêng nên vẫn highlight mục "Phân tích tác nghiệp" trên sidebar.
  if (route.name.startsWith("analytics")) return "Phân tích tác nghiệp";
  if (route.name === "operational-map") return "Bản đồ tác nghiệp";
  if (route.name === "operational-situation") return "Tình hình thiên tai";
  if (route.name === "operational-history") return "Lịch sử thiên tai";
  if (route.name === "operational-trends") return "Xu hướng";
  if (route.name === "profile") return "Hồ sơ cá nhân";
  if (route.name === "admin-audit") return "Nhật ký bảo mật";
  if (route.name === "admin-permissions") return "Phân quyền";
  if (route.name === "system-configuration-blocked") return "Cấu hình";
  if (route.name.startsWith("admin")) return "Người dùng";
  if (route.name === "placeholder") return route.label;
  return "Trung tâm điều hành";
}
export function placeholderPath(label: string) {
  return `/workspace/${encodeURIComponent(label)}`;
}
