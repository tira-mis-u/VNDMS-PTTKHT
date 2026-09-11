import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultScopedArea,
  isNationalScope,
  normalizeAreaName,
  scopeAreaOptions,
} from "../../src/application/areas/scopedAreas";

const AREAS = ["Tây Hồ", "Hoàn Kiếm", "Long Biên", "Ba Đình"];

test("chuẩn hoá tên địa bàn: thường, bỏ dấu, gọn khoảng trắng", () => {
  assert.equal(normalizeAreaName("Tây Hồ"), "tay ho");
  assert.equal(normalizeAreaName("  HOÀN   KIẾM "), "hoan kiem");
  assert.equal(normalizeAreaName("Đống Đa"), "dong da");
});

test("phạm vi toàn quốc giữ nguyên toàn bộ dropdown", () => {
  assert.equal(isNationalScope({ level: "national", code: "VN", name: "Toàn quốc" }), true);
  assert.equal(isNationalScope(null), true);
  assert.deepEqual(
    scopeAreaOptions(AREAS, { level: "national", code: "VN", name: "Toàn quốc" }),
    AREAS,
  );
});

test("phạm vi quận/huyện chỉ giữ khu vực thuộc địa bàn hồ sơ", () => {
  assert.deepEqual(
    scopeAreaOptions(AREAS, { level: "district", code: "HN-TAYHO", name: "Tây Hồ, Hà Nội" }),
    ["Tây Hồ"],
  );
  assert.deepEqual(
    scopeAreaOptions(AREAS, { level: "district", code: "HN-HOANKIEM", name: "Hoàn Kiếm, Hà Nội" }),
    ["Hoàn Kiếm"],
  );
});

test("không khớp khu vực nào thì giữ nguyên (không khoá trắng dropdown)", () => {
  assert.deepEqual(
    scopeAreaOptions(AREAS, { level: "province", code: "HP", name: "Hải Phòng" }),
    AREAS,
  );
});

test("địa bàn còn đúng 1 khu vực thì chọn sẵn, nhiều khu vực thì giữ Tất cả", () => {
  assert.equal(defaultScopedArea(["Tây Hồ"]), "Tây Hồ");
  assert.equal(defaultScopedArea(AREAS), "Tất cả khu vực");
  assert.equal(defaultScopedArea([]), "Tất cả khu vực");
});
