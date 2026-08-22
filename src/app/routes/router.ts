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
  | { name: "evacuation-list" }
  | { name: "evacuation-detail"; id: string }
  | { name: "sos-list" }
  | { name: "sos-detail"; id: string }
  | { name: "relief-request-list" }
  | { name: "relief-request-detail"; id: string }
  | { name: "warehouse-list" }
  | { name: "warehouse-detail"; id: string }
  | { name: "playbook-list" }
  | { name: "playbook-detail"; id: string }
  | { name: "playbook-execution"; id: string }
  | { name: "assessment-list" }
  | { name: "assessment-detail"; id: string }
  | { name: "recovery-project-list" }
  | { name: "recovery-project-detail"; id: string }
  | { name: "analytics-operations" }
  | { name: "analytics-resources" }
  | { name: "analytics-incidents" }
  | { name: "analytics-reports" }
  | { name: "alert-list" }
  | { name: "alert-detail"; id: string }
  | { name: "simulation" }
  | { name: "ai-assistant" }
  | { name: "operational-map"; focus: string | null }
  | { name: "profile" }
  | { name: "admin-users" }
  | { name: "admin-audit" }
  | { name: "placeholder"; label: string }
  | { name: "not-found" };
export const OPERATIONAL_MAP_WORKSPACE_LABEL = "Bản đồ tác nghiệp";
export const OPERATIONAL_MAP_WORKSPACE_PATH = `/workspace/${encodeURIComponent(
  OPERATIONAL_MAP_WORKSPACE_LABEL,
)}`;

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
  if (pathname === "/evacuations") return { name: "evacuation-list" };
  const evacuation = pathname.match(/^\/evacuations\/([^/]+)$/);
  if (evacuation)
    return {
      name: "evacuation-detail",
      id: decodeURIComponent(evacuation[1]),
    };
  if (pathname === "/sos") return { name: "sos-list" };
  const sos = pathname.match(/^\/sos\/([^/]+)$/);
  if (sos) return { name: "sos-detail", id: decodeURIComponent(sos[1]) };
  if (pathname === "/relief" || pathname === "/relief/requests")
    return { name: "relief-request-list" };
  const relief = pathname.match(/^\/relief\/requests\/([^/]+)$/);
  if (relief)
    return { name: "relief-request-detail", id: decodeURIComponent(relief[1]) };
  if (pathname === "/relief/warehouses") return { name: "warehouse-list" };
  const warehouse = pathname.match(/^\/relief\/warehouses\/([^/]+)$/);
  if (warehouse)
    return { name: "warehouse-detail", id: decodeURIComponent(warehouse[1]) };
  if (pathname === "/playbooks") return { name: "playbook-list" };
  const execution = pathname.match(/^\/playbooks\/([^/]+)\/execute$/);
  if (execution)
    return { name: "playbook-execution", id: decodeURIComponent(execution[1]) };
  const playbook = pathname.match(/^\/playbooks\/([^/]+)$/);
  if (playbook)
    return { name: "playbook-detail", id: decodeURIComponent(playbook[1]) };
  if (pathname === "/recovery" || pathname === "/recovery/assessments")
    return { name: "assessment-list" };
  const assessment = pathname.match(/^\/recovery\/assessments\/([^/]+)$/);
  if (assessment)
    return { name: "assessment-detail", id: decodeURIComponent(assessment[1]) };
  if (pathname === "/recovery/projects")
    return { name: "recovery-project-list" };
  const recoveryProject = pathname.match(/^\/recovery\/projects\/([^/]+)$/);
  if (recoveryProject)
    return {
      name: "recovery-project-detail",
      id: decodeURIComponent(recoveryProject[1]),
    };
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
  if (pathname === "/simulation" || pathname === "/simulation/red-river-flood")
    return { name: "simulation" };
  if (pathname === "/ai-assistant") return { name: "ai-assistant" };
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
  if (route.name.startsWith("shelter")) return "Điểm sơ tán";
  if (route.name.startsWith("evacuation")) return "Sơ tán";
  if (route.name.startsWith("sos")) return "SOS";
  if (route.name.startsWith("relief")) return "Phân phối cứu trợ";
  if (route.name.startsWith("playbook")) return "Kế hoạch ứng phó";
  if (
    route.name.startsWith("assessment") ||
    route.name.startsWith("recovery-project")
  )
    return "Đánh giá thiệt hại";
  if (route.name.startsWith("warehouse")) return "Kho vật tư";
  if (route.name.startsWith("alert")) return "Cảnh báo";
  if (route.name === "analytics-reports") return "Báo cáo";
  if (route.name.startsWith("analytics")) return "Phân tích tác nghiệp";
  if (route.name === "ai-assistant") return "Trợ lý AI";
  if (route.name === "operational-map") return "Bản đồ tác nghiệp";
  if (route.name === "simulation") return "Mô phỏng ứng phó";
  if (route.name === "profile") return "Hồ sơ cá nhân";
  if (route.name === "admin-audit") return "Nhật ký hệ thống";
  if (route.name.startsWith("admin")) return "Người dùng";
  if (route.name === "placeholder") return route.label;
  return "Trung tâm điều hành";
}
export function placeholderPath(label: string) {
  return `/workspace/${encodeURIComponent(label)}`;
}
