import type {
  EvacuationOperation,
  EvacuationStatus,
  RouteStatus,
} from "./types";
export const evacuationTransitions: Record<
  EvacuationStatus,
  EvacuationStatus[]
> = {
  "Dự kiến": ["Đã phê duyệt", "Đã hủy"],
  "Đã phê duyệt": ["Đang triển khai", "Đã hủy"],
  "Đang triển khai": ["Tạm dừng", "Hoàn thành", "Đã hủy"],
  "Tạm dừng": ["Đang triển khai", "Đã hủy"],
  "Hoàn thành": [],
  "Đã hủy": [],
};
export function getEvacuationTransitions(status: EvacuationStatus) {
  return evacuationTransitions[status];
}
export function isEvacuationDelayed(operation: EvacuationOperation) {
  return (
    operation.status === "Tạm dừng" ||
    (operation.route.status === "Bị chặn" &&
      operation.status === "Đang triển khai")
  );
}
export function routeRequiresAlternative(status: RouteStatus) {
  return status === "Bị chặn";
}
