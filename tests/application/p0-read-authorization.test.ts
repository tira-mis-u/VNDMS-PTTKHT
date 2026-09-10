/*
 * V2 (4 vai) — read model theo quyền.
 *  - "Local Officer Tây Hồ" không còn: phamdam là công dân → test scope địa lý chuyển
 *    sang cán bộ PCTT bị thu hẹp scope (giữ nguyên contract lọc theo địa bàn).
 *  - Test kho gỡ cùng module Kho; rescue_unit thấy mọi đội (chỉ huy toàn lực lượng).
 *  - Thêm contract V2: công dân chỉ thấy SOS/phản ánh do chính mình gửi (ownerUserId)
 *    và chỉ Cảnh báo công bố ở trạng thái "Đã công bố".
 *  - Kịch bản Yagi 2024: INC-YAGI-01 (Lào Cai), INC-YAGI-03 (Hà Nội).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { parseRoute } from "../../src/app/routes/router";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
/** Cán bộ PCTT bị thu hẹp scope về tỉnh Lào Cai để kiểm lọc địa bàn. */
const laoCaiOfficer = () => ({
  ...user("nguyentrung"),
  geographicScope: { level: "province" as const, name: "Lào Cai", code: "LC" },
});
const citizen = () => ({
  ...user("thuantq"),
  id: "USR-CITIZEN-TEST",
  username: "citizen-test",
  displayName: "Công dân kiểm thử",
  role: "citizen" as const,
  geographicScope: {
    level: "commune" as const,
    name: "Tứ Liên, Tây Hồ, Hà Nội",
    code: "HN-TAYHO-TULIEN",
  },
});

test("Cán bộ scope tỉnh chỉ nhận collection trong Lào Cai", () => {
  const view = createAuthorizedOperationalView(laoCaiOfficer(), inMemoryOperationalRepository.load());
  assert.ok(view.incidents.some((item) => item.id === "INC-YAGI-01"));
  assert.ok(
    view.incidents.every((item) => `${item.location.name}, ${item.affectedArea}`.includes("Lào Cai")),
  );
  assert.equal(view.incidents.some((item) => item.id === "INC-YAGI-03"), false);
  assert.ok(view.teams.some((item) => item.id === "CH-LC-01"));
  assert.equal(view.teams.some((item) => item.id === "CH-HN-01"), false);
});

test("đổi URL detail không lấy được entity ngoài scope", () => {
  const route = parseRoute("/incidents/INC-YAGI-03");
  assert.deepEqual(route, { name: "incident-detail", id: "INC-YAGI-03" });
  const view = createAuthorizedOperationalView(laoCaiOfficer(), inMemoryOperationalRepository.load());
  assert.equal(view.incidents.find((item) => item.id === route.id), undefined);
});

test("related collections không làm rò Incident ngoài scope", () => {
  const source = inMemoryOperationalRepository.load();
  const outside = source.incidents.find((item) => item.id === "INC-YAGI-03")!;
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
  const view = createAuthorizedOperationalView(laoCaiOfficer(), source);
  assert.equal(view.tasks.some((item) => item.id === task.id), false);
  assert.equal(view.sosRequests.some((item) => item.id === sos.id), false);
  assert.equal(view.events.some((item) => item.incidentId === outside.id), false);
});

test("global roles giữ visibility, Citizen không nhận operational read model (trừ điểm sơ tán)", () => {
  const source = inMemoryOperationalRepository.load();
  for (const username of ["thuantq", "nguyentrung"]) {
    const view = createAuthorizedOperationalView(user(username), source);
    assert.equal(view.incidents.length, source.incidents.length);
    assert.equal(view.tasks.length, source.tasks.length);
    assert.equal(view.sosRequests.length, source.sosRequests.length);
  }
  const citizenView = createAuthorizedOperationalView(citizen(), source);
  assert.equal(citizenView.incidents.length, 0);
  assert.equal(citizenView.tasks.length, 0);
  assert.equal(citizenView.teams.length, 0);
  assert.equal(citizenView.sosRequests.length, 0, "seed SOS không có ownerUserId của công dân kiểm thử");
  assert.equal(citizenView.shelters.length, source.shelters.length, "điểm sơ tán là danh mục tra cứu chung");
});

test("rescue_unit thấy toàn bộ đội; các tài khoản chuyển sang công dân không còn ownership cũ", () => {
  const source = inMemoryOperationalRepository.load();
  const rescue = createAuthorizedOperationalView(user("phamhieu"), source);
  assert.equal(rescue.teams.length, source.teams.length);
  assert.equal(rescue.tasks.length, source.tasks.length);
  for (const username of ["phamdam", "minhtri", "namanh", "trantuan"]) {
    const view = createAuthorizedOperationalView(user(username), source);
    assert.equal(view.teams.length, 0, `${username} không còn thấy đội`);
    assert.equal(view.tasks.length, 0, `${username} không còn thấy nhiệm vụ`);
    assert.equal(view.incidents.length, 0, `${username} không còn thấy sự cố`);
  }
});

test("công dân chỉ thấy SOS/phản ánh do chính mình gửi và chỉ cảnh báo Đã công bố", () => {
  const source = inMemoryOperationalRepository.load();
  const me = citizen();
  const mine = { ...structuredClone(source.sosRequests[0]), id: "SOS-MINE", ownerUserId: me.id };
  const other = { ...structuredClone(source.sosRequests[0]), id: "SOS-OTHER", ownerUserId: "USR-SOMEONE" };
  source.sosRequests.unshift(mine, other);
  const reportTemplate = source.citizenReports[0];
  if (reportTemplate) {
    source.citizenReports.unshift(
      { ...structuredClone(reportTemplate), id: "RPT-MINE", ownerUserId: me.id },
      { ...structuredClone(reportTemplate), id: "RPT-OTHER", ownerUserId: "USR-SOMEONE" },
    );
  }
  const view = createAuthorizedOperationalView(me, source);
  assert.deepEqual(view.sosRequests.map((item) => item.id), ["SOS-MINE"]);
  if (reportTemplate) {
    assert.ok(view.citizenReports.some((item) => item.id === "RPT-MINE"));
    assert.equal(view.citizenReports.some((item) => item.id === "RPT-OTHER"), false);
  }
  assert.ok(view.publishedAlerts.length > 0, "seed phải có ít nhất một cảnh báo Đã công bố");
  assert.ok(view.publishedAlerts.every((item) => item.status === "Đã công bố"));
  const officerView = createAuthorizedOperationalView(user("nguyentrung"), source);
  assert.ok(
    officerView.publishedAlerts.length >= view.publishedAlerts.length,
    "cán bộ (published_alert_manage) thấy cả bản nháp/thu hồi",
  );
});
