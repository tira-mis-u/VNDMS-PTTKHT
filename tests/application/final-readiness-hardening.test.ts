import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertIncidentCanClose } from "../../src/application/incidents/incidentUseCases";
import { parseRoute } from "../../src/app/routes/router";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const incidentId = "INC-0241";

test("không đóng Incident khi còn operational dependency đang mở", () => {
  const snapshot = inMemoryOperationalRepository.load();
  assert.throws(
    () =>
      assertIncidentCanClose(incidentId, {
        tasks: snapshot.tasks,
        sosRequests: snapshot.sosRequests,
        evacuations: snapshot.evacuationOperations,
        reliefRequests: snapshot.reliefRequests,
        playbookExecutions: snapshot.playbookExecutions,
      }),
    /Không thể đóng sự cố/,
  );
});

test("cho phép đóng Incident khi mọi operational dependency đã kết thúc", () => {
  assert.doesNotThrow(() =>
    assertIncidentCanClose(incidentId, {
      tasks: [],
      sosRequests: [],
      evacuations: [],
      reliefRequests: [],
      playbookExecutions: [],
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
