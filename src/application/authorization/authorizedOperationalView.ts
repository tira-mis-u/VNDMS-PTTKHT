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

function mayRead(
  user: AuthUser | null,
  permission: Permission,
  resource: AuthorizationResource,
) {
  return authorizeResources(user, { permission, resources: [resource] })
    .allowed;
}

function isRescueRole(user: AuthUser | null) {
  return user?.role === "rescue_leader" || user?.role === "rescue_member";
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

  const shelters = source.shelters.filter((shelter) =>
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

  const evacuationOperations = source.evacuationOperations.filter(
    (operation) => {
      if (
        !incidentIds.has(operation.incidentId) ||
        !shelterIds.has(operation.destinationShelterId)
      )
        return false;
      if (
        checksTeamRelations &&
        operation.assignedTeamId &&
        !teamIds.has(operation.assignedTeamId)
      )
        return false;
      return mayRead(user, "evacuation_view", {
        type: "Evacuation",
        id: operation.id,
        geographicScope: operation.sourceArea,
        assignedTeamId: operation.assignedTeamId,
        lifecycleStatus: operation.status,
      });
    },
  );
  const evacuationIds = new Set(evacuationOperations.map((item) => item.id));

  const sosRequests = source.sosRequests.filter((sos) => {
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
    return mayRead(user, "sos_view", {
      type: "SOS",
      id: sos.id,
      geographicScope: sos.location.administrativeArea,
      assignedTeamId: sos.assignedTeamId,
      lifecycleStatus: sos.status,
    });
  });
  const sosIds = new Set(sosRequests.map((item) => item.id));

  const warehouses = source.warehouses.filter((warehouse) =>
    mayRead(user, "warehouse_view", {
      type: "Warehouse",
      id: warehouse.id,
      geographicScope: warehouse.administrativeArea,
      warehouseId: warehouse.id,
      lifecycleStatus: warehouse.status,
    }),
  );
  const warehouseIds = new Set(warehouses.map((item) => item.id));
  const checksEvacuationRelations = Boolean(
    user && hasPermission(user.role, "evacuation_view"),
  );

  const reliefRequests = source.reliefRequests.filter((request) => {
    if (
      checksIncidentRelations &&
      request.incidentId &&
      !incidentIds.has(request.incidentId)
    )
      return false;
    if (
      checksShelterRelations &&
      request.shelterId &&
      !shelterIds.has(request.shelterId)
    )
      return false;
    if (
      checksEvacuationRelations &&
      request.evacuationOperationId &&
      !evacuationIds.has(request.evacuationOperationId)
    )
      return false;
    if (checksTeamRelations && request.teamId && !teamIds.has(request.teamId))
      return false;
    if (user?.role === "warehouse_staff") {
      const related =
        request.assignedWarehouseIds.includes(user.warehouseId ?? "") ||
        source.reservations.some(
          (item) =>
            item.reliefRequestId === request.id &&
            item.warehouseId === user.warehouseId,
        ) ||
        source.shipments.some(
          (item) =>
            item.reliefRequestId === request.id &&
            item.warehouseId === user.warehouseId,
        );
      if (!related) return false;
    }
    if (isRescueRole(user)) {
      const related =
        request.teamId === user?.teamId ||
        source.shipments.some(
          (item) =>
            item.reliefRequestId === request.id &&
            item.assignedTeamId === user?.teamId,
        );
      if (!related) return false;
    }
    return mayRead(user, "relief_view", {
      type: "ReliefRequest",
      id: request.id,
      geographicScope: request.destination,
      assignedTeamId: request.teamId,
      warehouseIds: request.assignedWarehouseIds,
      lifecycleStatus: request.status,
    });
  });
  const reliefRequestIds = new Set(reliefRequests.map((item) => item.id));

  const reservations = source.reservations.filter(
    (reservation) =>
      reliefRequestIds.has(reservation.reliefRequestId) &&
      warehouseIds.has(reservation.warehouseId),
  );
  const shipments = source.shipments.filter((shipment) => {
    if (
      !reliefRequestIds.has(shipment.reliefRequestId) ||
      !warehouseIds.has(shipment.warehouseId)
    )
      return false;
    if (isRescueRole(user) && shipment.assignedTeamId !== user?.teamId)
      return false;
    return mayRead(user, "shipment_view", {
      type: "Shipment",
      id: shipment.id,
      geographicScope: shipment.destination,
      assignedTeamId: shipment.assignedTeamId,
      warehouseId: shipment.warehouseId,
      lifecycleStatus: shipment.status,
    });
  });
  const shipmentIds = new Set(shipments.map((item) => item.id));

  const playbooks = source.playbooks.filter((playbook) =>
    mayRead(user, "playbook_view", {
      type: "Playbook",
      id: playbook.id,
      geographicScope: playbook.geographicScope,
      lifecycleStatus: playbook.status,
    }),
  );
  const playbookIds = new Set(playbooks.map((item) => item.id));
  const playbookExecutions = source.playbookExecutions.filter(
    (execution) =>
      playbookIds.has(execution.playbookId) &&
      incidentIds.has(execution.incidentId),
  );
  const executionIds = new Set(playbookExecutions.map((item) => item.id));

  const damageAssessments = source.damageAssessments.filter(
    (assessment) =>
      incidentIds.has(assessment.incidentId) &&
      mayRead(user, "damage_assessment_view", {
        type: "DamageAssessment",
        id: assessment.id,
        geographicScope: assessment.geographicScope,
        lifecycleStatus: assessment.status,
      }),
  );
  const assessmentIds = new Set(damageAssessments.map((item) => item.id));

  const recoveryProjects = source.recoveryProjects.filter((project) => {
    if (!incidentIds.has(project.incidentId)) return false;
    if (project.assessmentIds.some((id) => !assessmentIds.has(id)))
      return false;
    if (
      isRescueRole(user) &&
      project.assignedTeamIds.length &&
      !project.assignedTeamIds.includes(user?.teamId ?? "")
    )
      return false;
    return mayRead(user, "recovery_project_view", {
      type: "RecoveryProject",
      id: project.id,
      geographicScope: project.geographicScope,
      assignedTeamId:
        project.assignedTeamIds.length === 1
          ? project.assignedTeamIds[0]
          : null,
      lifecycleStatus: project.status,
    });
  });
  const recoveryProjectIds = new Set(recoveryProjects.map((item) => item.id));

  return {
    metadata: source.metadata,
    incidents,
    events: source.events.filter((event) => incidentIds.has(event.incidentId)),
    tasks,
    taskUpdates: source.taskUpdates.filter(
      (update) =>
        taskIds.has(update.taskId) && incidentIds.has(update.incidentId),
    ),
    teams,
    teamEvents: source.teamEvents.filter((event) => teamIds.has(event.teamId)),
    shelters,
    shelterEvents: source.shelterEvents.filter((event) =>
      shelterIds.has(event.shelterId),
    ),
    evacuationOperations,
    evacuationEvents: source.evacuationEvents.filter((event) =>
      evacuationIds.has(event.operationId),
    ),
    sosRequests,
    sosEvents: source.sosEvents.filter((event) => sosIds.has(event.sosId)),
    warehouses,
    inventory: source.inventory.filter((item) =>
      warehouseIds.has(item.warehouseId),
    ),
    reliefRequests,
    reservations,
    shipments,
    reliefEvents: source.reliefEvents.filter((event) =>
      event.entityType === "request"
        ? reliefRequestIds.has(event.entityId)
        : event.entityType === "warehouse"
          ? warehouseIds.has(event.entityId)
          : shipmentIds.has(event.entityId),
    ),
    playbooks,
    playbookExecutions,
    playbookEvents: source.playbookEvents.filter(
      (event) =>
        playbookIds.has(event.playbookId) &&
        (!event.executionId || executionIds.has(event.executionId)) &&
        (!event.incidentId || incidentIds.has(event.incidentId)),
    ),
    damageAssessments,
    recoveryProjects,
    recoveryEvents: source.recoveryEvents.filter(
      (event) =>
        incidentIds.has(event.incidentId) &&
        (event.entityType === "assessment"
          ? assessmentIds.has(event.entityId)
          : recoveryProjectIds.has(event.entityId)),
    ),
    alertInteractions: source.alertInteractions,
    alertEvents: source.alertEvents,
  };
}
