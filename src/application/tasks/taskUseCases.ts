import type {
  IncidentTask,
  TaskAssignmentRecord,
  TaskPriority,
  TaskReview,
  TaskStatus,
} from "../../domain/tasks/types";
import { getValidTransitions } from "../../domain/tasks/rules";

export type NewTaskInput = Pick<
  IncidentTask,
  | "incidentId"
  | "title"
  | "type"
  | "priority"
  | "teamId"
  | "assignee"
  | "location"
  | "dueAt"
  | "description"
> & { teamLeader?: string; coordinates?: [number, number] };
export type TaskAssignmentInput = {
  teamId: string;
  teamLeader: string;
  assignee?: string;
  incidentId?: string;
  priority?: TaskPriority;
  location?: string;
};

export function createTaskEntity(
  id: string,
  input: NewTaskInput,
  timestamp: string,
  defaults: { teamLeader: string; coordinates: [number, number] },
): IncidentTask {
  return {
    ...input,
    id,
    priority: input.priority as TaskPriority,
    teamLeader: input.teamLeader ?? defaults.teamLeader,
    coordinates: input.coordinates ?? defaults.coordinates,
    status: input.teamId ? "Đã giao" : "Chờ giao",
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };
}
export function transitionTaskEntity(
  task: IncidentTask,
  status: TaskStatus,
  timestamp: string,
): IncidentTask {
  if (!getValidTransitions(task.status).includes(status))
    throw new Error(`Không thể chuyển từ ${task.status} sang ${status}.`);
  if (status === "Đã giao" && !task.teamId)
    throw new Error("Phải điều phối đội trước khi giao nhiệm vụ.");
  const progress =
    status === "Hoàn thành"
      ? 100
      : status === "Đang thực hiện"
        ? Math.max(task.progress, 25)
        : status === "Đã tiếp nhận"
          ? Math.max(task.progress, 10)
          : task.progress;
  return {
    ...task,
    status,
    progress,
    updatedAt: timestamp,
    completedAt: status === "Hoàn thành" ? timestamp : task.completedAt,
  };
}
export function assignTaskToTeam(
  task: IncidentTask,
  assignment: TaskAssignmentInput,
  timestamp: string,
): IncidentTask {
  if (["Hoàn thành", "Đã hủy"].includes(task.status))
    throw new Error("Không thể gán đội cho nhiệm vụ đã kết thúc.");
  if (!assignment.teamId) throw new Error("Phải chọn đội thực hiện nhiệm vụ.");
  return {
    ...task,
    teamId: assignment.teamId,
    teamLeader: assignment.teamLeader,
    assignee: assignment.assignee ?? assignment.teamLeader,
    incidentId: assignment.incidentId ?? task.incidentId,
    priority: assignment.priority ?? task.priority,
    location: assignment.location ?? task.location,
    status: task.status === "Chờ giao" ? "Đã giao" : task.status,
    updatedAt: timestamp,
  };
}
/** Lifecycle predicate cho phép gỡ phân công — nguồn dùng chung cho selector/plan/boundary. */
export function canReleaseTaskAssignment(task: IncidentTask) {
  return ["Chờ giao", "Đã giao"].includes(task.status);
}

export function releaseTaskAssignment(
  task: IncidentTask,
  timestamp: string,
): IncidentTask {
  if (!canReleaseTaskAssignment(task))
    throw new Error(
      "Chỉ có thể gỡ đội khi nhiệm vụ chưa được tiếp nhận hoặc bắt đầu.",
    );
  return {
    ...task,
    teamId: "",
    teamLeader: "",
    assignee: "",
    status: "Chờ giao",
    updatedAt: timestamp,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * V2 — Đơn vị báo xong KHÔNG tự đóng; cán bộ xác nhận; phân công lại có lý do.
 * ──────────────────────────────────────────────────────────────────────── */

/** Đơn vị cứu hộ báo đã hoàn thành: nhiệm vụ chuyển "Chờ xác nhận". */
export function reportTaskDoneEntity(
  task: IncidentTask,
  timestamp: string,
): IncidentTask {
  if (task.status !== "Đang thực hiện")
    throw new Error("Chỉ nhiệm vụ đang thực hiện mới có thể báo hoàn thành.");
  if (!task.teamId)
    throw new Error("Nhiệm vụ chưa có đội phụ trách nên không thể báo xong.");
  return {
    ...task,
    status: "Chờ xác nhận",
    progress: Math.max(task.progress, 90),
    updatedAt: timestamp,
  };
}

export function createTaskReview(
  id: string,
  task: IncidentTask,
  reportedBy: string,
  note: string,
  timestamp: string,
): TaskReview {
  if (!note.trim()) throw new Error("Phải ghi tóm tắt kết quả khi báo hoàn thành.");
  return {
    id,
    taskId: task.id,
    incidentId: task.incidentId,
    reportedBy,
    reportedAt: timestamp,
    reportNote: note.trim(),
    decision: "Chờ xác nhận",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  };
}

/** Cán bộ chấp nhận (→ Hoàn thành, progress 100) hoặc từ chối (→ Đang thực hiện). */
export function reviewTaskResultEntity(
  task: IncidentTask,
  accepted: boolean,
  timestamp: string,
): IncidentTask {
  if (task.status !== "Chờ xác nhận")
    throw new Error("Nhiệm vụ chưa ở trạng thái chờ xác nhận.");
  return accepted
    ? transitionTaskEntity(task, "Hoàn thành", timestamp)
    : { ...task, status: "Đang thực hiện", updatedAt: timestamp };
}

export function decideTaskReview(
  review: TaskReview,
  accepted: boolean,
  note: string,
  reviewer: string,
  timestamp: string,
): TaskReview {
  if (review.decision !== "Chờ xác nhận")
    throw new Error("Báo cáo kết quả này đã được xử lý.");
  if (!accepted && !note.trim())
    throw new Error("Phải ghi lý do khi từ chối kết quả.");
  return {
    ...review,
    decision: accepted ? "Chấp nhận" : "Từ chối",
    reviewedBy: reviewer,
    reviewedAt: timestamp,
    reviewNote: note.trim() || null,
  };
}

/** Phân công lại: bắt buộc lý do, ghi lịch sử (from → to). */
export function reassignTaskEntity(
  task: IncidentTask,
  assignment: TaskAssignmentInput,
  reason: string,
  actor: string,
  timestamp: string,
): IncidentTask {
  if (!reason.trim()) throw new Error("Phải ghi lý do phân công lại.");
  if (task.teamId === assignment.teamId)
    throw new Error("Đội được chọn đang là đội phụ trách nhiệm vụ này.");
  if (["Hoàn thành", "Đã hủy"].includes(task.status))
    throw new Error("Không thể phân công lại nhiệm vụ đã kết thúc.");
  const assigned = assignTaskToTeam(task, assignment, timestamp);
  const record: TaskAssignmentRecord = {
    at: timestamp,
    fromTeamId: task.teamId || null,
    toTeamId: assignment.teamId,
    actor,
    reason: reason.trim(),
  };
  return {
    ...assigned,
    // Đội mới phải tiếp nhận lại; kết quả đang chờ xác nhận (nếu có) không còn giá trị.
    status: "Đã giao",
    assignmentHistory: [...(task.assignmentHistory ?? []), record],
  };
}

/** Bản ghi phân công đầu tiên khi giao nhiệm vụ (để lịch sử đầy đủ). */
export function initialAssignmentRecord(
  teamId: string,
  actor: string,
  timestamp: string,
  reason = "Phân công ban đầu",
): TaskAssignmentRecord {
  return { at: timestamp, fromTeamId: null, toTeamId: teamId, actor, reason };
}
