import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateShelterCapacity,
  deriveShelterStatus,
  assertShelterCanReceive,
  canOpenShelter,
} from "../../src/domain/shelters/rules";
import {
  getEvacuationTransitions,
  routeRequiresAlternative,
} from "../../src/domain/evacuations/rules";
import { initialShelters } from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";

test("tính sức chứa, khả dụng và tỷ lệ sử dụng từ state", () => {
  const result = calculateShelterCapacity({
    capacity: 500,
    currentOccupancy: 420,
    reservedCapacity: 0,
  });
  assert.equal(result.availableCapacity, 80);
  assert.equal(result.occupancyPercentage, 84);
  assert.equal(result.isOverloaded, false);
});
test("phát hiện gần đầy theo chỗ đã tiếp nhận và dự phòng", () => {
  const result = calculateShelterCapacity({
    capacity: 300,
    currentOccupancy: 250,
    reservedCapacity: 20,
  });
  assert.equal(result.isNearCapacity, true);
  assert.equal(result.availableCapacity, 30);
});
test("không cho trạng thái sẵn sàng khi đã đủ hoặc vượt sức chứa", () => {
  assert.equal(
    deriveShelterStatus(
      { capacity: 300, currentOccupancy: 300, reservedCapacity: 0 },
      "Sẵn sàng",
      "Tiếp cận bình thường",
    ),
    "Quá tải",
  );
  assert.equal(
    deriveShelterStatus(
      { capacity: 300, currentOccupancy: 20, reservedCapacity: 0 },
      "Sẵn sàng",
      "Không thể tiếp cận",
    ),
    "Không thể tiếp cận",
  );
});
test("readiness và accessibility chặn tiếp nhận mâu thuẫn", () => {
  const inaccessible = initialShelters.find((item) => item.id === "TH-04")!;
  assert.equal(
    canOpenShelter(inaccessible.readiness, inaccessible.accessibility),
    false,
  );
  assert.throws(
    () => assertShelterCanReceive(inaccessible, 20),
    /không mở tiếp nhận|Không thể tiếp cận/,
  );
});
test("vòng đời sơ tán chỉ công bố transition hợp lệ", () => {
  assert.deepEqual(getEvacuationTransitions("Dự kiến"), [
    "Đã phê duyệt",
    "Đã hủy",
  ]);
  assert.equal(getEvacuationTransitions("Hoàn thành").length, 0);
  assert.equal(routeRequiresAlternative("Bị chặn"), true);
});
