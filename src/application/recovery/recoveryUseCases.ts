import type { UserRole } from "../../domain/shared/auth";
import type {
  AssessmentVerification,
  DamageAssessment,
  DamageItem,
  RecoveryEvidence,
  RecoveryMilestone,
  RecoveryProject,
  RecoveryProgressContext,
} from "../../domain/recovery/types";
import {
  assessmentHasContent,
  canCompleteRecoveryProject,
  deriveProjectProgress,
  getAssessmentTransitions,
  getMilestoneTransitions,
  getProjectTransitions,
} from "../../domain/recovery/rules";
export type NewDamageAssessmentInput = Pick<
  DamageAssessment,
  | "incidentId"
  | "area"
  | "assessmentType"
  | "severity"
  | "assessor"
  | "assessedAt"
  | "summary"
  | "affectedPopulation"
  | "affectedHouseholds"
  | "damagedBuildings"
  | "damagedInfrastructure"
  | "damagedRoads"
  | "damagedAgriculture"
  | "damagedUtilities"
  | "estimatedLoss"
  | "geographicScope"
  | "location"
  | "affectedAreaCoordinates"
>;
export type NewRecoveryProjectInput = Pick<
  RecoveryProject,
  | "name"
  | "incidentId"
  | "assessmentIds"
  | "category"
  | "priority"
  | "owner"
  | "geographicScope"
  | "estimatedBudget"
  | "targetDate"
  | "location"
  | "affectedAreaCoordinates"
  | "notes"
>;
export function assertRecoveryScope(
  role: UserRole,
  geographicScope: string,
  allowedScope: string,
) {
  if (role === "local_officer" && !geographicScope.includes(allowedScope))
    throw new Error(
      "Dữ liệu khôi phục nằm ngoài phạm vi địa lý được phân quyền.",
    );
}
export function createDamageAssessment(
  id: string,
  input: NewDamageAssessmentInput,
  timestamp: string,
): DamageAssessment {
  if (!input.assessor.trim()) throw new Error("Phải có cán bộ đánh giá.");
  return {
    ...input,
    id,
    code: id,
    status: "Nháp",
    verifiedAt: null,
    evidence: [],
    items: [],
    verification: null,
    rejectionReason: null,
    revisionOf: null,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export function updateDamageAssessment(
  value: DamageAssessment,
  changes: Partial<
    Omit<
      DamageAssessment,
      | "id"
      | "code"
      | "incidentId"
      | "status"
      | "verification"
      | "verifiedAt"
      | "createdAt"
      | "updatedAt"
    >
  >,
  timestamp: string,
) {
  if (value.status === "Đã xác minh")
    throw new Error(
      "Assessment đã xác minh không được sửa trực tiếp; hãy tạo revision.",
    );
  if (!["Nháp", "Từ chối"].includes(value.status))
    throw new Error("Assessment đang trong workflow thẩm định, không thể sửa.");
  return { ...value, ...changes, updatedAt: timestamp };
}
function transitionAssessment(
  value: DamageAssessment,
  status: DamageAssessment["status"],
  timestamp: string,
) {
  if (!getAssessmentTransitions(value.status).includes(status))
    throw new Error(
      `Không thể chuyển assessment từ ${value.status} sang ${status}.`,
    );
  return { ...value, status, updatedAt: timestamp };
}
export function submitDamageAssessment(
  value: DamageAssessment,
  timestamp: string,
) {
  if (!assessmentHasContent(value))
    throw new Error(
      "Không thể gửi assessment rỗng hoặc thiếu assessor/hạng mục thiệt hại.",
    );
  return transitionAssessment(value, "Đã gửi", timestamp);
}
export function reviewDamageAssessment(
  value: DamageAssessment,
  timestamp: string,
) {
  return transitionAssessment(value, "Đang thẩm định", timestamp);
}
export function verifyDamageAssessment(
  value: DamageAssessment,
  actor: string,
  evidence: string[],
  note: string,
  timestamp: string,
) {
  if (value.status !== "Đang thẩm định")
    throw new Error("Chỉ assessment đang thẩm định mới được xác minh.");
  if (!actor.trim() || !evidence.length || !note.trim())
    throw new Error("Verification phải có actor, evidence và ghi chú.");
  const verification: AssessmentVerification = {
    actor,
    timestamp,
    decision: "Xác minh",
    evidence,
    note,
  };
  return {
    ...value,
    status: "Đã xác minh" as const,
    verifiedAt: timestamp,
    verification,
    rejectionReason: null,
    evidence: value.evidence.map((item) =>
      evidence.includes(item.id)
        ? { ...item, verificationStatus: "Đã xác minh" as const }
        : item,
    ),
    updatedAt: timestamp,
  };
}
export function rejectDamageAssessment(
  value: DamageAssessment,
  actor: string,
  reason: string,
  evidence: string[],
  timestamp: string,
) {
  if (value.status !== "Đang thẩm định")
    throw new Error("Chỉ assessment đang thẩm định mới được từ chối.");
  if (!reason.trim()) throw new Error("Assessment bị từ chối phải có lý do.");
  return {
    ...value,
    status: "Từ chối" as const,
    rejectionReason: reason,
    verification: {
      actor,
      timestamp,
      decision: "Từ chối" as const,
      evidence,
      note: reason,
    },
    updatedAt: timestamp,
  };
}
export function addDamageItem(
  value: DamageAssessment,
  item: DamageItem,
  timestamp: string,
) {
  if (value.status === "Đã xác minh")
    throw new Error("Không thể thêm hạng mục vào assessment đã xác minh.");
  if (item.quantity <= 0 || item.estimatedCost < 0 || !item.description.trim())
    throw new Error("Hạng mục thiệt hại không hợp lệ.");
  return {
    ...value,
    items: [...value.items, item],
    estimatedLoss:
      value.items.reduce((sum, row) => sum + row.estimatedCost, 0) +
      item.estimatedCost,
    updatedAt: timestamp,
  };
}
export function updateDamageItem(
  value: DamageAssessment,
  itemId: string,
  changes: Partial<DamageItem>,
  timestamp: string,
) {
  if (value.status === "Đã xác minh")
    throw new Error("Không thể sửa hạng mục đã xác minh.");
  const items = value.items.map((item) =>
    item.id === itemId ? { ...item, ...changes } : item,
  );
  if (!items.some((item) => item.id === itemId))
    throw new Error("Không tìm thấy hạng mục thiệt hại.");
  return {
    ...value,
    items,
    estimatedLoss: items.reduce((sum, item) => sum + item.estimatedCost, 0),
    updatedAt: timestamp,
  };
}
export function attachEvidence(
  value: DamageAssessment,
  evidence: RecoveryEvidence,
  timestamp: string,
) {
  if (value.status === "Đã xác minh")
    throw new Error(
      "Không thể gắn evidence trực tiếp vào assessment đã xác minh.",
    );
  return {
    ...value,
    evidence: [evidence, ...value.evidence],
    updatedAt: timestamp,
  };
}
export function createRevision(
  id: string,
  value: DamageAssessment,
  actor: string,
  timestamp: string,
): DamageAssessment {
  if (value.status !== "Đã xác minh" && !value.rejectionReason)
    throw new Error(
      "Chỉ tạo revision từ assessment đã xác minh hoặc bị từ chối.",
    );
  return {
    ...value,
    id,
    code: id,
    status: "Nháp",
    assessor: actor,
    verifiedAt: null,
    verification: null,
    rejectionReason: null,
    revisionOf: value.id,
    revision: value.revision + 1,
    evidence: value.evidence.map((item) => ({
      ...item,
      verificationStatus: "Chưa xác minh",
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export function createRecoveryProject(
  id: string,
  input: NewRecoveryProjectInput,
  timestamp: string,
): RecoveryProject {
  if (!input.name.trim()) throw new Error("Tên dự án là bắt buộc.");
  return {
    ...input,
    id,
    code: id,
    status: "Đề xuất",
    approvedBudget: 0,
    spentBudget: 0,
    budgetOverrideNote: null,
    startDate: null,
    completedAt: null,
    progress: 0,
    milestones: [],
    taskIds: [],
    requiredTaskIds: [],
    assignedTeamIds: [],
    relatedReliefRequestIds: [],
    completionVerification: null,
    rejectionReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export function updateRecoveryProject(
  value: RecoveryProject,
  changes: Partial<
    Pick<
      RecoveryProject,
      | "name"
      | "category"
      | "priority"
      | "owner"
      | "geographicScope"
      | "estimatedBudget"
      | "targetDate"
      | "notes"
      | "assessmentIds"
      | "assignedTeamIds"
      | "relatedReliefRequestIds"
    >
  >,
  timestamp: string,
) {
  if (["Hoàn thành", "Từ chối", "Đã hủy"].includes(value.status))
    throw new Error("Không thể sửa dự án đã kết thúc.");
  return { ...value, ...changes, updatedAt: timestamp };
}
export function submitRecoveryProject(
  value: RecoveryProject,
  timestamp: string,
) {
  if (
    !value.owner.trim() ||
    !value.assessmentIds.length ||
    value.estimatedBudget <= 0
  )
    throw new Error("Đề xuất thiếu owner, assessment hoặc ngân sách.");
  return { ...value, updatedAt: timestamp };
}
export function approveRecoveryProject(
  value: RecoveryProject,
  assessments: DamageAssessment[],
  approvedBudget: number,
  timestamp: string,
) {
  if (value.status !== "Đề xuất")
    throw new Error("Chỉ dự án đề xuất mới được phê duyệt.");
  if (!value.owner.trim()) throw new Error("Dự án phải có owner.");
  if (approvedBudget <= 0) throw new Error("Ngân sách phê duyệt không hợp lệ.");
  if (
    !value.assessmentIds.length ||
    value.assessmentIds.some(
      (id) =>
        assessments.find((item) => item.id === id)?.status !== "Đã xác minh",
    )
  )
    throw new Error("Dự án phải dựa trên Damage Assessment đã xác minh.");
  return {
    ...value,
    status: "Đã phê duyệt" as const,
    approvedBudget,
    updatedAt: timestamp,
  };
}
function transitionProject(
  value: RecoveryProject,
  status: RecoveryProject["status"],
  timestamp: string,
) {
  if (!getProjectTransitions(value.status).includes(status))
    throw new Error(
      `Không thể chuyển dự án từ ${value.status} sang ${status}.`,
    );
  return {
    ...value,
    status,
    startDate:
      status === "Đang thực hiện" && !value.startDate
        ? timestamp
        : value.startDate,
    completedAt: status === "Hoàn thành" ? timestamp : value.completedAt,
    updatedAt: timestamp,
  };
}
export function rejectRecoveryProject(
  value: RecoveryProject,
  reason: string,
  timestamp: string,
) {
  if (value.status !== "Đề xuất" || !reason.trim())
    throw new Error("Phải có lý do từ chối dự án đề xuất.");
  return {
    ...transitionProject(value, "Từ chối", timestamp),
    rejectionReason: reason,
  };
}
export function startRecoveryProject(
  value: RecoveryProject,
  timestamp: string,
) {
  return transitionProject(value, "Đang thực hiện", timestamp);
}
export function pauseRecoveryProject(
  value: RecoveryProject,
  timestamp: string,
) {
  return transitionProject(value, "Tạm dừng", timestamp);
}
export function resumeRecoveryProject(
  value: RecoveryProject,
  timestamp: string,
) {
  return transitionProject(value, "Đang thực hiện", timestamp);
}
export function cancelRecoveryProject(
  value: RecoveryProject,
  timestamp: string,
) {
  return transitionProject(value, "Đã hủy", timestamp);
}
export function completeRecoveryProject(
  value: RecoveryProject,
  context: RecoveryProgressContext,
  timestamp: string,
) {
  const result = canCompleteRecoveryProject(value, context);
  if (!result.allowed) throw new Error(result.reasons.join(" "));
  return {
    ...transitionProject(value, "Hoàn thành", timestamp),
    progress: 100,
  };
}
export function updateRecoveryBudget(
  value: RecoveryProject,
  spentBudget: number,
  overrideNote: string | null,
  timestamp: string,
) {
  if (spentBudget < 0) throw new Error("Chi phí không hợp lệ.");
  if (spentBudget > value.approvedBudget && !overrideNote?.trim())
    throw new Error("Chi phí vượt ngân sách cần phê duyệt override rõ ràng.");
  return {
    ...value,
    spentBudget,
    budgetOverrideNote:
      spentBudget > value.approvedBudget
        ? overrideNote
        : value.budgetOverrideNote,
    updatedAt: timestamp,
  };
}
export function recordCompletionVerification(
  value: RecoveryProject,
  actor: string,
  note: string,
  evidence: string[],
  timestamp: string,
) {
  if (!actor.trim() || !note.trim() || !evidence.length)
    throw new Error("Xác minh hoàn thành phải có actor, note và evidence.");
  return {
    ...value,
    completionVerification: { actor, timestamp, note, evidence },
    updatedAt: timestamp,
  };
}
export function addMilestone(
  value: RecoveryProject,
  milestone: Omit<
    RecoveryMilestone,
    "projectId" | "order" | "status" | "progress" | "completedAt"
  >,
  timestamp: string,
) {
  if (["Hoàn thành", "Từ chối", "Đã hủy"].includes(value.status))
    throw new Error("Không thể thêm milestone vào dự án đã kết thúc.");
  return {
    ...value,
    milestones: [
      ...value.milestones,
      {
        ...milestone,
        projectId: value.id,
        order: value.milestones.length + 1,
        status: "Chờ" as const,
        progress: 0,
        completedAt: null,
      },
    ],
    updatedAt: timestamp,
  };
}
export function reorderMilestones(
  value: RecoveryProject,
  ids: string[],
  timestamp: string,
) {
  if (
    ids.length !== value.milestones.length ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Thứ tự milestone không hợp lệ.");
  return {
    ...value,
    milestones: ids.map((id, index) => ({
      ...value.milestones.find((item) => item.id === id)!,
      order: index + 1,
    })),
    updatedAt: timestamp,
  };
}
function transitionMilestone(
  value: RecoveryProject,
  id: string,
  status: RecoveryMilestone["status"],
  timestamp: string,
) {
  const milestone = value.milestones.find((item) => item.id === id);
  if (!milestone) throw new Error("Không tìm thấy milestone.");
  if (!getMilestoneTransitions(milestone.status).includes(status))
    throw new Error(
      `Không thể chuyển milestone từ ${milestone.status} sang ${status}.`,
    );
  const milestones = value.milestones.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          progress:
            status === "Hoàn thành" || status === "Bỏ qua"
              ? 100
              : Math.max(item.progress, 10),
          completedAt:
            status === "Hoàn thành" || status === "Bỏ qua"
              ? timestamp
              : item.completedAt,
        }
      : item,
  );
  return { ...value, milestones, updatedAt: timestamp };
}
export function startMilestone(
  value: RecoveryProject,
  id: string,
  timestamp: string,
) {
  return transitionMilestone(value, id, "Đang thực hiện", timestamp);
}
export function completeMilestone(
  value: RecoveryProject,
  id: string,
  timestamp: string,
) {
  return transitionMilestone(value, id, "Hoàn thành", timestamp);
}
export function skipMilestone(
  value: RecoveryProject,
  id: string,
  timestamp: string,
) {
  const milestone = value.milestones.find((item) => item.id === id);
  if (milestone?.required)
    throw new Error("Không thể bỏ qua milestone bắt buộc.");
  return transitionMilestone(value, id, "Bỏ qua", timestamp);
}
export function syncRecoveryProgress(
  value: RecoveryProject,
  context: RecoveryProgressContext,
  timestamp: string,
) {
  return {
    ...value,
    progress: deriveProjectProgress(value, context),
    updatedAt: timestamp,
  };
}
