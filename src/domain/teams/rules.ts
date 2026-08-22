import type { IncidentTask } from "../tasks/types";
import type { RescueTeam, TeamAvailability, TeamStatus } from "./types";

export const teamStatusTransitions: Record<TeamStatus, TeamStatus[]> = {
  "Sẵn sàng": ["Đang điều động", "Tạm nghỉ", "Không khả dụng"],
  "Đang điều động": ["Đang thực hiện", "Sẵn sàng", "Mất liên lạc"],
  "Đang thực hiện": ["Sẵn sàng", "Mất liên lạc", "Không khả dụng"],
  "Tạm nghỉ": ["Sẵn sàng", "Không khả dụng"],
  "Mất liên lạc": [
    "Đang điều động",
    "Đang thực hiện",
    "Sẵn sàng",
    "Không khả dụng",
  ],
  "Không khả dụng": ["Sẵn sàng", "Tạm nghỉ"],
};

export const teamOperationalRank: Record<TeamStatus, number> = {
  "Mất liên lạc": 0,
  "Không khả dụng": 1,
  "Đang thực hiện": 2,
  "Đang điều động": 3,
  "Sẵn sàng": 4,
  "Tạm nghỉ": 5,
};

export const capabilityOptions = [
  "Cứu hộ đường bộ",
  "Cứu hộ đường thủy",
  "Lặn",
  "Cứu nạn trên cao",
  "Y tế khẩn cấp",
  "Y tế sơ cấp",
  "Tìm kiếm người mất tích",
  "Sơ tán dân cư",
  "Vận chuyển",
  "Thông tin liên lạc",
  "Ứng phó sạt lở",
];

export function getTeamTransitions(status: TeamStatus) {
  return teamStatusTransitions[status];
}
export function getAllowedTeamTransitions(team: RescueTeam) {
  return teamStatusTransitions[team.status].filter(
    (status) =>
      !(
        status === "Sẵn sàng" &&
        (team.currentTask ||
          team.currentEvacuationOperation ||
          team.currentReliefShipment)
      ),
  );
}
export function isCommunicationStale(team: RescueTeam) {
  return (
    team.communicationStatus === "Mất liên lạc" ||
    team.status === "Mất liên lạc"
  );
}
export function availabilityForStatus(status: TeamStatus): TeamAvailability {
  if (status === "Sẵn sàng") return "Có thể điều phối";
  if (status === "Tạm nghỉ") return "Hạn chế";
  if (status === "Mất liên lạc" || status === "Không khả dụng")
    return "Không sẵn sàng";
  return "Đang bận";
}
export function openTasksForTeam(teamId: string, tasks: IncidentTask[]) {
  return tasks.filter(
    (task) =>
      task.teamId === teamId && !["Hoàn thành", "Đã hủy"].includes(task.status),
  );
}
