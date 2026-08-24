import type {
  AiActionProposal,
  AiGroundingSnapshot,
} from "../../domain/ai/types";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import { availableTeams, urgentUnassignedSos } from "./aiQueries";
const actionId = (type: string, target: string, related: string) =>
  `AI-${type}-${target}-${related}`;
const operationalDueAt = (now: Date) => {
  const due = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const part = (value: number) => String(value).padStart(2, "0");
  return `${part(due.getDate())}/${part(due.getMonth() + 1)}/${due.getFullYear()} ${part(due.getHours())}:${part(due.getMinutes())}`;
};
export function buildDeterministicActions(
  snapshot: AiGroundingSnapshot,
  entityId?: string,
  now = new Date(),
): AiActionProposal[] {
  const actions: AiActionProposal[] = [];
  const teams = availableTeams(snapshot);
  const task =
    snapshot.tasks.find((item) => item.id === entityId) ||
    snapshot.tasks.find((item) => item.status === "Chờ giao" && !item.teamId);
  const taskTeam =
    (task &&
      teams.find(
        (team) =>
          team.region.includes(task.location) ||
          task.location.includes(team.region),
      )) ||
    teams[0];
  if (task && taskTeam)
    actions.push({
      id: actionId("ASSIGN_TASK", task.id, taskTeam.id),
      type: "ASSIGN_TASK",
      label: `Điều phối ${taskTeam.id} cho ${task.id}`,
      reason: `${task.id} đang ${task.status} và ${taskTeam.id} được ghi nhận có thể điều phối.`,
      permission: "task_assign",
      targetType: "Task",
      targetId: task.id,
      resourceScope: task.location,
      affectedResources: [task.id, taskTeam.id, task.incidentId],
      currentState: [
        `${task.id}: ${task.status}`,
        `${taskTeam.id}: ${taskTeam.status}`,
        `Sự cố: ${task.incidentId}`,
        `Ưu tiên: ${task.priority}`,
      ],
      payload: { taskId: task.id, teamId: taskTeam.id },
    });
  const sos =
    urgentUnassignedSos(snapshot).find((item) => item.id === entityId) ||
    urgentUnassignedSos(snapshot)[0];
  const sosTeam =
    sos &&
    (teams.find(
      (team) =>
        team.region.includes(sos.location.administrativeArea) ||
        sos.location.administrativeArea.includes(team.region),
    ) ||
      teams[0]);
  if (sos && sosTeam && sos.linkedIncidentId)
    actions.push({
      id: actionId("DISPATCH_SOS", sos.id, sosTeam.id),
      type: "DISPATCH_SOS",
      label: `Điều phối ${sosTeam.id} cho ${sos.id}`,
      reason: `${sos.id} là P1, đã xác minh, chưa có đội và đã liên kết ${sos.linkedIncidentId}.`,
      permission: "sos_dispatch",
      targetType: "SOS",
      targetId: sos.id,
      resourceScope: sos.location.administrativeArea,
      affectedResources: [sos.id, sosTeam.id, sos.linkedIncidentId],
      currentState: [
        `${sos.id}: ${sos.status}`,
        `Xác minh: ${sos.verificationStatus}`,
        `${sosTeam.id}: ${sosTeam.status}`,
        `Ưu tiên: ${sos.priority}`,
      ],
      payload: { sosId: sos.id, teamId: sosTeam.id },
    });
  const startTask = snapshot.tasks.find(
    (item) => item.id === entityId && ["Đã tiếp nhận"].includes(item.status),
  );
  if (startTask)
    actions.push({
      id: actionId("START_TASK", startTask.id, startTask.teamId),
      type: "START_TASK",
      label: `Bắt đầu ${startTask.id}`,
      reason: `${startTask.id} đã được đội ${startTask.teamId} tiếp nhận.`,
      permission: "task_start",
      targetType: "Task",
      targetId: startTask.id,
      resourceScope: startTask.location,
      affectedResources: [startTask.id, startTask.teamId, startTask.incidentId],
      currentState: [
        `${startTask.id}: ${startTask.status}`,
        `Đội: ${startTask.teamId}`,
        `Ưu tiên: ${startTask.priority}`,
      ],
      payload: { taskId: startTask.id },
    });
  const operation = snapshot.evacuationOperations.find(
    (item) => item.id === entityId && item.route.status === "Bị chặn",
  );
  if (operation) {
    const remaining =
      operation.estimatedPopulation - operation.evacuatedPopulation;
    const alternate = snapshot.shelters.find(
      (item) =>
        item.id !== operation.destinationShelterId &&
        calculateShelterCapacity(item).availableCapacity >= remaining &&
        item.accessibility !== "Không thể tiếp cận" &&
        item.readiness !== "Không sẵn sàng",
    );
    if (alternate)
      actions.push({
        id: actionId("REDIRECT_EVACUATION", operation.id, alternate.id),
        type: "REDIRECT_EVACUATION",
        label: `Chuyển hướng ${operation.id} tới ${alternate.id}`,
        reason: `Tuyến của ${operation.id} đang bị chặn; ${alternate.id} có sức chứa khả dụng theo dữ liệu hệ thống.`,
        permission: "evacuation_update",
        targetType: "Evacuation",
        targetId: operation.id,
        resourceScope: operation.sourceArea,
        affectedResources: [
          operation.id,
          operation.destinationShelterId,
          alternate.id,
        ],
        currentState: [
          `${operation.id}: ${operation.status}`,
          `Tuyến: ${operation.route.status}`,
          `Còn lại: ${remaining} người`,
          `${alternate.id}: còn ${calculateShelterCapacity(alternate).availableCapacity} chỗ`,
        ],
        payload: { operationId: operation.id, shelterId: alternate.id },
      });
  }
  const incident = snapshot.incidents.find(
    (item) =>
      item.id === entityId &&
      item.severity === "Khẩn cấp" &&
      !snapshot.tasks.some(
        (taskItem) =>
          taskItem.incidentId === item.id &&
          taskItem.status !== "Hoàn thành" &&
          taskItem.status !== "Đã hủy",
      ),
  );
  if (incident)
    actions.push({
      id: actionId("CREATE_TASK", incident.id, "response"),
      type: "CREATE_TASK",
      label: `Tạo nhiệm vụ đánh giá cho ${incident.id}`,
      reason: `${incident.id} ở mức Khẩn cấp nhưng không có nhiệm vụ đang mở trong phạm vi truy vấn.`,
      permission: "task_create",
      targetType: "Incident",
      targetId: incident.id,
      resourceScope: incident.location.name,
      affectedResources: [incident.id],
      currentState: [
        `${incident.id}: ${incident.status}`,
        `Mức độ: ${incident.severity}`,
        `Khu vực: ${incident.location.name}`,
      ],
      payload: {
        incidentId: incident.id,
        title: `Đánh giá và xử lý ${incident.title}`,
        type: "Đánh giá hiện trường",
        priority: "Khẩn cấp",
        location: incident.location.name,
        dueAt: operationalDueAt(now),
        description: `Nhiệm vụ được đề xuất từ trạng thái hiện tại của ${incident.id}.`,
      },
    });
  return actions;
}
