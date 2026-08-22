import type {
  Playbook,
  PlaybookExecution,
  PlaybookExecutionStatus,
  PlaybookStep,
  PlaybookStepExecution,
  PlaybookStepStatus,
  StepOperationalContext,
} from "./types";
export const executionTransitions: Record<
  PlaybookExecutionStatus,
  PlaybookExecutionStatus[]
> = {
  Nháp: ["Đang hoạt động", "Đã hủy"],
  "Đang hoạt động": ["Tạm dừng", "Hoàn thành", "Đã hủy"],
  "Tạm dừng": ["Đang hoạt động", "Đã hủy"],
  "Hoàn thành": [],
  "Đã hủy": [],
};
export const stepTransitions: Record<PlaybookStepStatus, PlaybookStepStatus[]> =
  {
    Chờ: ["Sẵn sàng", "Bỏ qua", "Bị chặn"],
    "Sẵn sàng": ["Đang thực hiện", "Bỏ qua", "Bị chặn"],
    "Đang thực hiện": ["Hoàn thành", "Bị chặn"],
    "Bị chặn": ["Sẵn sàng", "Bỏ qua"],
    "Hoàn thành": [],
    "Bỏ qua": [],
  };
export function getExecutionTransitions(status: PlaybookExecutionStatus) {
  return executionTransitions[status];
}
export function getStepTransitions(status: PlaybookStepStatus) {
  return stepTransitions[status];
}
export function completedStep(step?: PlaybookStepExecution) {
  return step?.status === "Hoàn thành" || step?.status === "Bỏ qua";
}
export function prerequisitesMet(
  step: PlaybookStep,
  execution: PlaybookExecution,
) {
  return step.prerequisites.every((id) => {
    const required = execution.stepExecutions.find(
      (item) => item.stepId === id,
    );
    return required?.status === "Hoàn thành" || required?.status === "Bỏ qua";
  });
}
export function calculateExecutionProgress(execution: PlaybookExecution) {
  if (!execution.stepExecutions.length) return 0;
  return Math.round(
    (execution.stepExecutions.filter(completedStep).length /
      execution.stepExecutions.length) *
      100,
  );
}
export function currentAndNextSteps(
  playbook: Playbook,
  execution: PlaybookExecution,
) {
  const ordered = [...playbook.steps].sort((a, b) => a.order - b.order);
  const current =
    ordered.find((step) => step.id === execution.currentStep) ??
    ordered.find(
      (step) =>
        !completedStep(
          execution.stepExecutions.find((item) => item.stepId === step.id)!,
        ),
    );
  const next = current
    ? ordered.find(
        (step) =>
          step.order > current.order &&
          !completedStep(
            execution.stepExecutions.find((item) => item.stepId === step.id)!,
          ),
      )
    : undefined;
  return { current, next };
}
export function canCompleteExecution(
  playbook: Playbook,
  execution: PlaybookExecution,
) {
  return playbook.steps
    .filter((step) => step.required)
    .every(
      (step) =>
        execution.stepExecutions.find((item) => item.stepId === step.id)
          ?.status === "Hoàn thành",
    );
}
export function evaluateStepCompletion(
  step: PlaybookStep,
  execution: PlaybookStepExecution,
  context: StepOperationalContext,
): { satisfied: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (
    step.type === "Nhiệm vụ" &&
    !execution.linkedTaskIds.some((id) =>
      context.tasks.some(
        (task) => task.id === id && task.status === "Hoàn thành",
      ),
    )
  )
    reasons.push("Nhiệm vụ liên kết chưa hoàn thành.");
  if (
    step.type === "Điều động" &&
    !execution.linkedTeamIds.some((id) =>
      context.teams.some(
        (team) =>
          team.id === id &&
          team.currentIncident &&
          ["Đang điều động", "Đang thực hiện"].includes(team.status),
      ),
    )
  )
    reasons.push("Chưa có đội liên kết được điều động.");
  if (
    step.type === "Sơ tán" &&
    !execution.linkedEvacuationIds.some((id) =>
      context.evacuations.some(
        (item) =>
          item.id === id &&
          ["Đang triển khai", "Hoàn thành"].includes(item.status),
      ),
    )
  )
    reasons.push("Hoạt động sơ tán chưa triển khai hoặc hoàn thành.");
  if (
    step.type === "Điểm sơ tán" &&
    !execution.linkedShelterIds.some((id) =>
      context.shelters.some(
        (item) => item.id === id && item.status !== "Tạm đóng",
      ),
    )
  )
    reasons.push("Chưa có điểm sơ tán đang vận hành.");
  if (
    step.type === "Cứu trợ" &&
    !execution.linkedReliefRequestIds.some((id) =>
      context.reliefRequests.some(
        (item) =>
          item.id === id &&
          [
            "Đã duyệt",
            "Đã giữ hàng",
            "Đã xuất kho",
            "Đang vận chuyển",
            "Đã giao",
            "Đã xác nhận",
            "Đã đóng",
          ].includes(item.status),
      ),
    )
  )
    reasons.push("Yêu cầu cứu trợ chưa được phê duyệt hoặc điều phối.");
  if (step.type === "Xác minh" && !execution.verificationNote?.trim())
    reasons.push("Chưa ghi nhận kết quả xác minh.");
  if (
    ["Đánh giá", "Thông báo", "Quyết định"].includes(step.type) &&
    !execution.notes.trim()
  )
    reasons.push("Chưa có ghi chú nghiệp vụ làm bằng chứng hoàn thành.");
  if (step.completionCriteria.length === 0)
    reasons.push("Bước chưa khai báo tiêu chí hoàn thành.");
  return { satisfied: reasons.length === 0, reasons };
}
export function deriveStepReadiness(
  playbook: Playbook,
  execution: PlaybookExecution,
): PlaybookExecution {
  if (execution.status !== "Đang hoạt động") return execution;
  const steps = execution.stepExecutions.map((item) => {
    if (!["Chờ", "Bị chặn"].includes(item.status)) return item;
    const template = playbook.steps.find((step) => step.id === item.stepId)!;
    if (prerequisitesMet(template, execution))
      return { ...item, status: "Sẵn sàng" as const, blockedReason: null };
    return {
      ...item,
      status: "Bị chặn" as const,
      blockedReason: "Chưa hoàn thành bước tiên quyết.",
    };
  });
  const current =
    steps.find((item) => item.status === "Đang thực hiện")?.stepId ??
    steps.find((item) => item.status === "Sẵn sàng")?.stepId ??
    null;
  return { ...execution, stepExecutions: steps, currentStep: current };
}
