import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from "../../domain/incidents/types";
import type { IncidentTask } from "../../domain/tasks/types";
import type { SosRequest } from "../../domain/sos/types";

export type CreateIncidentInput = Pick<
  Incident,
  "title" | "type" | "severity" | "location" | "description"
>;

export interface IncidentClosureContext {
  tasks: IncidentTask[];
  sosRequests: SosRequest[];
}

export function assertIncidentCanClose(
  incidentId: string,
  context: IncidentClosureContext,
) {
  const blockers: string[] = [];
  const openTasks = context.tasks.filter(
    (item) =>
      item.incidentId === incidentId &&
      !["Hoàn thành", "Đã hủy"].includes(item.status),
  );
  // V2: SOS "Đã xử lý" mới chỉ là đơn vị báo xong, còn chờ cán bộ đóng → vẫn chặn.
  const openSos = context.sosRequests.filter(
    (item) =>
      item.linkedIncidentId === incidentId &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(item.status),
  );

  if (openTasks.length) blockers.push(`${openTasks.length} nhiệm vụ đang mở`);
  if (openSos.length) blockers.push(`${openSos.length} SOS chưa kết thúc`);

  if (blockers.length)
    throw new Error(`Không thể đóng sự cố: ${blockers.join(", ")}.`);
}
export function createIncidentEntity(
  id: string,
  input: CreateIncidentInput,
  actor: string,
  timestamp: string,
): Incident {
  return {
    id,
    code: id,
    ...input,
    status: "Mới",
    affectedArea: input.location.name,
    affectedPopulation: 0,
    affectedHouseholds: 0,
    affectedBuildings: 0,
    affectedRoads: 0,
    floodDepth: "Chưa đánh giá",
    areaHectares: 0,
    assignedTeamId: null,
    lead: actor,
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor,
    closedAt: null,
    source: "Trung tâm điều hành",
  };
}
export function changeIncidentStatus(
  incident: Incident,
  status: IncidentStatus,
  timestamp: string,
): Incident {
  return {
    ...incident,
    status,
    updatedAt: timestamp,
    progress:
      status === "Đã kiểm soát"
        ? Math.max(incident.progress, 90)
        : incident.progress,
  };
}
export function changeIncidentSeverity(
  incident: Incident,
  severity: IncidentSeverity,
  timestamp: string,
): Incident {
  return { ...incident, severity, updatedAt: timestamp };
}
