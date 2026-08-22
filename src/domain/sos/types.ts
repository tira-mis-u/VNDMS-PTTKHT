export type SosStatus =
  | "Mới tiếp nhận"
  | "Đang xác minh"
  | "Đã xác minh"
  | "Đã điều phối"
  | "Đang cứu hộ"
  | "Đã xử lý"
  | "Đã đóng"
  | "Từ chối"
  | "Không liên lạc được"
  | "Hủy";
export type SosPriority =
  "P1 — Khẩn cấp" | "P2 — Cao" | "P3 — Trung bình" | "P4 — Thấp";
export type SosSeverity =
  "Đe dọa tính mạng" | "Nghiêm trọng" | "Đáng chú ý" | "Thông thường";
export type SosVerificationStatus =
  "Chưa xác minh" | "Đang xác minh" | "Đã xác minh" | "Không hợp lệ";
export type SosCommunicationStatus = "Kết nối" | "Gián đoạn" | "Mất liên lạc";
export interface SosReporter {
  name: string;
  contact: string;
  source:
    | "Người dân"
    | "Ứng dụng hiện trường"
    | "Tổng đài 112"
    | "Cán bộ địa phương"
    | "Thiết bị cảnh báo";
}
export interface SosAffectedPerson {
  id: string;
  name: string;
  condition: "Chờ cứu hộ" | "Bị thương" | "Mất tích" | "Đã an toàn";
  vulnerableGroup?: "Trẻ em" | "Người cao tuổi" | "Người khuyết tật";
}
export interface SosLocation {
  name: string;
  address: string;
  administrativeArea: string;
  coordinates: [number, number];
  accessCondition: "Tiếp cận bình thường" | "Hạn chế đường bộ" | "Bị cô lập";
  floodDepth: string;
}
export interface SosRequest {
  id: string;
  code: string;
  receivedAt: string;
  reporter: SosReporter;
  location: SosLocation;
  description: string;
  affectedPeople: SosAffectedPerson[];
  peopleAtRisk: number;
  injuredCount: number;
  missingCount: number;
  childrenCount: number;
  elderlyCount: number;
  disabledCount: number;
  severity: SosSeverity;
  priority: SosPriority;
  triageReasons: string[];
  status: SosStatus;
  verificationStatus: SosVerificationStatus;
  linkedIncidentId: string | null;
  assignedTeamId: string | null;
  linkedTaskId: string | null;
  shelterDestinationId: string | null;
  linkedEvacuationOperationId: string | null;
  communicationStatus: SosCommunicationStatus;
  lastContactAt: string;
  lastUpdatedAt: string;
  resolutionSummary: string | null;
  closedAt: string | null;
}
export interface SosEvent {
  id: string;
  sosId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
export interface SosTriageResult {
  priority: SosPriority;
  reasons: string[];
}
