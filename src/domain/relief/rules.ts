import type {
  FulfillmentLine,
  InventoryItem,
  ReliefRequest,
  ReliefRequestStatus,
  ShipmentStatus,
  StockReservation,
} from "./types";
export function availableQuantity(
  item: Pick<InventoryItem, "quantityOnHand" | "quantityReserved">,
) {
  return Math.max(0, item.quantityOnHand - item.quantityReserved);
}
export function isOutOfStock(item: InventoryItem) {
  return availableQuantity(item) === 0;
}
export function isLowStock(item: InventoryItem) {
  return (
    availableQuantity(item) > 0 && availableQuantity(item) <= item.reorderLevel
  );
}
export const reliefTransitions: Record<
  ReliefRequestStatus,
  ReliefRequestStatus[]
> = {
  Nháp: ["Đã gửi", "Hủy"],
  "Đã gửi": ["Đang thẩm định", "Hủy"],
  "Đang thẩm định": ["Đã duyệt", "Từ chối", "Hủy"],
  "Đã duyệt": ["Đã giữ hàng", "Hủy"],
  "Đã giữ hàng": ["Đã xuất kho", "Hủy"],
  "Đã xuất kho": ["Đang vận chuyển"],
  "Đang vận chuyển": ["Đã giao"],
  "Đã giao": ["Đã xác nhận"],
  "Đã xác nhận": ["Đã đóng"],
  "Đã đóng": [],
  "Từ chối": [],
  Hủy: [],
};
export const shipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  "Chuẩn bị": ["Đã xuất kho"],
  "Đã xuất kho": ["Đang vận chuyển", "Có sự cố"],
  "Đang vận chuyển": ["Đã đến", "Có sự cố"],
  "Đã đến": ["Đã giao", "Có sự cố"],
  "Đã giao": ["Hoàn tất"],
  "Có sự cố": ["Đang vận chuyển", "Đã đến"],
  "Hoàn tất": [],
};
export function getReliefTransitions(status: ReliefRequestStatus) {
  return reliefTransitions[status];
}
export function getShipmentTransitions(status: ShipmentStatus) {
  return shipmentTransitions[status];
}
export function calculateFulfillment(
  request: ReliefRequest,
  reservations: StockReservation[],
): FulfillmentLine[] {
  const active = reservations.filter(
    (item) =>
      item.reliefRequestId === request.id && item.status !== "Đã giải phóng",
  );
  return request.items.map((item) => {
    const allocated = active
      .flatMap((reservation) => reservation.items)
      .filter((line) => line.itemCode === item.itemCode)
      .reduce((sum, line) => sum + line.quantity, 0);
    const shortage = Math.max(0, item.quantityApproved - allocated);
    return {
      itemCode: item.itemCode,
      name: item.name,
      unit: item.unit,
      requested: item.quantityApproved,
      allocated,
      shortage,
      state:
        allocated === 0
          ? "Không có hàng"
          : shortage > 0
            ? "Thiếu hàng"
            : "Đủ hàng",
    };
  });
}
export function hasRequestShortage(
  request: ReliefRequest,
  reservations: StockReservation[],
) {
  return calculateFulfillment(request, reservations).some(
    (line) => line.shortage > 0,
  );
}
export function isReliefOverdue(request: ReliefRequest) {
  return (
    !["Đã xác nhận", "Đã đóng", "Từ chối", "Hủy"].includes(request.status) &&
    request.requiredBy < "21/08/2026 10:45"
  );
}
