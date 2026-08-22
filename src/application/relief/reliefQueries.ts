import type {
  DistributionShipment,
  InventoryItem,
  ReliefRequest,
  StockReservation,
  Warehouse,
} from "../../domain/relief/types";
import {
  hasRequestShortage,
  isLowStock,
  isReliefOverdue,
} from "../../domain/relief/rules";
const priorityRank: Record<ReliefRequest["priority"], number> = {
  "P1 — Khẩn cấp": 0,
  "P2 — Cao": 1,
  "P3 — Trung bình": 2,
  "P4 — Thấp": 3,
};
export interface ReliefFilters {
  search: string;
  priority: string;
  status: string;
  destination: string;
  incident: string;
  shelter: string;
  warehouse: string;
  required: string;
  shortage: string;
  overdue: string;
}
export function filterAndSortReliefRequests(
  requests: ReliefRequest[],
  reservations: StockReservation[],
  filters: ReliefFilters,
) {
  return requests
    .filter((request) => {
      const q = filters.search.toLowerCase();
      const shortage = hasRequestShortage(request, reservations);
      return (
        (!q ||
          `${request.id} ${request.destination} ${request.requester} ${request.items.map((item) => item.name).join(" ")}`
            .toLowerCase()
            .includes(q)) &&
        (filters.priority === "Tất cả ưu tiên" ||
          request.priority === filters.priority) &&
        (filters.status === "Tất cả trạng thái" ||
          request.status === filters.status) &&
        (filters.destination === "Tất cả điểm nhận" ||
          request.destination.includes(filters.destination)) &&
        (filters.incident === "Tất cả sự cố" ||
          (filters.incident === "Không liên kết"
            ? !request.incidentId
            : request.incidentId === filters.incident)) &&
        (filters.shelter === "Tất cả điểm sơ tán" ||
          (filters.shelter === "Không liên kết"
            ? !request.shelterId
            : request.shelterId === filters.shelter)) &&
        (filters.warehouse === "Tất cả kho" ||
          request.assignedWarehouseIds.includes(filters.warehouse)) &&
        (filters.required === "Tất cả thời hạn" ||
          (filters.required === "Cần trong hôm nay"
            ? request.requiredBy.startsWith("21/08/2026")
            : true)) &&
        (filters.shortage === "Tất cả nguồn cung" ||
          (filters.shortage === "Có thiếu hụt" ? shortage : !shortage)) &&
        (filters.overdue === "Tất cả tiến độ" ||
          (filters.overdue === "Quá hạn"
            ? isReliefOverdue(request)
            : !isReliefOverdue(request)))
      );
    })
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        Number(isReliefOverdue(b)) - Number(isReliefOverdue(a)) ||
        Number(hasRequestShortage(b, reservations)) -
          Number(hasRequestShortage(a, reservations)) ||
        a.requiredBy.localeCompare(b.requiredBy) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
export interface WarehouseFilters {
  search: string;
  area: string;
  status: string;
  type: string;
  lowStock: string;
  availability: string;
}
export function filterWarehouses(
  warehouses: Warehouse[],
  inventory: InventoryItem[],
  shipments: DistributionShipment[],
  filters: WarehouseFilters,
) {
  return warehouses
    .filter((warehouse) => {
      const items = inventory.filter(
        (item) => item.warehouseId === warehouse.id,
      );
      const low = items.some(isLowStock);
      const q = filters.search.toLowerCase();
      return (
        (!q ||
          `${warehouse.id} ${warehouse.name} ${warehouse.address} ${warehouse.responsibleOfficer.name}`
            .toLowerCase()
            .includes(q)) &&
        (filters.area === "Tất cả khu vực" ||
          warehouse.administrativeArea.startsWith(filters.area)) &&
        (filters.status === "Tất cả trạng thái" ||
          warehouse.status === filters.status) &&
        (filters.type === "Tất cả loại kho" ||
          warehouse.type === filters.type) &&
        (filters.lowStock === "Tất cả tồn kho" ||
          (filters.lowStock === "Có cảnh báo" ? low : !low)) &&
        (filters.availability === "Tất cả khả dụng" ||
          (filters.availability === "Có thể xuất"
            ? warehouse.status !== "Tạm đóng"
            : warehouse.status === "Tạm đóng"))
      );
    })
    .sort(
      (a, b) =>
        Number(b.status === "Tạm đóng") - Number(a.status === "Tạm đóng") ||
        Number(
          inventory
            .filter((item) => item.warehouseId === b.id)
            .some(isLowStock),
        ) -
          Number(
            inventory
              .filter((item) => item.warehouseId === a.id)
              .some(isLowStock),
          ) ||
        shipments.filter(
          (item) =>
            item.warehouseId === b.id && !["Hoàn tất"].includes(item.status),
        ).length -
          shipments.filter(
            (item) =>
              item.warehouseId === a.id && !["Hoàn tất"].includes(item.status),
          ).length,
    );
}
