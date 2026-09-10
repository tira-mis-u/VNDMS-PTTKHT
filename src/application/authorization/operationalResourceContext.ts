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
  const sos = (id: string): AuthorizationResource => {
    const value =
      read().sosRequests.find((item) => item.id === id) ?? missing();
    return {
      type: "SOS",
      id,
      geographicScope: value.location.administrativeArea,
      assignedTeamId: value.assignedTeamId,
      ownerUserId: value.ownerUserId,
      lifecycleStatus: value.status,
    };
  };
  const system = (
    type: string,
    id: string,
    lifecycleStatus?: string,
  ): AuthorizationResource => ({ type, id, lifecycleStatus });
  const citizenReport = (id: string): AuthorizationResource => {
    const value =
      read().citizenReports.find((item) => item.id === id) ?? missing();
    return {
      type: "CitizenReport",
      id,
      geographicScope: value.location.administrativeArea,
      ownerUserId: value.ownerUserId,
      lifecycleStatus: value.status,
    };
  };
  const publishedAlert = (id: string): AuthorizationResource => {
    const value =
      read().publishedAlerts.find((item) => item.id === id) ?? missing();
    return {
      type: "PublishedAlert",
      id,
      geographicScope: value.areaName,
      lifecycleStatus: value.status,
    };
  };
  return {
    system,
    incident,
    team,
    task,
    shelter,
    sos,
    citizenReport,
    publishedAlert,
  };
}
