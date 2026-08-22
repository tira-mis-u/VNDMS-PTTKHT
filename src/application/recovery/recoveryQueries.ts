import type {
  DamageAssessment,
  RecoveryProject,
} from "../../domain/recovery/types";
import {
  budgetUsage,
  isAssessmentVerificationOverdue,
  isBudgetRisk,
  isOperationalDateBefore,
  isProjectOverdue,
} from "../../domain/recovery/rules";
export interface AssessmentFilters {
  search: string;
  status: string;
  type: string;
  severity: string;
  area: string;
  assessor: string;
  incident: string;
  verification: string;
  dateRange: string;
}
export interface ProjectFilters {
  search: string;
  status: string;
  priority: string;
  category: string;
  area: string;
  incident: string;
  owner: string;
  overdue: string;
}
const severityRank: Record<string, number> = {
  "Phá hủy": 0,
  "Nghiêm trọng": 1,
  "Trung bình": 2,
  Nhẹ: 3,
};
const priorityRank: Record<string, number> = {
  "Khẩn cấp": 0,
  Cao: 1,
  "Trung bình": 2,
  Thấp: 3,
};
export function filterDamageAssessments(
  values: DamageAssessment[],
  filters: AssessmentFilters,
) {
  const q = filters.search.toLowerCase();
  return values
    .filter(
      (item) =>
        (!q ||
          `${item.code} ${item.area} ${item.assessor} ${item.summary}`
            .toLowerCase()
            .includes(q)) &&
        (filters.status === "Tất cả trạng thái" ||
          item.status === filters.status) &&
        (filters.type === "Tất cả loại đánh giá" ||
          item.assessmentType === filters.type) &&
        (filters.severity === "Tất cả mức độ" ||
          item.severity === filters.severity) &&
        (filters.area === "Tất cả khu vực" || item.area === filters.area) &&
        (filters.assessor === "Tất cả cán bộ" ||
          item.assessor === filters.assessor) &&
        (filters.incident === "Tất cả sự cố" ||
          item.incidentId === filters.incident) &&
        (filters.verification === "Tất cả xác minh" ||
          (filters.verification === "Đã xác minh"
            ? item.status === "Đã xác minh"
            : item.status !== "Đã xác minh")) &&
        (filters.dateRange === "Tất cả thời gian" ||
          item.assessedAt.startsWith("21/08/2026")),
    )
    .sort(
      (a, b) =>
        Number(["Đã gửi", "Đang thẩm định"].includes(b.status)) -
          Number(["Đã gửi", "Đang thẩm định"].includes(a.status)) ||
        severityRank[a.severity] - severityRank[b.severity] ||
        b.estimatedLoss - a.estimatedLoss ||
        Number(isAssessmentVerificationOverdue(b)) -
          Number(isAssessmentVerificationOverdue(a)),
    );
}
export const searchDamageAssessments = filterDamageAssessments;
export function filterRecoveryProjects(
  values: RecoveryProject[],
  filters: ProjectFilters,
) {
  const q = filters.search.toLowerCase();
  return values
    .filter(
      (item) =>
        (!q ||
          `${item.code} ${item.name} ${item.geographicScope} ${item.owner}`
            .toLowerCase()
            .includes(q)) &&
        (filters.status === "Tất cả trạng thái" ||
          item.status === filters.status) &&
        (filters.priority === "Tất cả ưu tiên" ||
          item.priority === filters.priority) &&
        (filters.category === "Tất cả nhóm dự án" ||
          item.category === filters.category) &&
        (filters.area === "Tất cả khu vực" ||
          item.geographicScope === filters.area) &&
        (filters.incident === "Tất cả sự cố" ||
          item.incidentId === filters.incident) &&
        (filters.owner === "Tất cả phụ trách" ||
          item.owner === filters.owner) &&
        (filters.overdue === "Tất cả tiến độ" ||
          (filters.overdue === "Quá hạn"
            ? isProjectOverdue(item)
            : !isProjectOverdue(item))),
    )
    .sort(
      (a, b) =>
        Number(isProjectOverdue(b)) - Number(isProjectOverdue(a)) ||
        priorityRank[a.priority] - priorityRank[b.priority] ||
        Number(isBudgetRisk(b)) - Number(isBudgetRisk(a)) ||
        a.progress - b.progress,
    );
}
export const searchRecoveryProjects = filterRecoveryProjects;
export function getIncidentRecoverySummary(
  incidentId: string,
  assessments: DamageAssessment[],
  projects: RecoveryProject[],
) {
  const relatedAssessments = assessments.filter(
    (item) => item.incidentId === incidentId,
  );
  const relatedProjects = projects.filter(
    (item) => item.incidentId === incidentId,
  );
  return {
    assessmentCount: relatedAssessments.length,
    pendingVerification: relatedAssessments.filter((item) =>
      ["Đã gửi", "Đang thẩm định"].includes(item.status),
    ).length,
    estimatedLoss: relatedAssessments.reduce(
      (sum, item) => sum + item.estimatedLoss,
      0,
    ),
    projectCount: relatedProjects.length,
    progress: relatedProjects.length
      ? Math.round(
          relatedProjects.reduce((sum, item) => sum + item.progress, 0) /
            relatedProjects.length,
        )
      : 0,
  };
}
export function getAreaDamageSummary(area: string, values: DamageAssessment[]) {
  const rows = values.filter((item) => item.area === area);
  return {
    count: rows.length,
    estimatedLoss: rows.reduce((sum, item) => sum + item.estimatedLoss, 0),
    population: rows.reduce((sum, item) => sum + item.affectedPopulation, 0),
    households: rows.reduce((sum, item) => sum + item.affectedHouseholds, 0),
  };
}
export function getRecoveryExceptions(
  assessments: DamageAssessment[],
  projects: RecoveryProject[],
) {
  return [
    ...assessments.filter(isAssessmentVerificationOverdue).map((item) => ({
      id: item.id,
      kind: "assessment" as const,
      label: `${item.code} chờ xác minh quá lâu`,
      severity: "Cao",
    })),
    ...projects
      .filter(
        (item) =>
          isProjectOverdue(item) ||
          isBudgetRisk(item) ||
          !item.owner ||
          item.milestones.some(
            (milestone) =>
              milestone.required &&
              milestone.status !== "Hoàn thành" &&
              isOperationalDateBefore(milestone.dueDate, "21/08/2026"),
          ),
      )
      .map((item) => ({
        id: item.id,
        kind: "project" as const,
        label: isProjectOverdue(item)
          ? `${item.code} đã quá hạn`
          : budgetUsage(item) >= 100
            ? `${item.code} vượt ngân sách`
            : budgetUsage(item) >= 85
              ? `${item.code} có rủi ro ngân sách`
              : `${item.code} có milestone bị chặn`,
        severity:
          isProjectOverdue(item) || budgetUsage(item) >= 100
            ? "Khẩn cấp"
            : "Cao",
      })),
  ];
}
