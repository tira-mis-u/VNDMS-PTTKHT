/*
 * V2 (4 vai): test "phản ánh canonical Simulation" gỡ cùng module Mô phỏng; thay bằng
 * test Command Center phản ánh SOS mới tạo qua use case canonical và reset về baseline.
 * Kịch bản mặc định là Yagi 2024 (INC-YAGI-*).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import {
  getCommandCenterActionQueue,
  getCommandCenterResourceExceptions,
  getSituationSummary,
} from "../../src/application/command-center/commandCenterQueries";
import { createSosRequest } from "../../src/application/sos/sosUseCases";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

test("Command Center query thay đổi ngay theo canonical mutation", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const before = getSituationSummary(snapshot);
  const incident = snapshot.incidents.find((item) => item.id === "INC-YAGI-01")!;
  incident.status = "Đã đóng";
  const after = getSituationSummary(snapshot);
  assert.equal(
    Number(after.metrics[0].value),
    Number(before.metrics[0].value) - 1,
  );
});

test("Command Center phản ánh SOS canonical mới và reset baseline", () => {
  const baseline = inMemoryOperationalRepository.load();
  const baselineQueue = getCommandCenterActionQueue(baseline);
  const snapshot = inMemoryOperationalRepository.load();
  const template = snapshot.sosRequests[0];
  const created = createSosRequest(
    "SOS-TEST-001",
    {
      reporter: template.reporter,
      location: template.location,
      description: "SOS kiểm thử canonical",
      peopleAtRisk: 3,
      injuredCount: 0,
      missingCount: 0,
      childrenCount: 0,
      elderlyCount: 0,
      disabledCount: 0,
      severity: "Khẩn cấp",
      communicationStatus: template.communicationStatus,
    },
    snapshot.metadata.asOf,
    "USR-CTZ-001",
  );
  snapshot.sosRequests = [created, ...snapshot.sosRequests];
  assert.ok(snapshot.sosRequests.some((item) => item.id === "SOS-TEST-001"));
  assert.ok(
    getCommandCenterActionQueue(snapshot).some((item) => item.id === "SOS-TEST-001"),
  );
  assert.notDeepEqual(getCommandCenterActionQueue(snapshot), baselineQueue);
  const reset = inMemoryOperationalRepository.load();
  assert.deepEqual(getCommandCenterActionQueue(reset), baselineQueue);
  assert.deepEqual(
    getCommandCenterResourceExceptions(reset),
    getCommandCenterResourceExceptions(baseline),
  );
  assert.equal(reset.sosRequests.some((item) => item.id.startsWith("SOS-TEST")), false);
});

test("không còn Command Center operational dataset thứ hai", () => {
  assert.equal(
    existsSync("src/data/scenarios/red-river-flood/commandCenterSeed.ts"),
    false,
  );
  // Danh sách bám theo các thành phần còn tồn tại sau đợt tinh giản: dòng thời
  // gian phối hợp và bảng ngoại lệ nguồn lực đã bị xóa (trùng lặp với module
  // gốc), bản đồ riêng của phòng chỉ huy được thay bằng bản đồ tác nghiệp.
  const files = [
    "src/features/command-center/components/CommandCenter.tsx",
    "src/features/command-center/components/ActionQueue.tsx",
    "src/features/command-center/components/CommandCenterMap.tsx",
    "src/features/command-center/components/DetailDrawer.tsx",
    "src/features/command-center/components/ResourceAlertStrip.tsx",
    "src/features/command-center/components/SituationSummary.tsx",
  ];
  assert.ok(
    files.every(
      (file) => !readFileSync(file, "utf8").includes("commandCenterSeed"),
    ),
  );
});
