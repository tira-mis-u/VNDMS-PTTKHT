import type {
  DamageAssessment,
  DamageAssessmentStatus,
  RecoveryMilestone,
  RecoveryMilestoneStatus,
  RecoveryProgressContext,
  RecoveryProject,
  RecoveryProjectStatus,
} from "./types";
export const assessmentTransitions: Record<
  DamageAssessmentStatus,
  DamageAssessmentStatus[]
> = {
  Nháp: ["Đã gửi"],
  "Đã gửi": ["Đang thẩm định"],
  "Đang thẩm định": ["Đã xác minh", "Từ chối"],
  "Đã xác minh": [],
  "Từ chối": [],
};
export const projectTransitions: Record<
  RecoveryProjectStatus,
  RecoveryProjectStatus[]
> = {
  "Đề xuất": ["Đã phê duyệt", "Từ chối"],
  "Đã phê duyệt": ["Đang thực hiện"],
  "Đang thực hiện": ["Tạm dừng", "Hoàn thành", "Đã hủy"],
  "Tạm dừng": ["Đang thực hiện", "Đã hủy"],
  "Hoàn thành": [],
  "Từ chối": [],
  "Đã hủy": [],
};
export const milestoneTransitions: Record<
  RecoveryMilestoneStatus,
  RecoveryMilestoneStatus[]
> = {
  Chờ: ["Đang thực hiện", "Bỏ qua"],
  "Đang thực hiện": ["Hoàn thành"],
  "Hoàn thành": [],
  "Bỏ qua": [],
};
export function getAssessmentTransitions(status: DamageAssessmentStatus) {
  return assessmentTransitions[status];
}
export function getProjectTransitions(status: RecoveryProjectStatus) {
  return projectTransitions[status];
}
export function getMilestoneTransitions(status: RecoveryMilestoneStatus) {
  return milestoneTransitions[status];
}
export function assessmentHasContent(value: DamageAssessment) {
  return Boolean(
    value.summary.trim() &&
    value.assessor.trim() &&
    value.items.length &&
    value.items.every(
      (item) =>
        item.description.trim() && item.quantity > 0 && item.estimatedCost >= 0,
    ),
  );
}
export function remainingBudget(
  project: Pick<RecoveryProject, "approvedBudget" | "spentBudget">,
) {
  return project.approvedBudget - project.spentBudget;
}
export function budgetUsage(
  project: Pick<RecoveryProject, "approvedBudget" | "spentBudget">,
) {
  return project.approvedBudget > 0
    ? Math.round((project.spentBudget / project.approvedBudget) * 100)
    : 0;
}
export function isBudgetRisk(project: RecoveryProject) {
  return budgetUsage(project) >= 85;
}
function operationalTime(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
  return match
    ? new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4] ?? 0),
        Number(match[5] ?? 0),
      ).getTime()
    : Number.POSITIVE_INFINITY;
}
export function isOperationalDateBefore(value: string, reference: string) {
  return operationalTime(value) < operationalTime(reference);
}
export function isProjectOverdue(project: RecoveryProject, now = "21/08/2026") {
  return (
    !["Hoàn thành", "Từ chối", "Đã hủy"].includes(project.status) &&
    operationalTime(project.targetDate) < operationalTime(now)
  );
}
export function isAssessmentVerificationOverdue(value: DamageAssessment) {
  return (
    ["Đã gửi", "Đang thẩm định"].includes(value.status) &&
    operationalTime(value.assessedAt) < operationalTime("20/08/2026 10:45")
  );
}
export function deriveProjectProgress(
  project: RecoveryProject,
  context: RecoveryProgressContext,
) {
  const milestoneValues = project.milestones.map((item) =>
    item.status === "Hoàn thành" || item.status === "Bỏ qua"
      ? 100
      : item.progress,
  );
  const milestoneProgress = milestoneValues.length
    ? milestoneValues.reduce((sum, item) => sum + item, 0) /
      milestoneValues.length
    : 0;
  const tasks = project.taskIds
    .map((id) => context.tasks.find((item) => item.id === id))
    .filter((item): item is RecoveryProgressContext["tasks"][number] =>
      Boolean(item),
    );
  const taskProgress = tasks.length
    ? tasks.reduce(
        (sum, item) =>
          sum + (item.status === "Hoàn thành" ? 100 : item.progress),
        0,
      ) / tasks.length
    : milestoneProgress;
  return Math.round(milestoneProgress * 0.6 + taskProgress * 0.4);
}
export function canCompleteRecoveryProject(
  project: RecoveryProject,
  context: RecoveryProgressContext,
) {
  const reasons: string[] = [];
  if (
    project.milestones.some(
      (item) => item.required && item.status !== "Hoàn thành",
    )
  )
    reasons.push("Còn mốc công việc bắt buộc chưa hoàn thành.");
  if (
    project.requiredTaskIds.some(
      (id) =>
        context.tasks.find((item) => item.id === id)?.status !== "Hoàn thành",
    )
  )
    reasons.push("Còn nhiệm vụ bắt buộc chưa hoàn thành.");
  if (
    project.assessmentIds.some(
      (id) =>
        context.assessments.find((item) => item.id === id)?.status !==
        "Đã xác minh",
    )
  )
    reasons.push("Cơ sở đánh giá thiệt hại chưa được xác minh.");
  if (!project.completionVerification)
    reasons.push("Chưa có xác minh hoàn thành dự án.");
  return { allowed: reasons.length === 0, reasons };
}
export function milestoneProgress(milestone: RecoveryMilestone) {
  return milestone.status === "Hoàn thành" || milestone.status === "Bỏ qua"
    ? 100
    : milestone.progress;
}
