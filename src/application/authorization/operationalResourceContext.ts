import type { OperationalSnapshot } from "../operations/operationalSnapshot";
import type { AuthorizationResource } from "../../lib/security/authorization";

export function createOperationalResourceContext(
  read: () => OperationalSnapshot,
) {
  const missing = (): never => {
    throw new Error("Không tìm thấy tài nguyên tác nghiệp.");
  };
  const incident = (id: string): AuthorizationResource => {
    const value = read().incidents.find((item) => item.id === id) ?? missing();
    return {
      type: "Incident",
      id,
      geographicScope: `${value.location.name}, ${value.affectedArea}`,
      assignedTeamId: value.assignedTeamId,
      lifecycleStatus: value.status,
    };
  };
  const team = (id: string): AuthorizationResource => {
    const value = read().teams.find((item) => item.id === id) ?? missing();
    return {
      type: "Team",
      id,
      geographicScope: `${value.region}, ${value.operatingScope}`,
      assignedTeamId: value.id,
      lifecycleStatus: value.status,
    };
  };
  const task = (id: string): AuthorizationResource[] => {
    const snapshot = read();
    const value = snapshot.tasks.find((item) => item.id === id) ?? missing();
    return [
      {
        type: "Task",
        id,
        geographicScope:
          snapshot.incidents.find((item) => item.id === value.incidentId)
            ?.location.name ?? value.location,
        assignedTeamId: value.teamId || null,
        lifecycleStatus: value.status,
      },
      incident(value.incidentId),
      ...(value.teamId ? [team(value.teamId)] : []),
    ];
  };
  const shelter = (id: string): AuthorizationResource => {
    const value = read().shelters.find((item) => item.id === id) ?? missing();
    return {
      type: "Shelter",
      id,
      geographicScope: value.administrativeArea,
      lifecycleStatus: value.status,
    };
  };
  const evacuation = (id: string): AuthorizationResource[] => {
    const value =
      read().evacuationOperations.find((item) => item.id === id) ?? missing();
    return [
      {
        type: "Evacuation",
        id,
        geographicScope: value.sourceArea,
        assignedTeamId: value.assignedTeamId,
        lifecycleStatus: value.status,
      },
      incident(value.incidentId),
      shelter(value.destinationShelterId),
      ...(value.assignedTeamId ? [team(value.assignedTeamId)] : []),
    ];
  };
  const sos = (id: string): AuthorizationResource => {
    const value =
      read().sosRequests.find((item) => item.id === id) ?? missing();
    return {
      type: "SOS",
      id,
      geographicScope: value.location.administrativeArea,
      assignedTeamId: value.assignedTeamId,
      lifecycleStatus: value.status,
    };
  };
  const warehouse = (id: string): AuthorizationResource => {
    const value = read().warehouses.find((item) => item.id === id) ?? missing();
    return {
      type: "Warehouse",
      id,
      geographicScope: value.administrativeArea,
      warehouseId: id,
      lifecycleStatus: value.status,
    };
  };
  const reliefRequest = (id: string): AuthorizationResource => {
    const value =
      read().reliefRequests.find((item) => item.id === id) ?? missing();
    return {
      type: "ReliefRequest",
      id,
      geographicScope: value.destination,
      assignedTeamId: value.teamId,
      warehouseIds: value.assignedWarehouseIds,
      lifecycleStatus: value.status,
    };
  };
  const reservation = (id: string): AuthorizationResource[] => {
    const value =
      read().reservations.find((item) => item.id === id) ?? missing();
    return [
      {
        type: "Reservation",
        id,
        warehouseId: value.warehouseId,
        lifecycleStatus: value.status,
      },
      reliefRequest(value.reliefRequestId),
      warehouse(value.warehouseId),
    ];
  };
  const shipment = (id: string): AuthorizationResource[] => {
    const value = read().shipments.find((item) => item.id === id) ?? missing();
    return [
      {
        type: "Shipment",
        id,
        geographicScope: value.destination,
        assignedTeamId: value.assignedTeamId,
        warehouseId: value.warehouseId,
        lifecycleStatus: value.status,
      },
      reliefRequest(value.reliefRequestId),
      warehouse(value.warehouseId),
      ...(value.assignedTeamId ? [team(value.assignedTeamId)] : []),
    ];
  };
  const assessment = (id: string): AuthorizationResource => {
    const value =
      read().damageAssessments.find((item) => item.id === id) ?? missing();
    return {
      type: "DamageAssessment",
      id,
      geographicScope: value.geographicScope,
      lifecycleStatus: value.status,
    };
  };
  const recoveryProject = (id: string): AuthorizationResource => {
    const value =
      read().recoveryProjects.find((item) => item.id === id) ?? missing();
    return {
      type: "RecoveryProject",
      id,
      geographicScope: value.geographicScope,
      assignedTeamIds: value.assignedTeamIds,
      lifecycleStatus: value.status,
    };
  };
  const playbook = (id: string): AuthorizationResource => {
    const value = read().playbooks.find((item) => item.id === id) ?? missing();
    return {
      type: "Playbook",
      id,
      geographicScope: value.geographicScope,
      lifecycleStatus: value.status,
    };
  };
  const playbookExecution = (id: string): AuthorizationResource[] => {
    const value =
      read().playbookExecutions.find((item) => item.id === id) ?? missing();
    return [
      { type: "PlaybookExecution", id, lifecycleStatus: value.status },
      playbook(value.playbookId),
      incident(value.incidentId),
    ];
  };
  const system = (
    type: string,
    id: string,
    lifecycleStatus?: string,
  ): AuthorizationResource => ({ type, id, lifecycleStatus });
  return {
    system,
    incident,
    team,
    task,
    shelter,
    evacuation,
    sos,
    warehouse,
    reliefRequest,
    reservation,
    shipment,
    assessment,
    recoveryProject,
    playbook,
    playbookExecution,
  };
}
