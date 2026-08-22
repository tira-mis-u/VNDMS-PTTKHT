import type { SosRequest } from "../../domain/sos/types";
import { isSosWaitingTooLong, sosPriorityRank } from "../../domain/sos/rules";
export interface SosQueueFilters {
  search: string;
  priority: string;
  status: string;
  verification: string;
  area: string;
  assignment: string;
  incident: string;
  time: string;
}
export function filterAndSortSos(
  requests: SosRequest[],
  filters: SosQueueFilters,
) {
  return requests
    .filter((sos) => {
      const q = filters.search.trim().toLowerCase();
      return (
        (!q ||
          `${sos.id} ${sos.reporter.name} ${sos.reporter.contact} ${sos.location.address}`
            .toLowerCase()
            .includes(q)) &&
        (filters.priority === "Tất cả ưu tiên" ||
          sos.priority === filters.priority) &&
        (filters.status === "Tất cả trạng thái" ||
          sos.status === filters.status) &&
        (filters.verification === "Tất cả xác minh" ||
          sos.verificationStatus === filters.verification) &&
        (filters.area === "Tất cả khu vực" ||
          sos.location.administrativeArea.startsWith(filters.area)) &&
        (filters.assignment === "Tất cả phân công" ||
          (filters.assignment === "Đã giao đội"
            ? Boolean(sos.assignedTeamId)
            : !sos.assignedTeamId)) &&
        (filters.incident === "Tất cả sự cố" ||
          (filters.incident === "Chưa liên kết"
            ? !sos.linkedIncidentId
            : sos.linkedIncidentId === filters.incident)) &&
        (filters.time === "Tất cả thời gian" ||
          (filters.time === "Đang chờ lâu"
            ? isSosWaitingTooLong(sos)
            : sos.receivedAt.startsWith("21/08/2026")))
      );
    })
    .sort(
      (a, b) =>
        sosPriorityRank[a.priority] - sosPriorityRank[b.priority] ||
        Number(isSosWaitingTooLong(b)) - Number(isSosWaitingTooLong(a)) ||
        Number(a.verificationStatus === "Đã xác minh") -
          Number(b.verificationStatus === "Đã xác minh") ||
        Number(Boolean(a.assignedTeamId)) - Number(Boolean(b.assignedTeamId)) ||
        b.receivedAt.localeCompare(a.receivedAt),
    );
}
