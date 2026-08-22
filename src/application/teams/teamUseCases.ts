import type { IncidentTask } from "../../domain/tasks/types";
import type {
  RescueTeam,
  TeamLocation,
  TeamStatus,
} from "../../domain/teams/types";
import {
  availabilityForStatus,
  getTeamTransitions,
  openTasksForTeam,
} from "../../domain/teams/rules";

export type TeamProfileInput = Pick<
  RescueTeam,
  "name" | "type" | "leader" | "contact" | "region" | "operatingScope" | "notes"
>;

function personnelForStatus(
  team: RescueTeam,
  status: TeamStatus,
): RescueTeam["personnel"] {
  const memberStatus = [
    "Đang điều động",
    "Đang thực hiện",
    "Mất liên lạc",
  ].includes(status)
    ? ("Đang nhiệm vụ" as const)
    : status === "Sẵn sàng"
      ? ("Sẵn sàng" as const)
      : ("Tạm nghỉ" as const);
  return team.personnel.map((member) => ({ ...member, status: memberStatus }));
}

export function assignTeamToOperation(
  team: RescueTeam,
  taskId: string,
  incidentId: string,
  timestamp: string,
): RescueTeam {
  assertTeamDispatchable(team, taskId);
  return {
    ...team,
    status: "Đang điều động",
    availability: "Đang bận",
    currentTask: taskId,
    currentIncident: incidentId,
    personnel: personnelForStatus(team, "Đang điều động"),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function assertTeamDispatchable(
  team: RescueTeam,
  targetTaskId?: string,
) {
  if (["Mất liên lạc", "Không khả dụng", "Tạm nghỉ"].includes(team.status))
    throw new Error(`Đội ${team.id} hiện không thể điều phối.`);
  if (team.communicationStatus === "Mất liên lạc")
    throw new Error(`Đội ${team.id} đang mất liên lạc.`);
  if (team.currentTask && team.currentTask !== targetTaskId)
    throw new Error(
      `Đội ${team.id} đang thực hiện nhiệm vụ ${team.currentTask}.`,
    );
  if (team.currentEvacuationOperation)
    throw new Error(
      `Đội ${team.id} đang thực hiện hoạt động sơ tán ${team.currentEvacuationOperation}.`,
    );
  if (team.currentReliefShipment)
    throw new Error(
      `Đội ${team.id} đang vận chuyển chuyến hàng ${team.currentReliefShipment}.`,
    );
}

export function assignTeamToReliefShipment(
  team: RescueTeam,
  shipmentId: string,
  incidentId: string | null,
  timestamp: string,
): RescueTeam {
  assertTeamDispatchable(team);
  return {
    ...team,
    currentReliefShipment: shipmentId,
    currentIncident: incidentId,
    status: "Đang điều động",
    availability: "Đang bận",
    personnel: personnelForStatus(team, "Đang điều động"),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}
export function releaseTeamFromReliefShipment(
  team: RescueTeam,
  timestamp: string,
): RescueTeam {
  const status: TeamStatus =
    team.communicationStatus === "Mất liên lạc" ? "Mất liên lạc" : "Sẵn sàng";
  return {
    ...team,
    currentReliefShipment: null,
    currentIncident: null,
    status,
    availability: availabilityForStatus(status),
    personnel: personnelForStatus(team, status),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function assignTeamToEvacuation(
  team: RescueTeam,
  operationId: string,
  incidentId: string,
  timestamp: string,
): RescueTeam {
  assertTeamDispatchable(team);
  return {
    ...team,
    currentEvacuationOperation: operationId,
    currentIncident: incidentId,
    status: "Đang điều động",
    availability: "Đang bận",
    personnel: personnelForStatus(team, "Đang điều động"),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function releaseTeamFromEvacuation(
  team: RescueTeam,
  timestamp: string,
): RescueTeam {
  const status: TeamStatus = team.currentTask
    ? team.status === "Đang thực hiện"
      ? "Đang thực hiện"
      : "Đang điều động"
    : team.communicationStatus === "Mất liên lạc"
      ? "Mất liên lạc"
      : "Sẵn sàng";
  return {
    ...team,
    currentEvacuationOperation: null,
    currentIncident: team.currentTask ? team.currentIncident : null,
    status,
    availability: availabilityForStatus(status),
    personnel: personnelForStatus(team, status),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function changeTeamStatus(
  team: RescueTeam,
  status: TeamStatus,
  timestamp: string,
): RescueTeam {
  if (!getTeamTransitions(team.status).includes(status))
    throw new Error(`Không thể chuyển đội từ ${team.status} sang ${status}.`);
  if (
    status === "Sẵn sàng" &&
    (team.currentTask ||
      team.currentEvacuationOperation ||
      team.currentReliefShipment)
  )
    throw new Error(
      "Không thể chuyển đội về Sẵn sàng khi còn phân công đang mở.",
    );
  const communicationStatus =
    status === "Mất liên lạc"
      ? "Mất liên lạc"
      : team.status === "Mất liên lạc" &&
          team.communicationStatus === "Mất liên lạc"
        ? "Gián đoạn"
        : team.communicationStatus;
  return {
    ...team,
    status,
    availability: availabilityForStatus(status),
    communicationStatus,
    personnel: personnelForStatus(team, status),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function applyTeamLocation(
  team: RescueTeam,
  location: TeamLocation,
  timestamp: string,
): RescueTeam {
  const restoredStatus =
    team.status === "Mất liên lạc"
      ? team.currentTask
        ? "Đang điều động"
        : "Sẵn sàng"
      : team.status;
  const status =
    location.communicationStatus === "Mất liên lạc"
      ? "Mất liên lạc"
      : restoredStatus;
  return {
    ...team,
    location,
    coordinates: [location.longitude, location.latitude],
    lastLocationUpdate: location.timestamp.split(" ")[1] ?? location.timestamp,
    communicationStatus: location.communicationStatus,
    status,
    availability: availabilityForStatus(status),
    personnel: personnelForStatus(team, status),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function updateTeamProfile(
  team: RescueTeam,
  input: TeamProfileInput,
  timestamp: string,
): RescueTeam {
  if (!input.name.trim() || !input.leader.trim() || !input.contact.trim())
    throw new Error("Tên đội, đội trưởng và liên hệ là bắt buộc.");
  return {
    ...team,
    ...input,
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function updateTeamCapabilities(
  team: RescueTeam,
  capabilities: string[],
  timestamp: string,
): RescueTeam {
  const normalized = [
    ...new Set(capabilities.map((item) => item.trim()).filter(Boolean)),
  ];
  if (!normalized.length)
    throw new Error("Đội phải có ít nhất một năng lực tác chiến.");
  return {
    ...team,
    capabilities: normalized,
    capability: normalized[0],
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}

export function recalculateTeamAssignment(
  team: RescueTeam,
  tasks: IncidentTask[],
  timestamp: string,
): RescueTeam {
  const remaining = openTasksForTeam(team.id, tasks)[0];
  if (remaining) {
    const status: TeamStatus =
      remaining.status === "Đang thực hiện"
        ? "Đang thực hiện"
        : "Đang điều động";
    return {
      ...team,
      currentTask: remaining.id,
      currentIncident: remaining.incidentId,
      status,
      availability: "Đang bận",
      personnel: personnelForStatus(team, status),
      lastOperationalUpdate: timestamp,
      updatedAt: timestamp,
    };
  }
  const status: TeamStatus =
    team.communicationStatus === "Mất liên lạc" ? "Mất liên lạc" : "Sẵn sàng";
  return {
    ...team,
    currentTask: null,
    currentIncident: null,
    status,
    availability: availabilityForStatus(status),
    personnel: personnelForStatus(team, status),
    lastOperationalUpdate: timestamp,
    updatedAt: timestamp,
  };
}
