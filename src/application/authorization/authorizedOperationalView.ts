import type { AuthUser } from "../../domain/auth/types";
import {
  hasPermission,
  type Permission,
} from "../../lib/permissions/permissions";
import {
  authorizeResources,
  type AuthorizationResource,
} from "../../lib/security/authorization";
import type { OperationalSnapshot } from "../operations/operationalSnapshot";
import { isPublicAlert } from "../../domain/published-alerts/rules";

function mayRead(
  user: AuthUser | null,
  permission: Permission,
  resource: AuthorizationResource,
) {
  return authorizeResources(user, { permission, resources: [resource] })
    .allowed;
}

/**
 * Bản ghi do chính tài khoản tạo (SOS/phản ánh) luôn được nhìn thấy qua
 * quyền *_own; bản ghi khác cần quyền xem toàn cục.
 */
function mayReadOwnOrAll(
  user: AuthUser | null,
  allPermission: Permission,
  ownPermission: Permission,
  resource: AuthorizationResource,
) {
  if (mayRead(user, allPermission, resource)) return true;
  return (
    resource.ownerUserId != null &&
    mayRead(user, ownPermission, resource)
  );
}

export function createAuthorizedOperationalView(
  user: AuthUser | null,
  source: OperationalSnapshot,
): OperationalSnapshot {
  const incidents = source.incidents.filter((incident) =>
    mayRead(user, "view", {
      type: "Incident",
      id: incident.id,
      geographicScope: `${incident.location.name}, ${incident.affectedArea}`,
      assignedTeamId: incident.assignedTeamId,
    }),
  );
  const incidentIds = new Set(incidents.map((item) => item.id));
  const checksIncidentRelations = Boolean(
    user && hasPermission(user.role, "view"),
  );

  const teams = source.teams.filter((team) =>
    mayRead(user, "team_view", {
      type: "Team",
      id: team.id,
      geographicScope: `${team.region}, ${team.operatingScope}`,
      assignedTeamId: team.id,
    }),
  );
  const teamIds = new Set(teams.map((item) => item.id));
  const checksTeamRelations = Boolean(
    user && hasPermission(user.role, "team_view"),
  );

  /**
   * Điểm sơ tán là danh mục tra cứu chung: công dân không có `shelter_view`
   * nhưng vẫn cần danh sách điểm an toàn (UC tra cứu). Người có quyền vẫn bị
   * lọc theo phạm vi địa lý như cũ.
   */
  const shelters =
    user && !hasPermission(user.role, "shelter_view")
      ? source.shelters
      : source.shelters.filter((shelter) =>
          mayRead(user, "shelter_view", {
            type: "Shelter",
            id: shelter.id,
            geographicScope: shelter.administrativeArea,
          }),
        );
  const shelterIds = new Set(shelters.map((item) => item.id));
  const checksShelterRelations = Boolean(
    user && hasPermission(user.role, "shelter_view"),
  );

  const tasks = source.tasks.filter((task) => {
    if (checksIncidentRelations && !incidentIds.has(task.incidentId))
      return false;
    if (checksTeamRelations && task.teamId && !teamIds.has(task.teamId))
      return false;
    return mayRead(user, "task_view", {
      type: "Task",
      id: task.id,
      geographicScope:
        source.incidents.find((item) => item.id === task.incidentId)?.location
          .name ?? task.location,
      assignedTeamId: task.teamId || null,
      lifecycleStatus: task.status,
    });
  });
  const taskIds = new Set(tasks.map((item) => item.id));

  const sosRequests = source.sosRequests.filter((sos) => {
    const own = sos.ownerUserId != null && sos.ownerUserId === user?.id;
    if (!own) {
      if (
        checksIncidentRelations &&
        sos.linkedIncidentId &&
        !incidentIds.has(sos.linkedIncidentId)
      )
        return false;
      if (
        checksTeamRelations &&
        sos.assignedTeamId &&
        !teamIds.has(sos.assignedTeamId)
      )
        return false;
      if (
        checksShelterRelations &&
        sos.shelterDestinationId &&
        !shelterIds.has(sos.shelterDestinationId)
      )
        return false;
    }
    return mayReadOwnOrAll(user, "sos_view", "sos_view_own", {
      type: "SOS",
      id: sos.id,
      geographicScope: own ? undefined : sos.location.administrativeArea,
      assignedTeamId: sos.assignedTeamId,
      ownerUserId: sos.ownerUserId,
      lifecycleStatus: sos.status,
    });
  });
  const sosIds = new Set(sosRequests.map((item) => item.id));

  const citizenReports = source.citizenReports.filter((report) => {
    const own = report.ownerUserId === user?.id;
    return mayReadOwnOrAll(user, "report_view", "report_view_own", {
      type: "CitizenReport",
      id: report.id,
      geographicScope: own ? undefined : report.location.administrativeArea,
      ownerUserId: report.ownerUserId,
      lifecycleStatus: report.status,
    });
  });
  const reportIds = new Set(citizenReports.map((item) => item.id));

  const managesPublishedAlerts = Boolean(
    user && hasPermission(user.role, "published_alert_manage"),
  );
  const publishedAlerts = source.publishedAlerts.filter((alert) => {
    if (!user || !hasPermission(user.role, "published_alert_view")) return false;
    // Người dân/đơn vị chỉ thấy bản đã công bố; cán bộ thấy cả nháp & thu hồi.
    return managesPublishedAlerts || isPublicAlert(alert);
  });
  const publishedAlertIds = new Set(publishedAlerts.map((item) => item.id));

  return {
    metadata: source.metadata,
    incidents,
    events: source.events.filter((event) => incidentIds.has(event.incidentId)),
    tasks,
    taskUpdates: source.taskUpdates.filter(
      (update) =>
        taskIds.has(update.taskId) && incidentIds.has(update.incidentId),
    ),
    taskReviews: source.taskReviews.filter((review) =>
      taskIds.has(review.taskId),
    ),
    teams,
    teamEvents: source.teamEvents.filter((event) => teamIds.has(event.teamId)),
    shelters,
    shelterEvents: source.shelterEvents.filter((event) =>
      shelterIds.has(event.shelterId),
    ),
    sosRequests,
    sosEvents: source.sosEvents.filter((event) => sosIds.has(event.sosId)),
    citizenReports,
    citizenReportEvents: source.citizenReportEvents.filter((event) =>
      reportIds.has(event.reportId),
    ),
    publishedAlerts,
    publishedAlertEvents: source.publishedAlertEvents.filter((event) =>
      publishedAlertIds.has(event.alertId),
    ),
    alertInteractions: source.alertInteractions,
    alertEvents: source.alertEvents,
  };
}
