import test from "node:test";
import assert from "node:assert/strict";
import {
  assertReliefScope,
  adjustInventory,
  approveReliefRequest,
  confirmShipmentReceipt,
  dispatchReservation,
  releaseReservation,
  reserveStock,
  transitionReliefRequest,
  transitionShipment,
} from "../../src/application/relief/reliefUseCases";
import { filterAndSortReliefRequests } from "../../src/application/relief/reliefQueries";
import {
  initialInventory,
  initialReliefRequests,
  initialReservations,
  initialShipments,
  initialWarehouses,
} from "../../src/data/scenarios/red-river-flood/reliefSeed";
import {
  assertPermission,
  hasPermission,
} from "../../src/lib/permissions/permissions";
import {
  assignTeamToReliefShipment,
  releaseTeamFromReliefShipment,
} from "../../src/application/teams/teamUseCases";
import { initialTeams } from "../../src/data/scenarios/red-river-flood/operationalSeed";
const clone = <T>(value: T): T => structuredClone(value);
test("giữ hàng giảm khả dụng nhưng không giảm tồn vật lý; giải phóng hoàn nguyên", () => {
  const request = {
    ...clone(initialReliefRequests[0]),
    status: "Đã duyệt" as const,
  };
  const inventory = clone(initialInventory);
  const before = inventory.find((item) => item.id === "INV-0104")!;
  const held = reserveStock(
    "RES-X",
    request,
    clone(initialWarehouses[0]),
    inventory,
    [{ itemCode: "VS-01", quantity: 40 }],
    "x",
  );
  const after = held.inventory.find((item) => item.id === "INV-0104")!;
  assert.equal(after.quantityOnHand, before.quantityOnHand);
  assert.equal(after.quantityReserved, before.quantityReserved + 40);
  const released = releaseReservation(held.reservation, held.inventory, "y");
  assert.equal(
    released.inventory.find((item) => item.id === "INV-0104")?.quantityReserved,
    before.quantityReserved,
  );
});
test("không thể giữ hoặc xuất quá khả dụng", () => {
  const request = {
    ...clone(initialReliefRequests[0]),
    status: "Đã duyệt" as const,
  };
  assert.throws(
    () =>
      reserveStock(
        "X",
        request,
        clone(initialWarehouses[0]),
        clone(initialInventory),
        [{ itemCode: "VS-01", quantity: 999 }],
        "x",
      ),
    /không đủ/,
  );
  const reservation = clone(initialReservations[0]);
  const inventory = clone(initialInventory).map((item) =>
    item.id === "INV-0101" ? { ...item, quantityOnHand: 100 } : item,
  );
  assert.throws(
    () =>
      dispatchReservation(
        "S",
        reservation,
        request,
        clone(initialWarehouses[0]),
        inventory,
        {
          method: "Xe",
          driver: "A",
          contact: "1",
          estimatedArrival: "y",
          routeCoordinates: [],
        },
        "x",
      ),
    /không đủ/,
  );
});
test("xuất kho giảm đồng thời tồn thực tế và lượng giữ", () => {
  const request = clone(initialReliefRequests[0]);
  const reservation = clone(initialReservations[0]);
  const inventory = clone(initialInventory);
  const result = dispatchReservation(
    "SHP-X",
    reservation,
    request,
    clone(initialWarehouses[0]),
    inventory,
    {
      method: "Xe kho",
      driver: "A",
      contact: "1",
      estimatedArrival: "y",
      routeCoordinates: [],
    },
    "x",
  );
  const item = result.inventory.find((row) => row.id === "INV-0101")!;
  assert.equal(item.quantityOnHand, 800);
  assert.equal(item.quantityReserved, 0);
  assert.equal(result.shipment.status, "Đã xuất kho");
});
test("phê duyệt, chuyển trạng thái và biên nhận được kiểm tra", () => {
  const reviewing = {
    ...clone(initialReliefRequests[0]),
    status: "Đang thẩm định" as const,
  };
  const approved = approveReliefRequest(
    reviewing,
    { "NUOC-500": 700, "SUAT-AN": 200, "CHAN-01": 0 },
    "Chỉ huy",
    "x",
  );
  assert.equal(approved.status, "Đã duyệt");
  assert.throws(
    () =>
      transitionReliefRequest(approved, "Đã giao", "y", {
        reservations: [],
        shipments: [],
      }),
    /Không thể chuyển/,
  );
  let shipment = clone(initialShipments[0]);
  shipment = transitionShipment(shipment, "Đã đến", "x");
  const received = confirmShipmentReceipt(
    shipment,
    "Nguyễn Văn A",
    "Điểm nhận",
    "Đủ hàng",
    "y",
  );
  assert.equal(received.status, "Hoàn tất");
  assert.equal(received.receipt?.receiverName, "Nguyễn Văn A");
});
test("điều chỉnh tồn không thấp hơn số đang giữ", () => {
  assert.throws(
    () => adjustInventory(clone(initialInventory[0]), 500, "x"),
    /thấp hơn/,
  );
});
test("queue ưu tiên P1, quá hạn và thiếu nguồn cung", () => {
  const rows = filterAndSortReliefRequests(
    clone(initialReliefRequests),
    clone(initialReservations),
    {
      search: "",
      priority: "Tất cả ưu tiên",
      status: "Tất cả trạng thái",
      destination: "Tất cả điểm nhận",
      incident: "Tất cả sự cố",
      shelter: "Tất cả điểm sơ tán",
      warehouse: "Tất cả kho",
      required: "Tất cả thời hạn",
      shortage: "Tất cả nguồn cung",
      overdue: "Tất cả tiến độ",
    },
  );
  assert.equal(rows[0].priority, "P1 — Khẩn cấp");
  assert.equal(
    rows.some((item) => item.id === "REQ-0243"),
    true,
  );
});
test("phạm vi địa lý chặn điều phối ngoài địa bàn", () => {
  assert.throws(
    () => assertReliefScope("local_officer", "Đà Nẵng", "Hà Nội"),
    /ngoài phạm vi/,
  );
  assert.doesNotThrow(() =>
    assertReliefScope("local_officer", "Tây Hồ, Hà Nội", "Hà Nội"),
  );
});
test("RBAC giới hạn thao tác kho và cứu trợ", () => {
  assert.equal(hasPermission("local_officer", "relief_create"), true);
  assert.equal(hasPermission("local_officer", "relief_dispatch"), false);
  assert.throws(
    () => assertPermission("citizen", "warehouse_adjust_stock"),
    /không có quyền/,
  );
  assert.doesNotThrow(() => assertPermission("commander", "warehouse_close"));
});
test("gán chuyến dùng Team hiện hữu và giải phóng sau hoàn tất", () => {
  const team = clone(initialTeams.find((item) => item.id === "YT-01")!);
  const assigned = assignTeamToReliefShipment(team, "SHP-X", "INC-0241", "x");
  assert.equal(assigned.currentReliefShipment, "SHP-X");
  const released = releaseTeamFromReliefShipment(assigned, "y");
  assert.equal(released.currentReliefShipment, null);
});
