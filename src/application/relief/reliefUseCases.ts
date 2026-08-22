import type { UserRole } from "../../domain/shared/auth";
import type {
  DistributionReceipt,
  DistributionShipment,
  InventoryItem,
  ReliefPriority,
  ReliefRequest,
  ReliefRequestItem,
  ReliefRequestStatus,
  ReservationLine,
  ShipmentStatus,
  StockReservation,
  Warehouse,
} from "../../domain/relief/types";
import {
  availableQuantity,
  getReliefTransitions,
  getShipmentTransitions,
} from "../../domain/relief/rules";
export function assertReliefScope(
  role: UserRole,
  administrativeArea: string,
  scope: string,
) {
  if (role === "local_officer" && !administrativeArea.includes(scope))
    throw new Error(
      "Đối tượng cứu trợ nằm ngoài phạm vi địa lý được phân quyền.",
    );
}
export interface NewReliefRequestInput {
  requester: string;
  requesterRole: string;
  origin: ReliefRequest["origin"];
  incidentId?: string | null;
  shelterId?: string | null;
  evacuationOperationId?: string | null;
  teamId?: string | null;
  destination: string;
  destinationCoordinates: [number, number];
  priority: ReliefPriority;
  requiredBy: string;
  justification: string;
  items: Array<Omit<ReliefRequestItem, "quantityApproved">>;
  notes?: string;
}
export function createReliefRequest(
  id: string,
  input: NewReliefRequestInput,
  timestamp: string,
): ReliefRequest {
  if (
    !input.items.length ||
    input.items.some((item) => item.quantityRequested <= 0)
  )
    throw new Error("Yêu cầu phải có ít nhất một vật tư với số lượng hợp lệ.");
  return {
    id,
    code: id,
    createdAt: timestamp,
    ...input,
    incidentId: input.incidentId ?? null,
    shelterId: input.shelterId ?? null,
    evacuationOperationId: input.evacuationOperationId ?? null,
    teamId: input.teamId ?? null,
    status: "Nháp",
    items: input.items.map((item) => ({ ...item, quantityApproved: 0 })),
    approvedBy: null,
    approvedAt: null,
    assignedWarehouseIds: [],
    shipmentIds: [],
    receivedAt: null,
    notes: input.notes ?? "",
    lastUpdatedAt: timestamp,
  };
}
export function approveReliefRequest(
  request: ReliefRequest,
  approvedQuantities: Record<string, number>,
  actor: string,
  timestamp: string,
): ReliefRequest {
  if (request.status !== "Đang thẩm định")
    throw new Error("Chỉ yêu cầu đang thẩm định mới có thể phê duyệt.");
  const items = request.items.map((item) => {
    const quantity =
      approvedQuantities[item.itemCode] ?? item.quantityRequested;
    if (quantity < 0 || quantity > item.quantityRequested)
      throw new Error(`Số lượng duyệt cho ${item.name} không hợp lệ.`);
    return { ...item, quantityApproved: quantity };
  });
  if (!items.some((item) => item.quantityApproved > 0))
    throw new Error("Phải duyệt ít nhất một vật tư.");
  return {
    ...request,
    items,
    status: "Đã duyệt",
    approvedBy: actor,
    approvedAt: timestamp,
    lastUpdatedAt: timestamp,
  };
}
export function transitionReliefRequest(
  request: ReliefRequest,
  status: ReliefRequestStatus,
  timestamp: string,
  context: {
    reservations: StockReservation[];
    shipments: DistributionShipment[];
  },
): ReliefRequest {
  if (!getReliefTransitions(request.status).includes(status))
    throw new Error(
      `Không thể chuyển yêu cầu từ ${request.status} sang ${status}.`,
    );
  if (
    status === "Đã giữ hàng" &&
    !context.reservations.some(
      (item) =>
        item.reliefRequestId === request.id && item.status === "Đang giữ",
    )
  )
    throw new Error("Chưa có hàng được giữ cho yêu cầu.");
  if (
    status === "Đã xuất kho" &&
    !context.shipments.some(
      (item) =>
        item.reliefRequestId === request.id && item.status !== "Chuẩn bị",
    )
  )
    throw new Error("Chưa có phiếu xuất kho hợp lệ.");
  if (
    status === "Đã xác nhận" &&
    !context.shipments.some(
      (item) => item.reliefRequestId === request.id && item.receipt,
    )
  )
    throw new Error("Chưa có biên nhận giao hàng.");
  return {
    ...request,
    status,
    lastUpdatedAt: timestamp,
    receivedAt: status === "Đã xác nhận" ? timestamp : request.receivedAt,
  };
}
export function reserveStock(
  id: string,
  request: ReliefRequest,
  warehouse: Warehouse,
  inventory: InventoryItem[],
  allocations: Array<{ itemCode: string; quantity: number }>,
  timestamp: string,
): { reservation: StockReservation; inventory: InventoryItem[] } {
  if (warehouse.status === "Tạm đóng")
    throw new Error("Kho đang tạm đóng, không thể giữ hàng.");
  if (!["Đã duyệt", "Đã giữ hàng"].includes(request.status))
    throw new Error("Yêu cầu chưa được duyệt để giữ hàng.");
  const lines: ReservationLine[] = [];
  const next = inventory.map((item) => {
    const allocation = allocations.find(
      (value) => value.itemCode === item.itemCode,
    );
    if (!allocation || allocation.quantity === 0) return item;
    if (item.warehouseId !== warehouse.id)
      throw new Error("Vật tư không thuộc kho đã chọn.");
    if (
      allocation.quantity < 0 ||
      allocation.quantity > availableQuantity(item)
    )
      throw new Error(`${item.name} không đủ số lượng khả dụng.`);
    lines.push({
      inventoryItemId: item.id,
      itemCode: item.itemCode,
      name: item.name,
      unit: item.unit,
      quantity: allocation.quantity,
    });
    return {
      ...item,
      quantityReserved: item.quantityReserved + allocation.quantity,
      lastUpdatedAt: timestamp,
    };
  });
  if (!lines.length) throw new Error("Phải phân bổ ít nhất một vật tư.");
  return {
    reservation: {
      id,
      reliefRequestId: request.id,
      warehouseId: warehouse.id,
      items: lines,
      status: "Đang giữ",
      createdAt: timestamp,
      releasedAt: null,
      dispatchedAt: null,
    },
    inventory: next,
  };
}
export function releaseReservation(
  reservation: StockReservation,
  inventory: InventoryItem[],
  timestamp: string,
): { reservation: StockReservation; inventory: InventoryItem[] } {
  if (reservation.status !== "Đang giữ")
    throw new Error("Phiếu giữ hàng không còn hiệu lực.");
  return {
    reservation: {
      ...reservation,
      status: "Đã giải phóng",
      releasedAt: timestamp,
    },
    inventory: inventory.map((item) => {
      const line = reservation.items.find(
        (value) => value.inventoryItemId === item.id,
      );
      return line
        ? {
            ...item,
            quantityReserved: Math.max(
              0,
              item.quantityReserved - line.quantity,
            ),
            lastUpdatedAt: timestamp,
          }
        : item;
    }),
  };
}
export function dispatchReservation(
  shipmentId: string,
  reservation: StockReservation,
  request: ReliefRequest,
  warehouse: Warehouse,
  inventory: InventoryItem[],
  transport: {
    assignedTeamId?: string | null;
    method: string;
    driver: string;
    contact: string;
    estimatedArrival: string;
    routeCoordinates: [number, number][];
  },
  timestamp: string,
): {
  reservation: StockReservation;
  inventory: InventoryItem[];
  shipment: DistributionShipment;
} {
  if (reservation.status !== "Đang giữ")
    throw new Error("Hàng chưa được giữ hoặc đã xuất kho.");
  const next = inventory.map((item) => {
    const line = reservation.items.find(
      (value) => value.inventoryItemId === item.id,
    );
    if (!line) return item;
    if (
      item.quantityReserved < line.quantity ||
      item.quantityOnHand < line.quantity
    )
      throw new Error(`Tồn kho ${item.name} không đủ để xuất.`);
    return {
      ...item,
      quantityOnHand: item.quantityOnHand - line.quantity,
      quantityReserved: item.quantityReserved - line.quantity,
      lastUpdatedAt: timestamp,
    };
  });
  const shipment: DistributionShipment = {
    id: shipmentId,
    code: shipmentId,
    reliefRequestId: request.id,
    warehouseId: warehouse.id,
    reservationId: reservation.id,
    destination: request.destination,
    destinationCoordinates: request.destinationCoordinates,
    items: reservation.items.map((item) => ({
      itemCode: item.itemCode,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
    })),
    assignedTeamId: transport.assignedTeamId ?? null,
    transportMethod: transport.method,
    driver: transport.driver,
    contact: transport.contact,
    departureAt: timestamp,
    estimatedArrival: transport.estimatedArrival,
    actualArrival: null,
    status: "Đã xuất kho",
    trackingNote: "Đã rời kho",
    routeCoordinates: transport.routeCoordinates,
    receiver: null,
    receipt: null,
    lastUpdatedAt: timestamp,
  };
  return {
    reservation: {
      ...reservation,
      status: "Đã xuất kho",
      dispatchedAt: timestamp,
    },
    inventory: next,
    shipment,
  };
}
export function transitionShipment(
  shipment: DistributionShipment,
  status: ShipmentStatus,
  timestamp: string,
  note?: string,
): DistributionShipment {
  if (!getShipmentTransitions(shipment.status).includes(status))
    throw new Error(
      `Không thể chuyển chuyến hàng từ ${shipment.status} sang ${status}.`,
    );
  return {
    ...shipment,
    status,
    actualArrival: status === "Đã đến" ? timestamp : shipment.actualArrival,
    trackingNote: note ?? shipment.trackingNote,
    lastUpdatedAt: timestamp,
  };
}
export function confirmShipmentReceipt(
  shipment: DistributionShipment,
  receiver: string,
  role: string,
  note: string,
  timestamp: string,
): DistributionShipment {
  if (!["Đã đến", "Đã giao"].includes(shipment.status))
    throw new Error("Chuyến hàng chưa đến điểm nhận.");
  const receipt: DistributionReceipt = {
    id: `RC-${shipment.id}`,
    shipmentId: shipment.id,
    receivedAt: timestamp,
    receiverName: receiver,
    receiverRole: role,
    items: shipment.items,
    conditionNote: note,
    confirmedBy: "Lê Nguyễn Minh Trí",
  };
  return {
    ...shipment,
    status: "Hoàn tất",
    actualArrival: shipment.actualArrival ?? timestamp,
    receiver,
    receipt,
    lastUpdatedAt: timestamp,
  };
}
export function adjustInventory(
  item: InventoryItem,
  quantityOnHand: number,
  timestamp: string,
): InventoryItem {
  if (quantityOnHand < item.quantityReserved)
    throw new Error("Tồn kho thực tế không thể thấp hơn số lượng đang giữ.");
  return { ...item, quantityOnHand, lastUpdatedAt: timestamp };
}
