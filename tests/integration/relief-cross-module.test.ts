import test from "node:test";
import assert from "node:assert/strict";
import {
  initialInventory,
  initialReliefRequests,
} from "../../src/data/scenarios/red-river-flood/reliefSeed";
import { initialIncidents } from "../../src/data/scenarios/red-river-flood/operationalSeed";
import { initialShelters } from "../../src/data/scenarios/red-river-flood/shelterEvacuationSeed";
test("yêu cầu cứu trợ tham chiếu Incident và Shelter chính thức, không sao chép vòng đời", () => {
  for (const request of initialReliefRequests) {
    if (request.incidentId)
      assert.ok(
        initialIncidents.some((item) => item.id === request.incidentId),
      );
    if (request.shelterId)
      assert.ok(initialShelters.some((item) => item.id === request.shelterId));
  }
});
test("đa kho dùng mã vật tư chung nhưng bản ghi tồn theo kho là duy nhất", () => {
  const keys = new Set<string>();
  for (const item of initialInventory) {
    const key = `${item.warehouseId}:${item.itemCode}`;
    assert.equal(keys.has(key), false);
    keys.add(key);
  }
  assert.ok(
    initialInventory.filter((item) => item.itemCode === "NUOC-500").length > 1,
  );
});
