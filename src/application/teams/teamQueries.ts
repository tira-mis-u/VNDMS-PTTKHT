import type { RescueTeam, TeamStatus } from "../../domain/teams/types";
import { teamOperationalRank } from "../../domain/teams/rules";

export type TeamSortMode =
  "Ưu tiên vận hành" | "Cập nhật gần nhất" | "Mã đội A–Z";
export interface TeamListFilters {
  tab: "Tất cả" | TeamStatus;
  search: string;
  status: "Tất cả trạng thái" | TeamStatus;
  type: string;
  capability: string;
  region: string;
  assignment: string;
  sort: TeamSortMode;
}
export function filterAndSortTeams(
  teams: RescueTeam[],
  filters: TeamListFilters,
) {
  const query = filters.search.trim().toLowerCase();
  return teams
    .filter(
      (team) =>
        (filters.tab === "Tất cả" || team.status === filters.tab) &&
        (!query ||
          `${team.id} ${team.name} ${team.leader} ${team.region}`
            .toLowerCase()
            .includes(query)) &&
        (filters.status === "Tất cả trạng thái" ||
          team.status === filters.status) &&
        (filters.type === "Tất cả loại đội" || team.type === filters.type) &&
        (filters.capability === "Tất cả năng lực" ||
          team.capabilities.includes(filters.capability)) &&
        (filters.region === "Tất cả khu vực" ||
          team.region.startsWith(filters.region)) &&
        (filters.assignment === "Tất cả phân công" ||
          (filters.assignment === "Đang có nhiệm vụ"
            ? Boolean(
                team.currentTask ||
                team.currentEvacuationOperation ||
                team.currentReliefShipment,
              )
            : filters.assignment === "Chưa có nhiệm vụ"
              ? !team.currentTask &&
                !team.currentEvacuationOperation &&
                !team.currentReliefShipment
              : team.currentTask === filters.assignment ||
                team.currentEvacuationOperation === filters.assignment ||
                team.currentReliefShipment === filters.assignment)),
    )
    .sort((a, b) =>
      filters.sort === "Mã đội A–Z"
        ? a.code.localeCompare(b.code)
        : filters.sort === "Cập nhật gần nhất"
          ? b.updatedAt.localeCompare(a.updatedAt)
          : teamOperationalRank[a.status] - teamOperationalRank[b.status] ||
            a.code.localeCompare(b.code),
    );
}
