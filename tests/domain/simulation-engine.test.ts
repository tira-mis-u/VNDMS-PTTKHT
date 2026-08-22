import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceSimulation,
  createSimulationState,
  HYDROLOGICAL_THRESHOLDS,
  pauseSimulation,
  playSimulation,
  setSimulationSpeed,
} from "../../src/domain/simulation/engine";
test("seed 20240901 tạo baseline deterministic", () => {
  assert.deepEqual(createSimulationState(), createSimulationState(20240901));
  assert.throws(() => createSimulationState(1), /20240901/);
});
test("tick tiến theo thứ tự với thời gian và event ID ổn định", () => {
  let left = createSimulationState();
  let right = createSimulationState();
  const ids: string[] = [];
  for (let index = 0; index < 16; index++) {
    const a = advanceSimulation(left);
    const b = advanceSimulation(right);
    assert.deepEqual(a, b);
    left = a.state;
    right = b.state;
    if (a.event) ids.push(a.event.id);
  }
  assert.equal(left.tick, 16);
  assert.equal(left.status, "Hoàn thành");
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(new Set(ids).size, 16);
});
test("play pause và speed không làm thay đổi tick", () => {
  const baseline = createSimulationState();
  const playing = playSimulation(baseline);
  assert.equal(playing.status, "Đang chạy");
  const fast = setSimulationSpeed(playing, 4);
  assert.equal(fast.speed, 4);
  assert.equal(fast.tick, 0);
  assert.equal(pauseSimulation(fast).status, "Tạm dừng");
});
test("ngưỡng BĐ III được phát hiện tại 11,5 m", () => {
  assert.equal(
    HYDROLOGICAL_THRESHOLDS.find((item) => item.code === "BĐ III")?.level,
    11.5,
  );
  let state = createSimulationState();
  for (let index = 0; index < 4; index++)
    state = advanceSimulation(state).state;
  assert.equal(state.warningLevel, "BĐ III");
  assert.equal(state.riskLevel, "Rất cao");
  assert.equal(state.stage, "Nguy hiểm");
});
test("mỗi tick có hậu quả có giải thích", () => {
  let state = createSimulationState();
  for (let index = 0; index < 16; index++) {
    const result = advanceSimulation(state);
    assert.ok(result.event?.reason);
    assert.ok(result.event?.consequence);
    state = result.state;
  }
  assert.equal(state.triggeredEvents.length, 16);
});
