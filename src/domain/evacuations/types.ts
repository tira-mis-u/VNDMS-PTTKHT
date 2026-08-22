export type EvacuationStatus =
  | "Dự kiến"
  | "Đã phê duyệt"
  | "Đang triển khai"
  | "Tạm dừng"
  | "Hoàn thành"
  | "Đã hủy";
export type EvacuationPriority = "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp";
export type RouteStatus =
  "Thông suốt" | "Hạn chế" | "Bị chặn" | "Đang dùng tuyến thay thế";
export interface EvacuationRoute {
  id: string;
  name: string;
  status: RouteStatus;
  distanceKm: number;
  estimatedMinutes: number;
  coordinates: [number, number][];
  blockedSegments: string[];
  alternativeCoordinates: [number, number][];
  updatedAt: string;
}
export interface EvacuationOperation {
  id: string;
  code: string;
  incidentId: string;
  sourceArea: string;
  sourceCoordinates: [number, number];
  destinationShelterId: string;
  estimatedPopulation: number;
  evacuatedPopulation: number;
  assignedTeamId: string | null;
  route: EvacuationRoute;
  progress: number;
  priority: EvacuationPriority;
  status: EvacuationStatus;
  startTime: string | null;
  expectedCompletion: string;
  actualCompletion: string | null;
  notes: string;
  updatedAt: string;
}
export interface EvacuationEvent {
  id: string;
  operationId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
