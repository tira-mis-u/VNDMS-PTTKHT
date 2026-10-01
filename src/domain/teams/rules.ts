import type { IncidentTask } from "../tasks/types";
import type { RescueTeam, TeamAvailability, TeamStatus } from "./types";

export const teamStatusTransitions: Record<TeamStatus, TeamStatus[]> = {
  // Cập nhật trạng thái là thao tác phục hồi thực địa: một đội có thể được
  // đưa về bất kỳ trạng thái nghiệp vụ khác nào. Việc trở về "Sẵn sàng" vẫn
  // bị chặn riêng khi đội còn nhiệm vụ mở (xem getAllowedTeamTransitions).
  "Sẵn sàng": ["Đang điều động", "Đang thực hiện", "Tạm nghỉ", "Mất liên lạc", "Không khả dụng"],
  "Đang điều động": ["Sẵn sàng", "Đang thực hiện", "Tạm nghỉ", "Mất liên lạc", "Không khả dụng"],
  "Đang thực hiện": ["Sẵn sàng", "Đang điều động", "Tạm nghỉ", "Mất liên lạc", "Không khả dụng"],
  "Tạm nghỉ": ["Sẵn sàng", "Đang điều động", "Đang thực hiện", "Mất liên lạc", "Không khả dụng"],
  "Mất liên lạc": [
    "Đang điều động",
    "Đang thực hiện",
    "Sẵn sàng",
    "Tạm nghỉ",
    "Không khả dụng",
  ],
  "Không khả dụng": ["Sẵn sàng", "Đang điều động", "Đang thực hiện", "Tạm nghỉ", "Mất liên lạc"],
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
        team.currentTask
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
