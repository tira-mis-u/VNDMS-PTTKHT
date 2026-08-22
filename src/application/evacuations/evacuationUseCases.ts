import type {
  EvacuationOperation,
  EvacuationPriority,
  EvacuationStatus,
  RouteStatus,
} from "../../domain/evacuations/types";
import { getEvacuationTransitions } from "../../domain/evacuations/rules";
export interface NewEvacuationInput {
  incidentId: string;
  sourceArea: string;
  sourceCoordinates: [number, number];
  destinationShelterId: string;
  estimatedPopulation: number;
  priority: EvacuationPriority;
  expectedCompletion: string;
  assignedTeamId?: string | null;
  notes?: string;
}
export function createEvacuationOperation(
  id: string,
  input: NewEvacuationInput,
  route: EvacuationOperation["route"],
  timestamp: string,
): EvacuationOperation {
  if (input.estimatedPopulation <= 0)
    throw new Error("Số dân dự kiến phải lớn hơn 0.");
  return {
    id,
    code: id,
    ...input,
    assignedTeamId: input.assignedTeamId ?? null,
    evacuatedPopulation: 0,
    route,
    progress: 0,
    status: "Dự kiến",
    startTime: null,
    actualCompletion: null,
    notes: input.notes ?? "",
    updatedAt: timestamp,
  };
}
export function transitionEvacuation(
  operation: EvacuationOperation,
  status: EvacuationStatus,
  timestamp: string,
): EvacuationOperation {
  if (!getEvacuationTransitions(operation.status).includes(status))
    throw new Error(
      `Không thể chuyển hoạt động từ ${operation.status} sang ${status}.`,
    );
  if (
    status === "Đang triển khai" &&
    (!operation.assignedTeamId || operation.route.status === "Bị chặn")
  )
    throw new Error(
      "Phải có đội phụ trách và tuyến khả dụng trước khi triển khai.",
    );
  const completed = status === "Hoàn thành";
  return {
    ...operation,
    status,
    startTime:
      status === "Đang triển khai"
        ? (operation.startTime ?? timestamp)
        : operation.startTime,
    actualCompletion: completed ? timestamp : operation.actualCompletion,
    progress: completed ? 100 : operation.progress,
    evacuatedPopulation: completed
      ? operation.estimatedPopulation
      : operation.evacuatedPopulation,
    updatedAt: timestamp,
  };
}
export function assignEvacuationTeam(
  operation: EvacuationOperation,
  teamId: string,
  timestamp: string,
): EvacuationOperation {
  if (["Hoàn thành", "Đã hủy"].includes(operation.status))
    throw new Error("Hoạt động đã kết thúc, không thể gán đội.");
  return { ...operation, assignedTeamId: teamId, updatedAt: timestamp };
}
export function updateEvacuationProgress(
  operation: EvacuationOperation,
  evacuatedPopulation: number,
  timestamp: string,
): EvacuationOperation {
  if (
    evacuatedPopulation < 0 ||
    evacuatedPopulation > operation.estimatedPopulation
  )
    throw new Error("Số người đã sơ tán không hợp lệ.");
  return {
    ...operation,
    evacuatedPopulation,
    progress: Math.round(
      (evacuatedPopulation / operation.estimatedPopulation) * 100,
    ),
    updatedAt: timestamp,
  };
}
export function updateRouteStatus(
  operation: EvacuationOperation,
  status: RouteStatus,
  timestamp: string,
): EvacuationOperation {
  if (
    status === "Đang dùng tuyến thay thế" &&
    !operation.route.alternativeCoordinates.length
  )
    throw new Error("Chưa có tuyến thay thế cho hoạt động này.");
  return {
    ...operation,
    route: { ...operation.route, status, updatedAt: timestamp },
    status:
      status === "Bị chặn" && operation.status === "Đang triển khai"
        ? "Tạm dừng"
        : operation.status,
    updatedAt: timestamp,
  };
}
export function redirectEvacuation(
  operation: EvacuationOperation,
  shelterId: string,
  route: EvacuationOperation["route"],
  timestamp: string,
): EvacuationOperation {
  if (["Hoàn thành", "Đã hủy"].includes(operation.status))
    throw new Error("Không thể chuyển hướng hoạt động đã kết thúc.");
  return {
    ...operation,
    destinationShelterId: shelterId,
    route,
    updatedAt: timestamp,
  };
}
