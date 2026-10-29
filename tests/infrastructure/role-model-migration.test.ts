/*
 * V2 (4 vai) — migration mô hình vai trò trên dữ liệu lưu cục bộ.
 * Yêu cầu: có version, idempotent, sao lưu trước khi ghi, rollback được, không đổi
 * username/ID/mật khẩu, gỡ teamId/warehouseId, tài khoản ngoài bảng với vai lạ được giữ
 * nguyên và liệt kê ngoại lệ, không tạo tài khoản seed/bootstrap mới.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  LocalAuthenticationAdapter,
  MIGRATION_LOG_KEY,
  ROLE_MODEL_VERSION,
  ROLE_MODEL_VERSION_KEY,
  USERS_BACKUP_KEY,
  V2_ACCOUNT_ROLE_MAP,
  migrateUserToRoleModelV2,
  rollbackRoleModelMigration,
  runRoleModelMigration,
  type StorageLike,
} from "../../src/infrastructure/auth/localAuthenticationAdapter";
import { LEGACY_ROLE_MAP } from "../../src/domain/shared/auth";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";

const USERS_KEY = "vndms.auth.users.v5";
class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
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
const clock = () => new Date("2026-09-09T02:00:00.000Z");
const now = "2026-01-01T00:00:00.000Z";

/** Dữ liệu V1 như một trình duyệt đã lưu trước refactor (7 vai cũ + teamId/warehouseId). */
function legacyUsers() {
  const scope = (level: "national" | "province" | "district", name: string, code: string) => ({ level, name, code });
  return [
    { id: "USR-CMD-001", username: "thuantq", displayName: "Trần Quốc Thuận", role: "commander", geographicScope: scope("national", "Toàn quốc", "VN"), active: true, createdAt: now, updatedAt: now },
    { id: "USR-OPS-001", username: "nguyentrung", displayName: "Nguyễn Quốc Trung", role: "operator", geographicScope: scope("national", "Toàn quốc", "VN"), active: true, createdAt: now, updatedAt: now },
    { id: "USR-LOC-001", username: "phamdam", displayName: "Phạm Văn Đam", role: "local_officer", geographicScope: scope("district", "Tây Hồ, Hà Nội", "HN-TAYHO"), active: true, createdAt: now, updatedAt: now },
    { id: "USR-RSL-001", username: "phamhieu", displayName: "Phạm Trung Hiếu", role: "rescue_leader", teamId: "CH-05", geographicScope: scope("province", "Hà Nội", "HN"), active: true, createdAt: now, updatedAt: now },
    { id: "USR-RSM-001", username: "minhtri", displayName: "Lê Nguyễn Minh Trí", role: "rescue_member", teamId: "CH-05", geographicScope: scope("province", "Hà Nội", "HN"), active: false, createdAt: now, updatedAt: now },
    { id: "USR-WHS-001", username: "namanh", displayName: "Nguyễn Nam Anh", role: "warehouse_staff", warehouseId: "KHO-01", geographicScope: scope("district", "Hoàn Kiếm, Hà Nội", "HN-HOANKIEM"), active: true, createdAt: now, updatedAt: now },
    { id: "USR-CTZ-001", username: "trantuan", displayName: "Trần Thái Tuấn", role: "citizen", geographicScope: scope("national", "Toàn quốc", "VN"), active: true, createdAt: now, updatedAt: now },
    // Tài khoản thật ngoài bảng: vai cũ hợp lệ → theo LEGACY_ROLE_MAP; vai lạ → ngoại lệ.
    { id: "USR-EXT-001", username: "ngoaibang1", displayName: "Người dùng ngoài bảng", role: "relief_worker", warehouseId: "KHO-02", geographicScope: scope("province", "Hải Phòng", "HP"), active: true, createdAt: now, updatedAt: now },
    { id: "USR-EXT-002", username: "ngoaibang2", displayName: "Vai không xác định", role: "auditor_external", geographicScope: scope("province", "Đà Nẵng", "DN"), active: true, createdAt: now, updatedAt: now },
  ];
}

test("bảng mapping bắt buộc theo ID và LEGACY_ROLE_MAP khớp yêu cầu V2", () => {
  assert.deepEqual(V2_ACCOUNT_ROLE_MAP, {
    "USR-CMD-001": "admin",
    "USR-OPS-001": "disaster_officer",
    "USR-RSL-001": "rescue_unit",
    "USR-LOC-001": "citizen",
    "USR-RSM-001": "citizen",
    "USR-WHS-001": "citizen",
    "USR-CTZ-001": "citizen",
  });
  assert.deepEqual(LEGACY_ROLE_MAP, {
    commander: "admin",
    operator: "disaster_officer",
    local_officer: "citizen",
    rescue_leader: "rescue_unit",
    rescue_member: "citizen",
    warehouse_staff: "citizen",
    relief_worker: "citizen",
    citizen: "citizen",
  });
  assert.equal(ROLE_MODEL_VERSION, 2);
});

test("migration có version, sao lưu trước, ghi log; giữ username/ID/active, gỡ teamId/warehouseId", () => {
  const storage = new MemoryStorage();
  const raw = JSON.stringify(legacyUsers());
  storage.setItem(USERS_KEY, raw);
  const result = runRoleModelMigration(storage, clock);
  assert.ok(result);
  assert.equal(result.version, 2);
  assert.equal(storage.getItem(ROLE_MODEL_VERSION_KEY), "2");
  assert.equal(storage.getItem(USERS_BACKUP_KEY), raw, "bản sao lưu phải là dữ liệu gốc nguyên vẹn");
  assert.ok(storage.getItem(MIGRATION_LOG_KEY));
  const migrated = JSON.parse(storage.getItem(USERS_KEY)!) as Array<Record<string, unknown>>;
  assert.equal(migrated.length, 9, "không thêm/bớt tài khoản");
  const byId = new Map(migrated.map((user) => [user.id as string, user]));
  for (const legacy of legacyUsers()) {
    const next = byId.get(legacy.id)!;
    assert.equal(next.username, legacy.username);
    assert.equal(next.displayName, legacy.displayName);
    assert.equal(next.active, legacy.active, `${legacy.username} active phải giữ nguyên`);
    assert.deepEqual(next.geographicScope, legacy.geographicScope);
  }
  for (const [id, role] of Object.entries(V2_ACCOUNT_ROLE_MAP)) assert.equal(byId.get(id)!.role, role, id);
  assert.equal(byId.get("USR-RSL-001")!.teamId, undefined);
  assert.equal(byId.get("USR-RSM-001")!.teamId, undefined);
  assert.equal(byId.get("USR-WHS-001")!.warehouseId, undefined);
  // Ngoài bảng: vai cũ hợp lệ → theo LEGACY_ROLE_MAP và gỡ warehouseId.
  assert.equal(byId.get("USR-EXT-001")!.role, "citizen");
  assert.equal(byId.get("USR-EXT-001")!.warehouseId, undefined);
  // Vai lạ → giữ nguyên, báo ngoại lệ.
  assert.equal(byId.get("USR-EXT-002")!.role, "auditor_external");
  assert.deepEqual(result.exceptions.map((entry) => entry.userId), ["USR-EXT-002"]);
  const strategies = Object.fromEntries(result.entries.map((entry) => [entry.userId, entry.strategy]));
  assert.equal(strategies["USR-CMD-001"], "mapped");
  assert.equal(strategies["USR-EXT-001"], "legacy");
  assert.equal(strategies["USR-EXT-002"], "exception");
  assert.equal(result.entries.find((entry) => entry.userId === "USR-RSL-001")!.droppedTeamId, "CH-05");
});

test("idempotent: chạy lại không đổi dữ liệu, không ghi đè bản sao lưu", () => {
  const storage = new MemoryStorage();
  storage.setItem(USERS_KEY, JSON.stringify(legacyUsers()));
  runRoleModelMigration(storage, clock);
  const afterFirst = storage.getItem(USERS_KEY);
  const backup = storage.getItem(USERS_BACKUP_KEY);
  const log = storage.getItem(MIGRATION_LOG_KEY);
  assert.equal(runRoleModelMigration(storage, clock), null);
  assert.equal(runRoleModelMigration(storage, () => new Date("2027-01-01T00:00:00Z")), null);
  assert.equal(storage.getItem(USERS_KEY), afterFirst);
  assert.equal(storage.getItem(USERS_BACKUP_KEY), backup);
  assert.equal(storage.getItem(MIGRATION_LOG_KEY), log);
  // Từng bản ghi cũng idempotent.
  const once = migrateUserToRoleModelV2(legacyUsers()[3]);
  const twice = migrateUserToRoleModelV2(once.user);
  assert.deepEqual(twice.user, once.user);
  assert.equal(twice.entry.strategy, "mapped");
});

test("rollback khôi phục đúng dữ liệu gốc, xóa version/log/phiên; migration chạy lại được sau đó", () => {
  const storage = new MemoryStorage();
  const raw = JSON.stringify(legacyUsers());
  storage.setItem(USERS_KEY, raw);
  storage.setItem("vndms.auth.session.v5", '{"stale":true}');
  runRoleModelMigration(storage, clock);
  assert.notEqual(storage.getItem(USERS_KEY), raw);
  assert.equal(rollbackRoleModelMigration(storage), true);
  assert.equal(storage.getItem(USERS_KEY), raw);
  assert.equal(storage.getItem(ROLE_MODEL_VERSION_KEY), null);
  assert.equal(storage.getItem(MIGRATION_LOG_KEY), null);
  assert.equal(storage.getItem("vndms.auth.session.v5"), null);
  assert.ok(runRoleModelMigration(storage, clock), "sau rollback có thể migrate lại");
  assert.equal(rollbackRoleModelMigration(new MemoryStorage()), false, "không có bản sao lưu → không rollback");
});

test("adapter: tài khoản cũ đăng nhập được với mật khẩu cũ sau migration; không tạo tài khoản mới", async () => {
  const storage = new MemoryStorage();
  storage.setItem(USERS_KEY, JSON.stringify(legacyUsers()));
  const adapter = new LocalAuthenticationAdapter(storage, clock, () => "token");
  const users = adapter.listUsers();
  assert.equal(users.length, 9, "listUsers không được thêm tài khoản seed mới");
  assert.equal(users.some((user) => /quantri/i.test(user.username) || user.id === "USR-ADMIN-DEMO"), false);
  const migration = adapter.lastRoleModelMigration();
  assert.equal(migration?.entries.length, 9);
  for (const [username, role] of [["namanh", "citizen"], ["phamhieu", "rescue_unit"], ["thuantq", "admin"], ["nguyentrung", "disaster_officer"]] as const) {
    const result = await adapter.authenticate(username, "VNDMS@2026");
    assert.equal(result.user.role, role, username);
    assert.equal(result.user.teamId, undefined);
    assert.equal(result.user.warehouseId, undefined);
  }
  // minhtri bị vô hiệu hóa trong dữ liệu cũ → migration không "bật" lại.
  await assert.rejects(adapter.authenticate("minhtri", "VNDMS@2026"), /vô hiệu hóa/);
  // Storage trống → seed đúng 7 tài khoản demo, không có migration entries.
  const fresh = new LocalAuthenticationAdapter(new MemoryStorage(), clock, () => "token");
  assert.deepEqual(fresh.listUsers().map((user) => user.id), demoUsers.map((user) => user.id));
});

test("safeUsers deduplicates accounts with the same username, preferring Cloud UUID identity", () => {
  const storage = new MemoryStorage();
  const mixedUsers = [
    {
      id: "a0000000-0000-0000-0000-000000000001",
      username: "thuantq",
      displayName: "Trần Quốc Thuận",
      role: "admin",
      geographicScope: { level: "national", name: "Toàn quốc", code: "VN" },
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "USR-CMD-001",
      username: "thuantq",
      displayName: "Trần Quốc Thuận",
      role: "admin",
      geographicScope: { level: "national", name: "Toàn quốc", code: "VN" },
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  storage.setItem(USERS_KEY, JSON.stringify(mixedUsers));
  storage.setItem(ROLE_MODEL_VERSION_KEY, "2");
  const adapter = new LocalAuthenticationAdapter(storage, clock, () => "token");
  const users = adapter.listUsers();
  const thuantqAccounts = users.filter((u) => u.username === "thuantq");
  assert.equal(thuantqAccounts.length, 1, "Chỉ được phép có duy nhất 1 tài khoản thuantq");
  assert.equal(thuantqAccounts[0].id, "a0000000-0000-0000-0000-000000000001", "Phải giữ lại tài khoản Cloud Auth UUID");
});
