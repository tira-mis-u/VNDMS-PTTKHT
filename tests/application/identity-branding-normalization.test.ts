/*
 * V2 (4 vai) — danh tính tài khoản & branding.
 * Baseline của file này đã đỏ toàn bộ (import `VIETNAM_SEA_LABELS` không tồn tại, test AI/
 * Simulation, 6 tài khoản đăng nhập bằng họ tên của kịch bản cũ). Viết lại theo contract V2:
 *  - 7 tài khoản, username/ID giữ nguyên, vai theo bảng mapping bắt buộc, 4 công dân.
 *  - Không còn teamId/warehouseId trên tài khoản; không có tài khoản seed/bootstrap mới.
 *  - Tên hiển thị lấy từ nguồn danh tính duy nhất (PERSONNEL).
 *  - Tham chiếu SOS/nhiệm vụ → sự cố/đội không orphan; kiểm tra branding giữ nguyên.
 * Các bất nhất dữ liệu seed Yagi có sẵn (leader CN-QUANDOI-01 mang quân hàm, teamLeader
 * TSK-YAGI-06) không thuộc phạm vi refactor vai nên không bị khóa bằng test ở đây.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
import {
  LocalAuthenticationAdapter,
  V2_ACCOUNT_ROLE_MAP,
  type StorageLike,
} from "../../src/infrastructure/auth/localAuthenticationAdapter";
import { PERSONNEL, personName } from "../../src/data/identity/personnel";
import { roleLabels } from "../../src/domain/auth/labels";
import { inMemoryOperationalRepository } from "../../src/infrastructure/persistence/inMemoryOperationalRepository";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const accounts = [
  ["thuantq", "USR-CMD-001", "admin"],
  ["nguyentrung", "USR-OPS-001", "disaster_officer"],
  ["phamdam", "USR-LOC-001", "citizen"],
  ["phamhieu", "USR-RSL-001", "rescue_unit"],
  ["minhtri", "USR-RSM-001", "citizen"],
  ["namanh", "USR-WHS-001", "citizen"],
  ["trantuan", "USR-CTZ-001", "citizen"],
] as const;

function textFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const target = join(path, name);
    return statSync(target).isDirectory() ? textFiles(target) : [target];
  });
}

test("bảy tài khoản giữ nguyên username/ID, vai theo bảng mapping V2, bốn công dân", async () => {
  assert.equal(demoUsers.length, 7);
  assert.deepEqual(
    demoUsers.map((user) => [user.username, user.id, user.role]),
    accounts,
  );
  assert.deepEqual(
    Object.fromEntries(demoUsers.map((user) => [user.id, user.role])),
    V2_ACCOUNT_ROLE_MAP,
  );
  assert.equal(demoUsers.filter((user) => user.role === "citizen").length, 4);
  assert.deepEqual(
    [...new Set(demoUsers.map((user) => user.role))].sort(),
    ["admin", "citizen", "disaster_officer", "rescue_unit"],
  );
  assert.equal(Object.keys(roleLabels).length, 4);
  for (const [username, id] of accounts) {
    const adapter = new LocalAuthenticationAdapter(new MemoryStorage());
    const result = await adapter.authenticate(username, "VNDMS@2026");
    assert.equal(result.user.id, id);
    assert.equal(result.user.username, username);
  }
});

test("không còn teamId/warehouseId trên tài khoản và không có tài khoản seed mới", () => {
  for (const user of demoUsers) {
    assert.equal(user.teamId, undefined, `${user.username} còn teamId`);
    assert.equal(user.warehouseId, undefined, `${user.username} còn warehouseId`);
  }
  assert.equal(demoUsers.some((user) => /quantri|admin/i.test(user.username)), false);
  assert.equal(demoUsers.some((user) => user.id === "USR-ADMIN-DEMO"), false);
});

test("tên hiển thị tài khoản lấy từ nguồn danh tính duy nhất", () => {
  const byId = new Map(Object.values(PERSONNEL).map((person) => [person.id, person]));
  for (const user of demoUsers) {
    const person = byId.get(user.id);
    assert.ok(person, `${user.id} không có trong PERSONNEL`);
    assert.equal(user.displayName, personName(user.id));
    assert.equal(person!.role, user.role, `${user.username}: PERSONNEL.role lệch với demoUsers`);
  }
  const source = readFileSync("src/infrastructure/auth/demoUsers.ts", "utf8");
  for (const user of demoUsers)
    assert.equal(source.includes(`"${user.displayName}"`), false, `${user.displayName} bị hardcode trong demoUsers.ts`);
});

test("SOS/nhiệm vụ tham chiếu sự cố và đội tồn tại (không orphan)", () => {
  const snapshot = inMemoryOperationalRepository.load();
  const teams = new Set(snapshot.teams.map((team) => team.id));
  const incidents = new Set(snapshot.incidents.map((item) => item.id));
  for (const task of snapshot.tasks) {
    assert.ok(incidents.has(task.incidentId), `${task.id} thiếu Incident`);
    if (task.teamId) assert.ok(teams.has(task.teamId), `${task.id} thiếu Team`);
  }
  for (const sos of snapshot.sosRequests) {
    if (sos.linkedIncidentId) assert.ok(incidents.has(sos.linkedIncidentId));
    if (sos.linkedTaskId) assert.ok(snapshot.tasks.some((item) => item.id === sos.linkedTaskId));
    if (sos.assignedTeamId) assert.ok(teams.has(sos.assignedTeamId));
  }
});

test("branding và geographic labels đã normalize trong source/docs", () => {
  const files = [
    ...textFiles("src"),
    ...textFiles("tests"),
    ...textFiles("docs"),
    ...textFiles("public"),
    "README.md",
    "index.html",
  ];
  const content = files.map((path) => readFileSync(path, "utf8")).join("\n");
  const legacyBrand = ["VN", "-DOCP"].join("");
  const legacyPasswordBrand = ["VN", "DOCP"].join("");
  const forbiddenEnglishSea = ["South China", " Sea"].join("");
  assert.equal(content.includes(legacyBrand), false);
  assert.equal(content.includes(legacyPasswordBrand), false);
  assert.equal(content.includes(forbiddenEnglishSea), false);
});
