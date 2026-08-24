import type { UserRole } from "../../domain/shared/auth";
import type {
  Playbook,
  PlaybookExecution,
  PlaybookStep,
  PlaybookStepExecution,
  StepOperationalContext,
} from "../../domain/playbooks/types";
import {
  canCompleteExecution,
  deriveStepReadiness,
  evaluateStepCompletion,
  getExecutionTransitions,
  getStepTransitions,
  prerequisitesMet,
} from "../../domain/playbooks/rules";
export type NewPlaybookInput = Omit<
  Playbook,
  "id" | "code" | "status" | "version" | "steps" | "createdAt" | "updatedAt"
> & { code: string; version?: string };
export function assertPlaybookScope(
  role: UserRole,
  geographicScope: string,
  allowedScope: string,
) {
  if (role === "local_officer" && !geographicScope.includes(allowedScope))
    throw new Error("Phương án điều phối nằm ngoài phạm vi địa lý được phân quyền.");
}
export function createPlaybook(
  id: string,
  input: NewPlaybookInput,
  timestamp: string,
): Playbook {
  if (!input.name.trim() || !input.triggerConditions.length)
    throw new Error("Tên và điều kiện kích hoạt phương án điều phối là bắt buộc.");
  return {
    ...input,
    id,
    code: input.code,
    status: "Nháp",
    version: input.version ?? "1.0",
    steps: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export function updatePlaybook(
  playbook: Playbook,
  changes: Partial<
    Pick<
      Playbook,
      | "name"
      | "description"
      | "disasterType"
      | "triggerConditions"
      | "severityThreshold"
      | "geographicScope"
      | "owner"
      | "estimatedDuration"
    >
  >,
  timestamp: string,
) {
  if (playbook.status === "Lưu trữ")
    throw new Error("Không thể sửa phương án điều phối đã lưu trữ.");
  return { ...playbook, ...changes, updatedAt: timestamp };
}
export function publishPlaybook(
  playbook: Playbook,
  timestamp: string,
): Playbook {
  if (playbook.status !== "Nháp")
    throw new Error("Chỉ phương án điều phối ở trạng thái nháp mới có thể xuất bản.");
  if (
    !playbook.steps.length ||
    playbook.steps.some((step) => !step.completionCriteria.length)
  )
    throw new Error("Mọi bước phải có tiêu chí hoàn thành trước khi xuất bản.");
  return { ...playbook, status: "Đã xuất bản", updatedAt: timestamp };
}
export function archivePlaybook(
  playbook: Playbook,
  timestamp: string,
): Playbook {
  if (playbook.status === "Lưu trữ")
    throw new Error("Kế hoạch ứng phó đã được lưu trữ.");
  return { ...playbook, status: "Lưu trữ", updatedAt: timestamp };
}
export function addStep(
  playbook: Playbook,
  step: Omit<
    PlaybookStep,
    | "playbookId"
    | "order"
    | "status"
    | "startedAt"
    | "completedAt"
    | "completedBy"
  >,
  timestamp: string,
): Playbook {
  if (playbook.status !== "Nháp")
    throw new Error("Chỉ có thể sửa bước của phương án điều phối ở trạng thái nháp.");
  if (playbook.steps.some((item) => item.id === step.id))
    throw new Error("Mã bước đã tồn tại.");
  const value: PlaybookStep = {
    ...step,
    playbookId: playbook.id,
    order: playbook.steps.length + 1,
    status: "Chờ",
    startedAt: null,
    completedAt: null,
    completedBy: null,
  };
  return {
    ...playbook,
    steps: [...playbook.steps, value],
    updatedAt: timestamp,
  };
}
export function reorderSteps(
  playbook: Playbook,
  orderedIds: string[],
  timestamp: string,
): Playbook {
  if (playbook.status !== "Nháp")
    throw new Error("Chỉ có thể sắp xếp phương án điều phối ở trạng thái nháp.");
  if (
    orderedIds.length !== playbook.steps.length ||
    new Set(orderedIds).size !== orderedIds.length
  )
    throw new Error("Danh sách sắp xếp bước không hợp lệ.");
  const steps = orderedIds.map((id, index) => {
    const step = playbook.steps.find((item) => item.id === id);
    if (!step) throw new Error(`Không tìm thấy bước ${id}.`);
    return { ...step, order: index + 1 };
  });
  return { ...playbook, steps, updatedAt: timestamp };
}
export function assignStepOwner(
  execution: PlaybookExecution,
  stepId: string,
  owner: string,
  timestamp: string,
) {
  if (!owner.trim()) throw new Error("Người phụ trách không hợp lệ.");
  return {
    ...execution,
    stepExecutions: execution.stepExecutions.map((item) =>
      item.stepId === stepId ? { ...item, owner } : item,
    ),
    updatedAt: timestamp,
  };
}
export function activatePlaybook(
  id: string,
  playbook: Playbook,
  incident: { id: string; location: { name: string } },
  actor: string,
  role: UserRole,
  allowedScope: string,
  timestamp: string,
): PlaybookExecution {
  if (playbook.status !== "Đã xuất bản")
    throw new Error("Chỉ phương án điều phối đã xuất bản mới có thể kích hoạt.");
  if (!incident?.id)
    throw new Error("Phải có sự cố hợp lệ để kích hoạt kế hoạch ứng phó.");
  assertPlaybookScope(role, playbook.geographicScope, allowedScope);
  if (
    !incident.location.name.includes(allowedScope) &&
    role === "local_officer"
  )
    throw new Error("Sự cố nằm ngoài phạm vi địa lý được phân quyền.");
  const stepExecutions: PlaybookStepExecution[] = playbook.steps.map(
    (step) => ({
      id: `${id}-${step.id}`,
      stepId: step.id,
      order: step.order,
      status: "Chờ",
      owner: step.responsibleRole,
      startedAt: null,
      completedAt: null,
      completedBy: null,
      notes: "",
      blockedReason: null,
      linkedTaskIds: [],
      linkedTeamIds: [],
      linkedShelterIds: [],
      linkedEvacuationIds: [],
      linkedSosIds: [],
      linkedReliefRequestIds: [],
      verificationNote: null,
    }),
  );
  return deriveStepReadiness(playbook, {
    id,
    playbookId: playbook.id,
    incidentId: incident.id,
    status: "Đang hoạt động",
    currentStep: null,
    startedAt: timestamp,
    completedAt: null,
    activatedBy: actor,
    executionNotes: "",
    stepExecutions,
    linkedTaskIds: [],
    linkedTeamIds: [],
    linkedShelterIds: [],
    linkedReliefRequestIds: [],
    timeline: [],
    updatedAt: timestamp,
  });
}
function transitionExecution(
  execution: PlaybookExecution,
  status: PlaybookExecution["status"],
  timestamp: string,
) {
  if (!getExecutionTransitions(execution.status).includes(status))
    throw new Error(
      `Không thể chuyển đợt thực hiện từ ${execution.status} sang ${status}.`,
    );
  return {
    ...execution,
    status,
    completedAt: status === "Hoàn thành" ? timestamp : execution.completedAt,
    updatedAt: timestamp,
  };
}
export function pausePlaybook(execution: PlaybookExecution, timestamp: string) {
  return transitionExecution(execution, "Tạm dừng", timestamp);
}
export function resumePlaybook(
  playbook: Playbook,
  execution: PlaybookExecution,
  timestamp: string,
) {
  return deriveStepReadiness(
    playbook,
    transitionExecution(execution, "Đang hoạt động", timestamp),
  );
}
export function cancelPlaybook(
  execution: PlaybookExecution,
  timestamp: string,
) {
  return transitionExecution(execution, "Đã hủy", timestamp);
}
export function completePlaybook(
  playbook: Playbook,
  execution: PlaybookExecution,
  timestamp: string,
) {
  if (!canCompleteExecution(playbook, execution))
    throw new Error(
      "Không thể hoàn thành khi còn bước bắt buộc chưa đạt tiêu chí.",
    );
  return transitionExecution(execution, "Hoàn thành", timestamp);
}
export function evaluateStepReadiness(
  playbook: Playbook,
  execution: PlaybookExecution,
) {
  return deriveStepReadiness(playbook, execution);
}
export function startPlaybookStep(
  playbook: Playbook,
  execution: PlaybookExecution,
  stepId: string,
  actor: string,
  timestamp: string,
) {
  if (execution.status !== "Đang hoạt động")
    throw new Error("Đợt thực hiện phải đang hoạt động.");
  const template = playbook.steps.find((item) => item.id === stepId);
  const step = execution.stepExecutions.find((item) => item.stepId === stepId);
  if (!template || !step) throw new Error("Không tìm thấy bước trong phương án điều phối.");
  if (!prerequisitesMet(template, execution))
    throw new Error("Chưa hoàn thành bước tiên quyết.");
  if (!getStepTransitions(step.status).includes("Đang thực hiện"))
    throw new Error(`Không thể bắt đầu bước từ trạng thái ${step.status}.`);
  return {
    ...execution,
    currentStep: stepId,
    stepExecutions: execution.stepExecutions.map((item) =>
      item.stepId === stepId
        ? {
            ...item,
            status: "Đang thực hiện" as const,
            startedAt: timestamp,
            owner: item.owner ?? actor,
            blockedReason: null,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
}
export function completePlaybookStep(
  playbook: Playbook,
  execution: PlaybookExecution,
  stepId: string,
  context: StepOperationalContext,
  actor: string,
  timestamp: string,
) {
  if (execution.status !== "Đang hoạt động")
    throw new Error("Đợt thực hiện phải đang hoạt động.");
  const template = playbook.steps.find((item) => item.id === stepId);
  const step = execution.stepExecutions.find((item) => item.stepId === stepId);
  if (!template || !step) throw new Error("Không tìm thấy bước trong phương án điều phối.");
  if (!getStepTransitions(step.status).includes("Hoàn thành"))
    throw new Error(`Không thể hoàn thành bước từ trạng thái ${step.status}.`);
  const result = evaluateStepCompletion(template, step, context);
  if (!result.satisfied) throw new Error(result.reasons.join(" "));
  const changed = {
    ...execution,
    stepExecutions: execution.stepExecutions.map((item) =>
      item.stepId === stepId
        ? {
            ...item,
            status: "Hoàn thành" as const,
            completedAt: timestamp,
            completedBy: actor,
            blockedReason: null,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
  return deriveStepReadiness(playbook, changed);
}
export function skipPlaybookStep(
  playbook: Playbook,
  execution: PlaybookExecution,
  stepId: string,
  actor: string,
  canOverride: boolean,
  timestamp: string,
) {
  const template = playbook.steps.find((item) => item.id === stepId);
  const step = execution.stepExecutions.find((item) => item.stepId === stepId);
  if (!template || !step) throw new Error("Không tìm thấy bước trong phương án điều phối.");
  if (template.required && !canOverride)
    throw new Error("Bước bắt buộc chỉ có thể bỏ qua khi có quyền phê duyệt ngoại lệ.");
  if (!getStepTransitions(step.status).includes("Bỏ qua"))
    throw new Error(`Không thể bỏ qua bước từ trạng thái ${step.status}.`);
  const changed = {
    ...execution,
    stepExecutions: execution.stepExecutions.map((item) =>
      item.stepId === stepId
        ? {
            ...item,
            status: "Bỏ qua" as const,
            completedAt: timestamp,
            completedBy: actor,
            notes: `${item.notes}${item.notes ? " · " : ""}Bỏ qua theo quyết định điều hành.`,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
  return deriveStepReadiness(playbook, changed);
}
export function updateStepEvidence(
  execution: PlaybookExecution,
  stepId: string,
  changes: Partial<
    Pick<
      PlaybookStepExecution,
      | "notes"
      | "verificationNote"
      | "linkedTaskIds"
      | "linkedTeamIds"
      | "linkedShelterIds"
      | "linkedEvacuationIds"
      | "linkedSosIds"
      | "linkedReliefRequestIds"
    >
  >,
  timestamp: string,
) {
  if (!execution.stepExecutions.some((item) => item.stepId === stepId))
    throw new Error("Không tìm thấy bước trong đợt thực hiện.");
  const stepExecutions = execution.stepExecutions.map((item) =>
    item.stepId === stepId ? { ...item, ...changes } : item,
  );
  const linked = (
    key:
      | "linkedTaskIds"
      | "linkedTeamIds"
      | "linkedShelterIds"
      | "linkedReliefRequestIds",
  ) => [...new Set(stepExecutions.flatMap((item) => item[key]))];
  return {
    ...execution,
    stepExecutions,
    linkedTaskIds: linked("linkedTaskIds"),
    linkedTeamIds: linked("linkedTeamIds"),
    linkedShelterIds: linked("linkedShelterIds"),
    linkedReliefRequestIds: linked("linkedReliefRequestIds"),
    updatedAt: timestamp,
  };
}
