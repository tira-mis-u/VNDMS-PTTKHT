export type WarehouseStatus = "Hoạt động" | "Hạn chế" | "Tạm đóng";
export type InventoryCondition = "Tốt" | "Hạn chế sử dụng" | "Hư hỏng";
export type ReliefPriority =
  "P1 — Khẩn cấp" | "P2 — Cao" | "P3 — Trung bình" | "P4 — Thấp";
export type ReliefRequestStatus =
  | "Nháp"
  | "Đã gửi"
  | "Đang thẩm định"
  | "Đã duyệt"
  | "Đã giữ hàng"
  | "Đã xuất kho"
  | "Đang vận chuyển"
  | "Đã giao"
  | "Đã xác nhận"
  | "Đã đóng"
  | "Từ chối"
  | "Hủy";
export type ReservationStatus = "Đang giữ" | "Đã giải phóng" | "Đã xuất kho";
export type ShipmentStatus =
  | "Chuẩn bị"
  | "Đã xuất kho"
  | "Đang vận chuyển"
  | "Đã đến"
  | "Đã giao"
  | "Có sự cố"
  | "Hoàn tất";
export interface LogisticsOfficer {
  name: string;
  role: string;
  phone: string;
}
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  administrativeArea: string;
  coordinates: [number, number];
  responsibleOfficer: LogisticsOfficer;
  contact: string;
  status: WarehouseStatus;
  capacity: number;
  currentUtilization: number;
  operatingHours: string;
  notes: string;
  lastUpdatedAt: string;
}
export interface InventoryItem {
  id: string;
  warehouseId: string;
  category: string;
  itemCode: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderLevel: number;
  expiryDate: string | null;
  condition: InventoryCondition;
  lastUpdatedAt: string;
}
export interface ReliefRequestItem {
  itemCode: string;
  category: string;
  name: string;
  unit: string;
  quantityRequested: number;
  quantityApproved: number;
}
export interface ReliefRequest {
  id: string;
  code: string;
  createdAt: string;
  requester: string;
  requesterRole: string;
  origin:
    | "Incident"
    | "Điểm sơ tán"
    | "Hoạt động sơ tán"
    | "Đội cứu hộ"
    | "Cán bộ địa phương";
  incidentId: string | null;
  shelterId: string | null;
  evacuationOperationId: string | null;
  teamId: string | null;
  destination: string;
  destinationCoordinates: [number, number];
  priority: ReliefPriority;
  status: ReliefRequestStatus;
  requiredBy: string;
  justification: string;
  items: ReliefRequestItem[];
  approvedBy: string | null;
  approvedAt: string | null;
  assignedWarehouseIds: string[];
  shipmentIds: string[];
  receivedAt: string | null;
  notes: string;
  lastUpdatedAt: string;
}
export interface ReservationLine {
  inventoryItemId: string;
  itemCode: string;
  name: string;
  unit: string;
  quantity: number;
}
export interface StockReservation {
  id: string;
  reliefRequestId: string;
  warehouseId: string;
  items: ReservationLine[];
  status: ReservationStatus;
  createdAt: string;
  releasedAt: string | null;
  dispatchedAt: string | null;
}
export interface ShipmentItem {
  itemCode: string;
  name: string;
  unit: string;
  quantity: number;
}
export interface DistributionReceipt {
  id: string;
  shipmentId: string;
  receivedAt: string;
  receiverName: string;
  receiverRole: string;
  items: ShipmentItem[];
  conditionNote: string;
  confirmedBy: string;
}
export interface DistributionShipment {
  id: string;
  code: string;
  reliefRequestId: string;
  warehouseId: string;
  reservationId: string;
  destination: string;
  destinationCoordinates: [number, number];
  items: ShipmentItem[];
  assignedTeamId: string | null;
  transportMethod: string;
  driver: string;
  contact: string;
  departureAt: string | null;
  estimatedArrival: string;
  actualArrival: string | null;
  status: ShipmentStatus;
  trackingNote: string;
  routeCoordinates: [number, number][];
  receiver: string | null;
  receipt: DistributionReceipt | null;
  lastUpdatedAt: string;
}
export interface ReliefEvent {
  id: string;
  entityType: "request" | "warehouse" | "shipment";
  entityId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
export interface FulfillmentLine {
  itemCode: string;
  name: string;
  unit: string;
  requested: number;
  allocated: number;
  shortage: number;
  state: "Đủ hàng" | "Thiếu hàng" | "Không có hàng";
}
