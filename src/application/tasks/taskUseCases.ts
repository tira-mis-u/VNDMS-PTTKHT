import type {
  IncidentTask,
  TaskPriority,
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
