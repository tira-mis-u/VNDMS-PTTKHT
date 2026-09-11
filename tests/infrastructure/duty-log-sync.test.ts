import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDutyEntry,
  formatDutyClock,
  formatDutyDay,
  getDutyShift,
  mergeDutyEntries,
  type DutyLogEntry,
} from "../../src/infrastructure/duty/dutyLogStore";

const entry = (overrides: Partial<DutyLogEntry> & { id: string }): DutyLogEntry => ({
  at: "2026-09-10T08:00:00.000Z",
  actor: "Trực ban A",
  actorRole: "Cán bộ trực",
  kind: "Ghi nhận",
  text: "Mực nước sông Hồng lên nhanh.",
  ...overrides,
});

test("hợp nhất: giữ tất cả bản hai phía, mới nhất trước", () => {
  const merged = mergeDutyEntries(
    [entry({ id: "DUTY-OLD", at: "2026-09-09T08:00:00.000Z" })],
    [entry({ id: "DUTY-NEW", at: "2026-09-10T08:00:00.000Z" })],
  );
  assert.deepEqual(
    merged.map((item) => item.id),
    ["DUTY-NEW", "DUTY-OLD"],
  );
});

test("hợp nhất: cùng id thì chỉ giữ một bản, ưu tiên bản máy chủ", () => {
  const merged = mergeDutyEntries(
    [entry({ id: "DUTY-1", text: "Bản máy A" })],
    [entry({ id: "DUTY-1", text: "Bản máy chủ" })],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.text, "Bản máy chủ");
});

test("hợp nhất: bản đã thu hồi luôn thắng dù ở phía nào", () => {
  const retractedLocal = entry({ id: "DUTY-2", text: "[Đã thu hồi bởi A] Ghi nhầm" });
  const plainRemote = entry({ id: "DUTY-2", text: "Ghi nhầm" });
  assert.equal(mergeDutyEntries([retractedLocal], [plainRemote])[0]?.text, retractedLocal.text);
  assert.equal(mergeDutyEntries([plainRemote], [retractedLocal])[0]?.text, retractedLocal.text);
});

test("hợp nhất: bỏ qua bản ghi hỏng thiếu id", () => {
  const merged = mergeDutyEntries([], [
    entry({ id: "DUTY-3" }),
    { at: "", actor: "", actorRole: "", kind: "Ghi nhận", text: "hỏng" } as DutyLogEntry,
  ]);
  assert.deepEqual(merged.map((item) => item.id), ["DUTY-3"]);
});

test("nhóm ngày: Hôm nay / Hôm qua / ngày cụ thể", () => {
  const now = new Date();
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  assert.equal(formatDutyDay(today.toISOString()), "Hôm nay");
  assert.equal(formatDutyDay(yesterday.toISOString()), "Hôm qua");
  assert.match(formatDutyDay("2026-01-15T08:00:00.000Z"), /15\/01\/2026/);
  assert.equal(formatDutyDay("không phải ngày"), "");
});

test("ca trực: ranh giới 6h / 14h / 22h", () => {
  const at = (hour: number, minute = 0) => {
    const date = new Date(2026, 8, 10, hour, minute);
    return getDutyShift(date);
  };
  assert.deepEqual(at(5, 59), { name: "Ca 3", range: "22:00–6:00" });
  assert.deepEqual(at(6), { name: "Ca 1", range: "6:00–14:00" });
  assert.deepEqual(at(13, 59).name, "Ca 1");
  assert.deepEqual(at(14), { name: "Ca 2", range: "14:00–22:00" });
  assert.deepEqual(at(21, 59).name, "Ca 2");
  assert.deepEqual(at(22), { name: "Ca 3", range: "22:00–6:00" });
  assert.deepEqual(at(2).name, "Ca 3");
});

test("giờ sổ cái chỉ hiện HH:MM, ngày hỏng hiện --:--", () => {
  assert.match(formatDutyClock("2026-09-10T07:48:00.000Z"), /\d{2}:\d{2}/);
  assert.equal(formatDutyClock("không phải ngày"), "--:--");
});

test("bản ghi giữ nguyên liên kết hồ sơ khi tạo", () => {
  const record = appendDutyEntry({
    actor: "Trực ban A",
    actorRole: "Cán bộ trực",
    kind: "Chỉ đạo",
    text: "Điều đội tới hiện trường.",
    link: { kind: "sos", id: "SOS-1", code: "SOS-1" },
  });
  assert.deepEqual(record.link, { kind: "sos", id: "SOS-1", code: "SOS-1" });
});
