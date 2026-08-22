import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSosTriage,
  getSosTransitions,
  isSosWaitingTooLong,
} from "../../src/domain/sos/rules";
import { initialSosRequests } from "../../src/data/scenarios/red-river-flood/sosSeed";
const clone = <T>(value: T): T => structuredClone(value);
test("triage P1 giải thích các yếu tố nguy cơ rõ ràng", () => {
  const sos = clone(initialSosRequests[0]);
  const result = calculateSosTriage(sos);
  assert.equal(result.priority, "P1 — Khẩn cấp");
  assert.equal(
    result.reasons.some((reason) => reason.includes("6 người")),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.includes("2 người bị thương")),
    true,
  );
  assert.equal(
    result.reasons.some((reason) => reason.includes("cô lập")),
    true,
  );
});
test("nhóm dễ tổn thương làm tăng mức ưu tiên và có giải thích", () => {
  const sos = clone(initialSosRequests[2]);
  sos.childrenCount = 2;
  sos.elderlyCount = 3;
  sos.disabledCount = 1;
  const result = calculateSosTriage(sos);
  assert.equal(
    result.reasons.some((reason) => reason.includes("6 người thuộc nhóm")),
    true,
  );
  assert.notEqual(result.priority, "P4 — Thấp");
});
test("vòng đời SOS chỉ công bố transition hợp lệ", () => {
  assert.deepEqual(getSosTransitions("Mới tiếp nhận"), [
    "Đang xác minh",
    "Từ chối",
    "Không liên lạc được",
    "Hủy",
  ]);
  assert.equal(getSosTransitions("Đang cứu hộ").includes("Đã đóng"), false);
  assert.equal(getSosTransitions("Đã đóng").length, 0);
});
test("phát hiện yêu cầu chờ xác minh quá lâu", () => {
  const sos = clone(initialSosRequests[2]);
  sos.receivedAt = "21/08/2026 09:30";
  assert.equal(isSosWaitingTooLong(sos), true);
  assert.equal(isSosWaitingTooLong(initialSosRequests[0]), false);
});
