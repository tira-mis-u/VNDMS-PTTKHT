/*
 * V2 (4 vai) — Cảnh báo công bố (entity mới): Nháp → Đã công bố → Đã thu hồi.
 * Cán bộ PCTT soạn/công bố/cập nhật/thu hồi; công dân (và mọi vai không có
 * published_alert_manage) chỉ thấy bản "Đã công bố"; cập nhật sau công bố tăng revision;
 * thu hồi bắt buộc lý do; bản đã thu hồi không sửa được.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublishedAlertDraft,
  publishAlertEntity,
  updatePublishedAlertEntity,
  withdrawAlertEntity,
  type PublishedAlertDraftInput,
} from "../../src/application/published-alerts/publishedAlertUseCases";
import { isPublicAlert, publishedAlertTransitions } from "../../src/domain/published-alerts/rules";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { hasPermission } from "../../src/lib/permissions/permissions";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const NOW = "10/09/2024 15:00";
const LATER = "10/09/2024 16:00";
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const draftInput = (): PublishedAlertDraftInput => ({
  title: "Cảnh báo lũ sông Thao vượt báo động 3",
  content: "Người dân ven sông Thao tại TP. Yên Bái di dời ngay theo hướng dẫn.",
  severity: "critical",
  areaName: "Yên Bái",
});

test("soạn nháp: validate tiêu đề/nội dung/khu vực; trạng thái Nháp, revision 0", () => {
  const draft = createPublishedAlertDraft("PUB-0001", draftInput(), "Nguyễn Quốc Trung", NOW);
  assert.equal(draft.status, "Nháp");
  assert.equal(draft.revision, 0);
  assert.equal(draft.publishedAt, null);
  assert.equal(isPublicAlert(draft), false);
  assert.throws(() => createPublishedAlertDraft("x", { ...draftInput(), title: " " }, "a", NOW), /Tiêu đề/);
  assert.throws(() => createPublishedAlertDraft("x", { ...draftInput(), content: "" }, "a", NOW), /Nội dung/);
  assert.throws(() => createPublishedAlertDraft("x", { ...draftInput(), areaName: "" }, "a", NOW), /khu vực/);
});

test("vòng đời: Nháp → Đã công bố → Đã thu hồi; không đi ngược; thu hồi cần lý do", () => {
  assert.deepEqual(publishedAlertTransitions, {
    Nháp: ["Đã công bố"],
    "Đã công bố": ["Đã thu hồi"],
    "Đã thu hồi": [],
  });
  const draft = createPublishedAlertDraft("PUB-0001", draftInput(), "Nguyễn Quốc Trung", NOW);
  assert.throws(() => withdrawAlertEntity(draft, "x", NOW), /Không thể chuyển/);
  const published = publishAlertEntity(draft, NOW);
  assert.equal(published.status, "Đã công bố");
  assert.equal(published.revision, 1);
  assert.equal(published.publishedAt, NOW);
  assert.equal(isPublicAlert(published), true);
  assert.throws(() => publishAlertEntity(published, LATER), /Không thể chuyển/);
  assert.throws(() => withdrawAlertEntity(published, "   ", LATER), /lý do/);
  const withdrawn = withdrawAlertEntity(published, "Mực nước đã rút dưới báo động 1", LATER);
  assert.equal(withdrawn.status, "Đã thu hồi");
  assert.equal(withdrawn.withdrawnAt, LATER);
  assert.throws(() => publishAlertEntity(withdrawn, LATER), /Không thể chuyển/);
  assert.throws(() => updatePublishedAlertEntity(withdrawn, draftInput(), LATER), /đã thu hồi/);
});

test("cập nhật: trước công bố giữ revision; sau công bố tăng revision để người dân biết bản tin mới", () => {
  const draft = createPublishedAlertDraft("PUB-0001", draftInput(), "Nguyễn Quốc Trung", NOW);
  const editedDraft = updatePublishedAlertEntity(draft, { ...draftInput(), title: "Tiêu đề mới" }, LATER);
  assert.equal(editedDraft.revision, 0);
  assert.equal(editedDraft.title, "Tiêu đề mới");
  const published = publishAlertEntity(editedDraft, LATER);
  const updated = updatePublishedAlertEntity(published, { ...draftInput(), content: "Bổ sung tuyến đường tránh." }, LATER);
  assert.equal(updated.revision, 2);
  assert.equal(updated.status, "Đã công bố");
  assert.equal(updated.publishedAt, LATER);
});

test("quyền và tầm nhìn: chỉ cán bộ PCTT quản lý; mọi vai khác chỉ thấy bản Đã công bố", () => {
  assert.equal(hasPermission("disaster_officer", "published_alert_manage"), true);
  for (const role of ["admin", "rescue_unit", "citizen"] as const) {
    assert.equal(hasPermission(role, "published_alert_manage"), false, role);
    assert.equal(hasPermission(role, "published_alert_view"), true, role);
  }
  const source = inMemoryOperationalRepository.load();
  const draft = createPublishedAlertDraft("PUB-DRAFT", draftInput(), "Nguyễn Quốc Trung", NOW);
  const withdrawn = withdrawAlertEntity(publishAlertEntity(draft, NOW), "Hết hiệu lực", LATER);
  source.publishedAlerts = [draft, { ...withdrawn, id: "PUB-WITHDRAWN", code: "PUB-WITHDRAWN" }, ...source.publishedAlerts];
  const seedPublic = source.publishedAlerts.filter(isPublicAlert).length;
  assert.ok(seedPublic > 0, "seed phải có bản tin Đã công bố");
  for (const username of ["trantuan", "phamdam", "thuantq", "phamhieu"]) {
    const view = createAuthorizedOperationalView(user(username), source);
    assert.equal(view.publishedAlerts.length, seedPublic, username);
    assert.ok(view.publishedAlerts.every(isPublicAlert), username);
  }
  const officer = createAuthorizedOperationalView(user("nguyentrung"), source);
  assert.equal(officer.publishedAlerts.length, source.publishedAlerts.length);
  assert.ok(officer.publishedAlerts.some((item) => item.status === "Nháp"));
});
