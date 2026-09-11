/*
 * V2 (4 vai) — Phản ánh của người dân (entity mới thay cho nghiệp vụ đã xóa).
 * Công dân tạo phản ánh gắn ownerUserId, chỉ xem của mình; cán bộ PCTT đánh giá
 * Hợp lệ / Không hợp lệ / Trùng (bắt buộc lý do, Trùng phải chỉ bản gốc); không đánh giá hai lần.
 * Admin chỉ xem, không đánh giá.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createCitizenReportEntity,
  reviewCitizenReportEntity,
  type NewCitizenReportInput,
} from "../../src/application/reports/reportUseCases";
import { citizenReportReviewDecisions, isCitizenReportOpen } from "../../src/domain/reports/rules";
import { citizenReportCategories } from "../../src/domain/reports/types";
import { createAuthorizedOperationalView } from "../../src/application/authorization/authorizedOperationalView";
import { authorizeResources } from "../../src/lib/security/authorization";
import { hasPermission } from "../../src/lib/permissions/permissions";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

const NOW = "10/09/2024 15:00";
const user = (username: string) => {
  const found = demoUsers.find((item) => item.username === username);
  if (!found) throw new Error(`demo user ${username} không tồn tại`);
  return structuredClone(found);
};
const input = (): NewCitizenReportInput => ({
  reporterName: "Phạm Văn Đam",
  contact: "0912 000 111",
  category: "Ngập lụt",
  description: "Ngõ 124 Âu Cơ ngập 60cm, xe máy không qua được.",
  location: { address: "Ngõ 124 Âu Cơ, Tứ Liên", administrativeArea: "Tây Hồ, Hà Nội", coordinates: null },
});

test("tạo phản ánh: gắn ownerUserId, trạng thái Mới, validate nội dung/vị trí", () => {
  const report = createCitizenReportEntity("RPT-0001", input(), "USR-LOC-001", NOW);
  assert.equal(report.ownerUserId, "USR-LOC-001");
  assert.equal(report.status, "Mới");
  assert.equal(isCitizenReportOpen(report), true);
  assert.equal(report.reviewedBy, null);
  assert.ok(citizenReportCategories.includes(report.category));
  assert.throws(() => createCitizenReportEntity("RPT-0002", { ...input(), description: "  " }, "USR-LOC-001", NOW), /Nội dung/);
  assert.throws(
    () => createCitizenReportEntity("RPT-0003", { ...input(), location: { ...input().location, address: "" } }, "USR-LOC-001", NOW),
    /vị trí/,
  );
});

test("đánh giá: Hợp lệ không cần lý do; Không hợp lệ/Trùng bắt buộc lý do; Trùng phải chỉ bản gốc", () => {
  const report = createCitizenReportEntity("RPT-0001", input(), "USR-LOC-001", NOW);
  assert.deepEqual([...citizenReportReviewDecisions], ["Hợp lệ", "Không hợp lệ", "Trùng"]);
  const valid = reviewCitizenReportEntity(report, "Hợp lệ", "", "Nguyễn Quốc Trung", NOW);
  assert.equal(valid.status, "Hợp lệ");
  assert.equal(valid.reviewedBy, "Nguyễn Quốc Trung");
  assert.equal(valid.reviewNote, null);
  assert.throws(() => reviewCitizenReportEntity(report, "Không hợp lệ", "", "x", NOW), /lý do/);
  assert.throws(() => reviewCitizenReportEntity(report, "Trùng", "Đã có SOS", "x", NOW), /gốc/);
  const dup = reviewCitizenReportEntity(report, "Trùng", "Trùng với SOS đã tiếp nhận", "x", NOW, "SOS-YAGI-03");
  assert.equal(dup.duplicateOfId, "SOS-YAGI-03");
  assert.throws(() => reviewCitizenReportEntity(valid, "Không hợp lệ", "x", "x", NOW), /đã được đánh giá/);
});

test("quyền: công dân tạo/xem của mình; cán bộ đánh giá; admin chỉ xem; đơn vị cứu hộ chỉ xem của mình", () => {
  assert.equal(hasPermission("citizen", "report_create"), true);
  assert.equal(hasPermission("citizen", "report_view_own"), true);
  assert.equal(hasPermission("citizen", "report_view"), false);
  assert.equal(hasPermission("citizen", "report_review"), false);
  assert.equal(hasPermission("disaster_officer", "report_review"), true);
  assert.equal(hasPermission("admin", "report_view"), true);
  assert.equal(hasPermission("admin", "report_review"), true);
  assert.equal(hasPermission("rescue_unit", "report_review"), false);
  assert.equal(hasPermission("rescue_unit", "report_view"), false);
  const citizen = user("phamdam");
  assert.equal(
    authorizeResources(citizen, {
      permission: "report_view_own",
      resources: [{ type: "CitizenReport", id: "RPT-0001", geographicScope: "Tây Hồ, Hà Nội", ownerUserId: citizen.id }],
    }).allowed,
    true,
  );
  assert.equal(
    authorizeResources(citizen, {
      permission: "report_view_own",
      resources: [{ type: "CitizenReport", id: "RPT-0002", geographicScope: "Tây Hồ, Hà Nội", ownerUserId: "USR-CTZ-001" }],
    }).allowed,
    false,
  );
});

test("authorized view: công dân chỉ thấy phản ánh của mình, cán bộ thấy tất cả", () => {
  const source = inMemoryOperationalRepository.load();
  source.citizenReports = [
    createCitizenReportEntity("RPT-A", input(), "USR-LOC-001", NOW),
    createCitizenReportEntity("RPT-B", { ...input(), reporterName: "Trần Thái Tuấn" }, "USR-CTZ-001", NOW),
    ...source.citizenReports,
  ];
  const mine = createAuthorizedOperationalView(user("phamdam"), source).citizenReports;
  assert.ok(mine.some((item) => item.id === "RPT-A"));
  assert.equal(mine.some((item) => item.id === "RPT-B"), false);
  assert.ok(mine.every((item) => item.ownerUserId === "USR-LOC-001"));
  const officer = createAuthorizedOperationalView(user("nguyentrung"), source).citizenReports;
  assert.equal(officer.length, source.citizenReports.length);
  const admin = createAuthorizedOperationalView(user("thuantq"), source).citizenReports;
  assert.equal(admin.length, source.citizenReports.length);
});
