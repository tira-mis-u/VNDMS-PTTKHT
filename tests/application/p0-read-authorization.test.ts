import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { parseRoute } from "../../src/app/routes/router";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const user = (username: string) =>
  structuredClone(demoUsers.find((item) => item.username === username)!);
const citizen = () => ({
  ...user("Trần Quốc Thuận"),
  id: "USR-CITIZEN-TEST",
  username: "Công dân kiểm thử",
  displayName: "Công dân kiểm thử",
  role: "citizen" as const,
  geographicScope: {
    level: "commune" as const,
    name: "Tứ Liên, Tây Hồ, Hà Nội",
    code: "HN-TAYHO-TULIEN",
  },
});

test("Local Officer chỉ nhận collection trong Tây Hồ", () => {
  const view = createAuthorizedOperationalView(
    user("Phạm Văn Đam"),
    inMemoryOperationalRepository.load(),
  );
  assert.ok(view.incidents.some((item) => item.id === "INC-0241"));
  assert.ok(
    view.incidents.every((item) =>
      `${item.location.name}, ${item.affectedArea}`.includes("Tây Hồ, Hà Nội"),
    ),
  );
  assert.equal(
    view.incidents.some((item) => item.id === "INC-0234"),
    false,
  );
  assert.ok(view.teams.some((item) => item.id === "CH-03"));
  assert.equal(
    view.teams.some((item) => item.id === "CH-05"),
    false,
  );
});

test("đổi URL detail không lấy được entity ngoài scope", () => {
  const route = parseRoute("/incidents/INC-0234");
  assert.deepEqual(route, { name: "incident-detail", id: "INC-0234" });
  const view = createAuthorizedOperationalView(
    user("Phạm Văn Đam"),
    inMemoryOperationalRepository.load(),
  );
  assert.equal(
    view.incidents.find((item) => item.id === route.id),
    undefined,
  );
});

test("related collections không làm rò Incident ngoài scope", () => {
  const source = inMemoryOperationalRepository.load();
  const outside = source.incidents.find((item) => item.id === "INC-0234")!;
  const task = structuredClone(source.tasks[0]);
  task.id = "TSK-OUTSIDE";
  task.incidentId = outside.id;
  task.location = outside.location.name;
  task.coordinates = outside.location.coordinates;
  source.tasks.unshift(task);
  const sos = structuredClone(source.sosRequests[0]);
  sos.id = "SOS-OUTSIDE";
  sos.linkedIncidentId = outside.id;
  sos.location.administrativeArea = outside.location.name;
  source.sosRequests.unshift(sos);
  const view = createAuthorizedOperationalView(user("Phạm Văn Đam"), source);
  assert.equal(
    view.tasks.some((item) => item.id === task.id),
    false,
  );
  assert.equal(
    view.sosRequests.some((item) => item.id === sos.id),
    false,
  );
  assert.equal(
    view.events.some((item) => item.incidentId === outside.id),
    false,
  );
});

test("global roles giữ visibility, Citizen không nhận operational read model", () => {
  const source = inMemoryOperationalRepository.load();
  for (const username of ["Trần Quốc Thuận", "Nguyễn Quốc Trung"]) {
    const view = createAuthorizedOperationalView(user(username), source);
    assert.equal(view.incidents.length, source.incidents.length);
    assert.equal(view.tasks.length, source.tasks.length);
    assert.equal(view.sosRequests.length, source.sosRequests.length);
  }
  const citizenView = createAuthorizedOperationalView(citizen(), source);
  assert.equal(citizenView.incidents.length, 0);
  assert.equal(citizenView.tasks.length, 0);
  assert.equal(citizenView.sosRequests.length, 0);
  assert.equal(citizenView.reliefRequests.length, 0);
});

test("rescue và warehouse read model tuân ownership hiện hữu", () => {
  const source = inMemoryOperationalRepository.load();
  const rescue = createAuthorizedOperationalView(
    user("Phạm Trung Hiếu"),
    source,
  );
  assert.deepEqual(
    rescue.teams.map((item) => item.id),
    ["CH-05"],
  );
  assert.ok(
    rescue.tasks.every((item) => !item.teamId || item.teamId === "CH-05"),
  );
  const warehouse = createAuthorizedOperationalView(
    user("Nguyễn Nam Anh"),
    source,
  );
  assert.ok(warehouse.warehouses.every((item) => item.id === "KHO-01"));
  assert.ok(warehouse.inventory.every((item) => item.warehouseId === "KHO-01"));
  assert.ok(warehouse.shipments.every((item) => item.warehouseId === "KHO-01"));
});
