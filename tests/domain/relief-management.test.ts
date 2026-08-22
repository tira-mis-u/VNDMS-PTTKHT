import test from "node:test";
import assert from "node:assert/strict";
import {
  availableQuantity,
  calculateFulfillment,
  getReliefTransitions,
  getShipmentTransitions,
  isLowStock,
  isOutOfStock,
} from "../../src/domain/relief/rules";
import {
  initialInventory,
  initialReliefRequests,
  initialReservations,
} from "../../src/data/scenarios/red-river-flood/reliefSeed";
const clone = <T>(value: T): T => structuredClone(value);
test("khả dụng bằng tồn thực tế trừ số đang giữ", () => {
  const item = clone(initialInventory[0]);
  assert.equal(availableQuantity(item), 800);
  item.quantityReserved = item.quantityOnHand;
  assert.equal(isOutOfStock(item), true);
  item.quantityReserved = item.quantityOnHand - item.reorderLevel;
  assert.equal(isLowStock(item), true);
});
test("phân bổ từng phần công bố thiếu hàng, không tự hoàn tất", () => {
  const request = clone(
    initialReliefRequests.find((item) => item.id === "REQ-0241")!,
  );
  const result = calculateFulfillment(request, clone(initialReservations));
  assert.equal(
    result.find((item) => item.itemCode === "CHAN-01")?.shortage,
    80,
  );
  assert.equal(
    result.find((item) => item.itemCode === "CHAN-01")?.state,
    "Thiếu hàng",
  );
});
test("vòng đời yêu cầu và chuyến hàng không cho đi tắt", () => {
  assert.deepEqual(getReliefTransitions("Đang thẩm định"), [
    "Đã duyệt",
    "Từ chối",
    "Hủy",
  ]);
  assert.equal(getReliefTransitions("Đã duyệt").includes("Đã giao"), false);
  assert.deepEqual(getShipmentTransitions("Có sự cố"), [
    "Đang vận chuyển",
    "Đã đến",
  ]);
  assert.equal(getShipmentTransitions("Hoàn tất").length, 0);
});
