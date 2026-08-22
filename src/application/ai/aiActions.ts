import type {
  AiActionExecutor,
  AiActionRequest,
  AiActionResult,
} from "../../domain/ai/types";
import { authorize } from "../../lib/security/authorization";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import { availableTeams } from "./aiQueries";
const denied = (reason: string): AiActionResult => ({
  status: "denied",
  message: reason.includes("quyền")
    ? reason
    : "Bạn không có quyền thực hiện thao tác này.",
});
export function executeGroundedAction(
  request: AiActionRequest,
  executor: AiActionExecutor,
): AiActionResult {
  const { proposal, user, snapshot, confirmed } = request;
  if (!confirmed)
    return {
      status: "confirmation_required",
      message: "Cần xác nhận rõ ràng trước khi thực thi.",
    };
  const access = authorize(
    user,
    proposal.permission,
    proposal.resourceScope,
    proposal.payload.teamId,
  );
  if (!access.allowed) return denied(access.reason);
  try {
    if (proposal.type === "ASSIGN_TASK") {
      const task = snapshot.tasks.find(
        (item) => item.id === proposal.payload.taskId,
      );
      const team = snapshot.teams.find(
        (item) => item.id === proposal.payload.teamId,
      );
      if (!task || !team)
        return {
          status: "stale",
          message: "Task hoặc Team không còn tồn tại trong trạng thái chuẩn.",
        };
      if (task.teamId || task.status !== "Chờ giao")
        return {
          status: "stale",
          message: `${task.id} không còn ở trạng thái Chờ giao chưa có đội.`,
        };
      if (!availableTeams(snapshot).some((item) => item.id === team.id))
        return {
          status: "stale",
          message: `${team.id} không còn sẵn sàng để điều phối.`,
        };
      executor.assignTask(task.id, team.id);
      return {
        status: "executed",
        message: `Đã điều phối ${team.id} cho ${task.id}.`,
        entityId: task.id,
      };
    }
    if (proposal.type === "DISPATCH_SOS") {
      const createAccess = authorize(
        user,
        "sos_create_task",
        proposal.resourceScope,
      );
      if (!createAccess.allowed) return denied(createAccess.reason);
      const sos = snapshot.sosRequests.find(
        (item) => item.id === proposal.payload.sosId,
      );
      const team = snapshot.teams.find(
        (item) => item.id === proposal.payload.teamId,
      );
      if (!sos || !team)
        return {
          status: "stale",
          message: "SOS hoặc Team không còn tồn tại trong trạng thái chuẩn.",
        };
      if (
        sos.verificationStatus !== "Đã xác minh" ||
        sos.assignedTeamId ||
        !sos.linkedIncidentId
      )
        return {
          status: "stale",
          message: `${sos.id} không còn đủ điều kiện điều phối.`,
        };
      if (!availableTeams(snapshot).some((item) => item.id === team.id))
        return {
          status: "stale",
          message: `${team.id} không còn sẵn sàng để điều phối.`,
        };
      const id = executor.dispatchSos(sos.id, team.id);
      return {
        status: "executed",
        message: `Đã điều phối ${team.id} cho ${sos.id} và tạo ${id}.`,
        entityId: id,
      };
    }
    if (proposal.type === "START_TASK") {
      const task = snapshot.tasks.find(
        (item) => item.id === proposal.payload.taskId,
      );
      if (!task)
        return {
          status: "stale",
          message: "Task không còn tồn tại trong trạng thái chuẩn.",
        };
      const ownerAccess = authorize(
        user,
        "task_start",
        task.location,
        task.teamId,
      );
      if (!ownerAccess.allowed) return denied(ownerAccess.reason);
      if (task.status !== "Đã tiếp nhận")
        return {
          status: "stale",
          message: `${task.id} không còn ở trạng thái Đã tiếp nhận.`,
        };
      executor.startTask(task.id);
      return {
        status: "executed",
        message: `Đã bắt đầu ${task.id}.`,
        entityId: task.id,
      };
    }
    if (proposal.type === "REDIRECT_EVACUATION") {
      const operation = snapshot.evacuationOperations.find(
        (item) => item.id === proposal.payload.operationId,
      );
      const shelter = snapshot.shelters.find(
        (item) => item.id === proposal.payload.shelterId,
      );
      if (!operation || !shelter)
        return {
          status: "stale",
          message: "Hoạt động sơ tán hoặc điểm tiếp nhận không còn tồn tại.",
        };
      const remaining =
        operation.estimatedPopulation - operation.evacuatedPopulation;
      if (
        operation.route.status !== "Bị chặn" ||
        calculateShelterCapacity(shelter).availableCapacity < remaining
      )
        return {
          status: "stale",
          message:
            "Điều kiện tuyến hoặc sức chứa đã thay đổi; cần đánh giá lại.",
        };
      executor.redirectEvacuation(operation.id, shelter.id);
      return {
        status: "executed",
        message: `Đã chuyển hướng ${operation.id} tới ${shelter.id}.`,
        entityId: operation.id,
      };
    }
    if (proposal.type === "CREATE_TASK") {
      const incident = snapshot.incidents.find(
        (item) => item.id === proposal.payload.incidentId,
      );
      if (!incident)
        return {
          status: "stale",
          message: "Incident không còn tồn tại trong trạng thái chuẩn.",
        };
      const id = executor.createTask({
        incidentId: incident.id,
        title: proposal.payload.title,
        type: proposal.payload.type,
        priority: proposal.payload.priority as
          "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp",
        teamId: "",
        assignee: "",
        location: incident.location.name,
        dueAt: proposal.payload.dueAt,
        description: proposal.payload.description,
        coordinates: incident.location.coordinates,
      });
      return {
        status: "executed",
        message: `Đã tạo ${id} cho ${incident.id}.`,
        entityId: id,
      };
    }
    return { status: "failed", message: "Hành động không được hỗ trợ." };
  } catch (error) {
    return {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Không thể thực thi hành động.",
    };
  }
}
