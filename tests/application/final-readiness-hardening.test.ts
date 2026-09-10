/*
 * V2 (4 vai): closure context chỉ còn tasks + sosRequests (evacuation/relief/playbook đã xóa);
 * kịch bản Yagi 2024 (INC-YAGI-01 còn nhiệm vụ mở). Thêm contract: nhiệm vụ "Chờ xác nhận"
 * và SOS "Đã xử lý" (chờ cán bộ đóng) vẫn chặn đóng sự cố.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertIncidentCanClose } from "../../src/application/incidents/incidentUseCases";
import { parseRoute } from "../../src/app/routes/router";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const incidentId = "INC-YAGI-01";

test("không đóng Incident khi còn operational dependency đang mở", () => {
  const snapshot = inMemoryOperationalRepository.load();
  assert.throws(
    () =>
      assertIncidentCanClose(incidentId, {
        tasks: snapshot.tasks,
        sosRequests: snapshot.sosRequests,
      }),
    /Không thể đóng sự cố/,
  );
});

test("nhiệm vụ Chờ xác nhận và SOS Đã xử lý (chưa được cán bộ đóng) vẫn chặn đóng sự cố", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const awaiting = snapshot.tasks
    .filter((item) => item.incidentId === incidentId)
    .map((item) => ({ ...item, status: "Chờ xác nhận" as const }));
  assert.throws(
    () => assertIncidentCanClose(incidentId, { tasks: awaiting, sosRequests: [] }),
    /nhiệm vụ đang mở/,
  );
  const resolvedSos = snapshot.sosRequests
    .filter((item) => item.linkedIncidentId === incidentId)
    .map((item) => ({ ...item, status: "Đã xử lý" as const }));
  assert.ok(resolvedSos.length > 0);
  assert.throws(
    () => assertIncidentCanClose(incidentId, { tasks: [], sosRequests: resolvedSos }),
    /SOS chưa kết thúc/,
  );
  const closedSos = resolvedSos.map((item) => ({ ...item, status: "Đã đóng" as const }));
  assert.doesNotThrow(() => assertIncidentCanClose(incidentId, { tasks: [], sosRequests: closedSos }));
});

test("cho phép đóng Incident khi mọi operational dependency đã kết thúc", () => {
  assert.doesNotThrow(() =>
    assertIncidentCanClose(incidentId, {
      tasks: [],
      sosRequests: [],
    }),
  );
});

test("router phân biệt placeholder hợp lệ và URL không tồn tại", () => {
  assert.equal(parseRoute("/workspace/Cảnh%20báo").name, "placeholder");
  assert.equal(parseRoute("/khong-ton-tai").name, "not-found");
});

test("feature routes được lazy-load thay vì nhập đồng bộ vào shell", () => {
  const app = readFileSync("src/app/App.tsx", "utf8");
  assert.match(app, /lazy\(\(\) =>/);
  assert.match(app, /import\("@\/features\/command-center"\)/);
  assert.doesNotMatch(app, /import \{ CommandCenter \} from/);
});

test("SOS resolution đi qua linked Task completion trong cùng atomic command", () => {
  const provider = readFileSync(
    "src/state/operations/OperationalContext.tsx",
    "utf8",
  );
  const resolveBlock = provider.slice(
    provider.indexOf("const resolveSos ="),
    provider.indexOf("const cancelSos ="),
  );
  assert.match(resolveBlock, /taskResources\(sos\.linkedTaskId\)/);
  assert.match(resolveBlock, /transitionTask\(linkedTask\.id, "Hoàn thành"\)/);
  assert.match(provider, /resolveSos: atomic\(resolveSos\)/);
});
