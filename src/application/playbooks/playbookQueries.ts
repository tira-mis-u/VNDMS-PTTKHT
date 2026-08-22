import type { Playbook, PlaybookExecution } from "../../domain/playbooks/types";
import {
  calculateExecutionProgress,
  currentAndNextSteps,
  prerequisitesMet,
} from "../../domain/playbooks/rules";
export interface PlaybookFilters {
  search: string;
  disasterType: string;
  status: string;
  geographicScope: string;
  sort: string;
}
const severityRank: Record<string, number> = {
  "Khẩn cấp": 0,
  Cao: 1,
  "Trung bình": 2,
  Thấp: 3,
};
export function getAvailablePlaybooks(
  playbooks: Playbook[],
  filters: PlaybookFilters,
) {
  const q = filters.search.trim().toLowerCase();
  return playbooks
    .filter(
      (item) =>
        (!q ||
          `${item.code} ${item.name} ${item.description}`
            .toLowerCase()
            .includes(q)) &&
        (filters.disasterType === "Tất cả loại thiên tai" ||
          item.disasterType === filters.disasterType) &&
        (filters.status === "Tất cả trạng thái" ||
          item.status === filters.status) &&
        (filters.geographicScope === "Tất cả phạm vi" ||
          item.geographicScope === filters.geographicScope),
    )
    .sort((a, b) =>
      filters.sort === "Cập nhật gần nhất"
        ? b.updatedAt.localeCompare(a.updatedAt)
        : severityRank[a.severityThreshold] -
            severityRank[b.severityThreshold] ||
          Number(b.status === "Đã xuất bản") -
            Number(a.status === "Đã xuất bản"),
    );
}
export function getPlaybookExecution(
  executions: PlaybookExecution[],
  id: string,
) {
  return executions.find((item) => item.id === id);
}
export function getIncidentExecution(
  executions: PlaybookExecution[],
  incidentId: string,
) {
  return executions.find(
    (item) =>
      item.incidentId === incidentId &&
      ["Đang hoạt động", "Tạm dừng"].includes(item.status),
  );
}
export function executionSummary(
  playbook: Playbook,
  execution: PlaybookExecution,
) {
  const { current, next } = currentAndNextSteps(playbook, execution);
  const blocked = playbook.steps.filter((step) => {
    const value = execution.stepExecutions.find(
      (item) => item.stepId === step.id,
    );
    return value?.status === "Bị chặn" && !prerequisitesMet(step, execution);
  });
  return {
    progress: calculateExecutionProgress(execution),
    current,
    next,
    blocked,
  };
}
