import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { NotFoundPage } from "@/components/shared/NotFoundPage";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import { AccessDeniedPage } from "@/features/auth/pages/AccessDeniedPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";

const CommandCenter = lazy(() =>
  import("@/features/command-center").then((module) => ({
    default: module.CommandCenter,
  })),
);
const OperationalMapWorkspacePage = lazy(() =>
  import("@/features/operational-map").then((module) => ({
    default: module.OperationalMapWorkspacePage,
  })),
);
const IncidentListPage = lazy(() =>
  import("@/features/incidents").then((module) => ({
    default: module.IncidentListPage,
  })),
);
const IncidentDetailPage = lazy(() =>
  import("@/features/incidents").then((module) => ({
    default: module.IncidentDetailPage,
  })),
);
const TaskListPage = lazy(() =>
  import("@/features/tasks").then((module) => ({
    default: module.TaskListPage,
  })),
);
const TaskDetailPage = lazy(() =>
  import("@/features/tasks").then((module) => ({
    default: module.TaskDetailPage,
  })),
);
const TeamListPage = lazy(() =>
  import("@/features/teams").then((module) => ({
    default: module.TeamListPage,
  })),
);
const TeamDetailPage = lazy(() =>
  import("@/features/teams").then((module) => ({
    default: module.TeamDetailPage,
  })),
);
const ShelterListPage = lazy(() =>
  import("@/features/shelters").then((module) => ({
    default: module.ShelterListPage,
  })),
);
const ShelterDetailPage = lazy(() =>
  import("@/features/shelters").then((module) => ({
    default: module.ShelterDetailPage,
  })),
);
const SosListPage = lazy(() =>
  import("@/features/sos").then((module) => ({ default: module.SosListPage })),
);
const SosDetailPage = lazy(() =>
  import("@/features/sos").then((module) => ({
    default: module.SosDetailPage,
  })),
);
const ReliefRequestListPage = lazy(() =>
  import("@/features/relief").then((module) => ({
    default: module.ReliefRequestListPage,
  })),
);
const ReliefRequestDetailPage = lazy(() =>
  import("@/features/relief").then((module) => ({
    default: module.ReliefRequestDetailPage,
  })),
);
const WarehouseListPage = lazy(() =>
  import("@/features/relief").then((module) => ({
    default: module.WarehouseListPage,
  })),
);
const WarehouseDetailPage = lazy(() =>
  import("@/features/relief").then((module) => ({
    default: module.WarehouseDetailPage,
  })),
);
const PlaybookListPage = lazy(() =>
  import("@/features/playbooks").then((module) => ({
    default: module.PlaybookListPage,
  })),
);
const PlaybookDetailPage = lazy(() =>
  import("@/features/playbooks").then((module) => ({
    default: module.PlaybookDetailPage,
  })),
);
const PlaybookExecutionPage = lazy(() =>
  import("@/features/playbooks").then((module) => ({
    default: module.PlaybookExecutionPage,
  })),
);
const DamageAssessmentListPage = lazy(() =>
  import("@/features/recovery").then((module) => ({
    default: module.DamageAssessmentListPage,
  })),
);
const DamageAssessmentDetailPage = lazy(() =>
  import("@/features/recovery").then((module) => ({
    default: module.DamageAssessmentDetailPage,
  })),
);
const RecoveryProjectListPage = lazy(() =>
  import("@/features/recovery").then((module) => ({
    default: module.RecoveryProjectListPage,
  })),
);
const RecoveryProjectDetailPage = lazy(() =>
  import("@/features/recovery").then((module) => ({
    default: module.RecoveryProjectDetailPage,
  })),
);
const OperationalAnalyticsPage = lazy(() =>
  import("@/features/analytics").then((module) => ({
    default: module.OperationalAnalyticsPage,
  })),
);
const ResourceAnalyticsPage = lazy(() =>
  import("@/features/analytics").then((module) => ({
    default: module.ResourceAnalyticsPage,
  })),
);
const IncidentAnalyticsPage = lazy(() =>
  import("@/features/analytics").then((module) => ({
    default: module.IncidentAnalyticsPage,
  })),
);
const OperationalReportsPage = lazy(() =>
  import("@/features/analytics").then((module) => ({
    default: module.OperationalReportsPage,
  })),
);
const EvacuationListPage = lazy(() =>
  import("@/features/evacuations").then((module) => ({
    default: module.EvacuationListPage,
  })),
);
const EvacuationDetailPage = lazy(() =>
  import("@/features/evacuations").then((module) => ({
    default: module.EvacuationDetailPage,
  })),
);
const AlertListPage = lazy(() =>
  import("@/features/alerts").then((module) => ({
    default: module.AlertListPage,
  })),
);
const AlertDetailPage = lazy(() =>
  import("@/features/alerts").then((module) => ({
    default: module.AlertDetailPage,
  })),
);
const SimulationPage = lazy(() =>
  import("@/features/simulation").then((module) => ({
    default: module.SimulationPage,
  })),
);
const AiAssistantPage = lazy(() =>
  import("@/features/ai-assistant").then((module) => ({
    default: module.AiAssistantPage,
  })),
);
const OperationalSituationPage = lazy(() =>
  import("@/features/operational-insights").then((module) => ({ default: module.OperationalSituationPage })),
);
const OperationalHistoryPage = lazy(() =>
  import("@/features/operational-insights").then((module) => ({ default: module.OperationalHistoryPage })),
);
const OperationalTrendsPage = lazy(() =>
  import("@/features/operational-insights").then((module) => ({ default: module.OperationalTrendsPage })),
);
const SystemConfigurationBlockedPage = lazy(() =>
  import("@/features/operational-insights").then((module) => ({ default: module.SystemConfigurationBlockedPage })),
);
const ProfilePage = lazy(() =>
  import("@/features/auth/pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
const UserManagementPage = lazy(() =>
  import("@/features/auth/pages/UserManagementPage").then((module) => ({
    default: module.UserManagementPage,
  })),
);
const AuditTrailPage = lazy(() =>
  import("@/features/auth/pages/AuditTrailPage").then((module) => ({
    default: module.AuditTrailPage,
  })),
);
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import type { Permission } from "@/lib/permissions/permissions";
import { permissionLabel } from "@/lib/permissions/labels";
import { authorize } from "@/lib/security/authorization";
import { firstAccessibleNavPath } from "@/components/navigation/navigationConfig";
import {
  activeNavigationLabel,
  type AppRoute,
  parseRoute,
  placeholderPath,
} from "./routes/router";
function requiredPermission(route: AppRoute): Permission {
  if (
    route.name === "command-center" ||
    route.name === "operational-map" ||
    route.name.startsWith("incident") ||
    route.name.startsWith("analytics") ||
    route.name.startsWith("operational-") ||
    route.name === "placeholder"
  )
    return "view";
  if (route.name.startsWith("task")) return "task_view";
  if (route.name.startsWith("team")) return "team_view";
  if (route.name.startsWith("shelter")) return "shelter_view";
  if (route.name.startsWith("evacuation")) return "evacuation_view";
  if (route.name.startsWith("sos")) return "sos_view";
  if (route.name.startsWith("relief")) return "relief_view";
  if (route.name.startsWith("warehouse")) return "warehouse_view";
  if (route.name.startsWith("playbook")) return "playbook_view";
  if (route.name.startsWith("assessment")) return "damage_assessment_view";
  if (route.name.startsWith("recovery-project")) return "recovery_project_view";
  if (route.name.startsWith("alert")) return "alert_view";
  if (route.name === "simulation") return "simulation_view";
  if (route.name === "ai-assistant") return "ai_assistant_use";
  if (route.name === "admin-users" || route.name === "admin-permissions" || route.name === "system-configuration-blocked") return "user_manage";
  if (route.name === "admin-audit") return "audit_view";
  return "view";
}
export default function App() {
  const store = useOperationalState();
  const [locationPath, setLocationPath] = useState(
    window.location.pathname + window.location.search,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const route = useMemo(() => {
    const url = new URL(locationPath, window.location.origin);
    return parseRoute(url.pathname, url.search);
  }, [locationPath]);
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    const url = new URL(path, window.location.origin);
    setLocationPath(url.pathname + url.search);
    document
      .querySelector(".workspace")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const onPop = () =>
      setLocationPath(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  if (!store.session || !store.currentUser)
    return (
      <LoginPage
        onSuccess={(user) =>
          // Vai trò không có quyền xem Trung tâm điều hành được đưa thẳng tới
          // module đầu tiên được phân quyền thay vì gặp màn hình từ chối.
          navigate(
            firstAccessibleNavPath(
              (permission) => authorize(user, permission).allowed,
            ),
          )
        }
      />
    );
  const selectModule = (label: string, path?: string) =>
    navigate(path ?? placeholderPath(label));
  let content;
  if (route.name === "login") content = <CommandCenter navigate={navigate} />;
  else if (route.name === "profile") content = <ProfilePage />;
  else if (!store.can(requiredPermission(route)))
    content = (
      <AccessDeniedPage
        navigate={navigate}
        reason={`Tài khoản ${store.currentUser.displayName} chưa được cấp quyền “${permissionLabel(requiredPermission(route))}” cho chức năng này.`}
      />
    );
  else if (route.name === "command-center")
    content = <CommandCenter navigate={navigate} />;
  else if (route.name === "incident-list")
    content = <IncidentListPage navigate={navigate} />;
  else if (route.name === "incident-detail")
    content = <IncidentDetailPage id={route.id} navigate={navigate} />;
  else if (route.name === "task-list")
    content = <TaskListPage navigate={navigate} />;
  else if (route.name === "task-detail")
    content = <TaskDetailPage id={route.id} navigate={navigate} />;
  else if (route.name === "team-list")
    content = <TeamListPage navigate={navigate} />;
  else if (route.name === "team-detail")
    content = <TeamDetailPage id={route.id} navigate={navigate} />;
  else if (route.name === "shelter-list")
    content = <ShelterListPage navigate={navigate} />;
  else if (route.name === "shelter-detail")
    content = <ShelterDetailPage id={route.id} navigate={navigate} />;
  else if (route.name === "evacuation-list")
    content = <EvacuationListPage navigate={navigate} />;
  else if (route.name === "evacuation-detail")
    content = <EvacuationDetailPage id={route.id} navigate={navigate} />;
  else if (route.name === "sos-list")
    content = <SosListPage navigate={navigate} />;
  else if (route.name === "sos-detail")
    content = <SosDetailPage id={route.id} navigate={navigate} />;
  else if (route.name === "relief-request-list")
    content = <ReliefRequestListPage navigate={navigate} />;
  else if (route.name === "relief-request-detail")
    content = (
      <ReliefRequestDetailPage requestId={route.id} navigate={navigate} />
    );
  else if (route.name === "warehouse-list")
    content = <WarehouseListPage navigate={navigate} />;
  else if (route.name === "warehouse-detail")
    content = (
      <WarehouseDetailPage warehouseId={route.id} navigate={navigate} />
    );
  else if (route.name === "playbook-list")
    content = <PlaybookListPage navigate={navigate} />;
  else if (route.name === "playbook-detail")
    content = <PlaybookDetailPage playbookId={route.id} navigate={navigate} />;
  else if (route.name === "playbook-execution")
    content = (
      <PlaybookExecutionPage playbookId={route.id} navigate={navigate} />
    );
  else if (route.name === "assessment-list")
    content = <DamageAssessmentListPage navigate={navigate} />;
  else if (route.name === "assessment-detail")
    content = (
      <DamageAssessmentDetailPage assessmentId={route.id} navigate={navigate} />
    );
  else if (route.name === "recovery-project-list")
    content = <RecoveryProjectListPage navigate={navigate} />;
  else if (route.name === "recovery-project-detail")
    content = (
      <RecoveryProjectDetailPage projectId={route.id} navigate={navigate} />
    );
  else if (route.name === "analytics-operations")
    content = <OperationalAnalyticsPage navigate={navigate} />;
  else if (route.name === "analytics-incidents")
    content = <IncidentAnalyticsPage navigate={navigate} />;
  else if (route.name === "analytics-resources")
    content = <ResourceAnalyticsPage navigate={navigate} />;
  else if (route.name === "analytics-reports")
    content = <OperationalReportsPage navigate={navigate} />;
  else if (route.name === "alert-list")
    content = <AlertListPage navigate={navigate} />;
  else if (route.name === "alert-detail")
    content = <AlertDetailPage alertKey={route.id} navigate={navigate} />;
  else if (route.name === "simulation")
    content = <SimulationPage navigate={navigate} />;
  else if (route.name === "ai-assistant")
    content = <AiAssistantPage navigate={navigate} />;
  else if (route.name === "admin-users")
    content = <UserManagementPage navigate={navigate} />;
  else if (route.name === "admin-permissions")
    content = <UserManagementPage navigate={navigate} mode="permissions" />;
  else if (route.name === "admin-audit")
    content = <AuditTrailPage navigate={navigate} />;
  else if (route.name === "operational-map")
    content = <OperationalMapWorkspacePage navigate={navigate} focus={route.focus} />;
  else if (route.name === "operational-situation")
    content = <OperationalSituationPage navigate={navigate} />;
  else if (route.name === "operational-history")
    content = <OperationalHistoryPage navigate={navigate} />;
  else if (route.name === "operational-trends")
    content = <OperationalTrendsPage navigate={navigate} />;
  else if (route.name === "system-configuration-blocked")
    content = <SystemConfigurationBlockedPage />;
  else if (route.name === "placeholder")
    content = <PlaceholderPage title={route.label} />;
  else content = <NotFoundPage navigate={navigate} />;
  return (
    <div className="app-shell">
      <AppHeader openMobile={() => setMobileOpen(true)} navigate={navigate} />
      <div className="app-body">
        <AppSidebar
          active={activeNavigationLabel(route)}
          onSelect={selectModule}
          mobileOpen={mobileOpen}
          closeMobile={() => setMobileOpen(false)}
        />
        <div className="workspace">
          <Suspense
            fallback={
              <div className="workspace-content route-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                Đang tải không gian tác nghiệp…
              </div>
            }
          >
            {content}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
