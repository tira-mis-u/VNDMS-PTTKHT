/*
 * V2 (4 vai): đăng nhập bằng username thật (thuantq/nguyentrung…), vai sau đăng nhập là
 * admin/disaster_officer; storage key v5 (session/users). Bổ sung test minhtri/namanh
 * (đổi sang công dân) vẫn đăng nhập được với mật khẩu cũ.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loginUser, logoutUser } from "../../src/application/auth/authUseCases";
import {
  LocalAuthenticationAdapter,
  type StorageLike,
} from "../../src/infrastructure/auth/localAuthenticationAdapter";
import { demoUsers } from "../../src/infrastructure/auth/demoUsers";
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
const clock =
  (value = "2026-08-21T03:45:00.000Z") =>
  () =>
    new Date(value);
test("đăng nhập hợp lệ tạo session 8 giờ và user admin", async () => {
  const adapter = new LocalAuthenticationAdapter(
    new MemoryStorage(),
    clock(),
    () => "token",
  );
  const result = await loginUser(
    adapter,
    "thuantq",
    "VNDMS@2026",
    clock(),
  );
  assert.equal(result.ok, true);
  assert.equal(result.user?.role, "admin");
  assert.equal(result.session?.userId, "USR-CMD-001");
  assert.equal(result.audit.action, "LOGIN_SUCCESS");
  assert.equal(
    new Date(result.session!.expiresAt).getTime() -
      new Date(result.session!.issuedAt).getTime(),
    8 * 60 * 60 * 1000,
  );
});
test("mật khẩu sai bị từ chối và ghi LOGIN_FAILED", async () => {
  const adapter = new LocalAuthenticationAdapter(
    new MemoryStorage(),
    clock(),
    () => "token",
  );
  const result = await loginUser(
    adapter,
    "thuantq",
    "sai-mat-khau",
    clock(),
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /không chính xác/);
  assert.equal(result.audit.action, "LOGIN_FAILED");
  assert.equal(result.audit.result, "FAILED");
});
test("tài khoản inactive không thể đăng nhập", async () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "vndms.auth.users.v5",
    JSON.stringify(
      demoUsers.map((user) =>
        user.id === "USR-OPS-001" ? { ...user, active: false } : user,
      ),
    ),
  );
  const adapter = new LocalAuthenticationAdapter(
    storage,
    clock(),
    () => "token",
  );
  const result = await loginUser(
    adapter,
    "nguyentrung",
    "VNDMS@2026",
    clock(),
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /vô hiệu hóa/);
});
test("refresh khôi phục session còn hạn", async () => {
  const storage = new MemoryStorage();
  const adapter = new LocalAuthenticationAdapter(
    storage,
    clock(),
    () => "token",
  );
  await adapter.authenticate("nguyentrung", "VNDMS@2026");
  const restored = new LocalAuthenticationAdapter(
    storage,
    clock("2026-08-21T04:00:00.000Z"),
    () => "other",
  ).restoreSession();
  assert.equal(restored.valid, true);
  assert.equal(restored.user?.username, "nguyentrung");
});
test("session hết hạn bị xóa và từ chối", async () => {
  const storage = new MemoryStorage();
  const adapter = new LocalAuthenticationAdapter(
    storage,
    clock(),
    () => "token",
  );
  await adapter.authenticate("thuantq", "VNDMS@2026");
  const expired = new LocalAuthenticationAdapter(
    storage,
    clock("2026-08-21T12:00:00.000Z"),
    () => "other",
  ).restoreSession();
  assert.equal(expired.valid, false);
  assert.equal(expired.expired, true);
  assert.match(expired.reason, /hết hạn/);
});
test("logout hủy session và token cũ không thể restore", async () => {
  const storage = new MemoryStorage();
  const adapter = new LocalAuthenticationAdapter(
    storage,
    clock(),
    () => "token",
  );
  const auth = await adapter.authenticate("thuantq", "VNDMS@2026");
  const audit = logoutUser(adapter, auth.user, auth.session, clock());
  assert.equal(audit.action, "LOGOUT");
  assert.equal(adapter.restoreSession().valid, false);
});
test("session malformed được loại bỏ an toàn", () => {
  const storage = new MemoryStorage();
  storage.setItem("vndms.auth.session.v5", '{"foo":true}');
  const result = new LocalAuthenticationAdapter(
    storage,
    clock(),
  ).restoreSession();
  assert.equal(result.valid, false);
  assert.match(result.reason, /không hợp lệ/);
});
test("tài khoản chuyển sang công dân (minhtri, namanh) vẫn đăng nhập với mật khẩu cũ", async () => {
  for (const [username, id] of [["minhtri", "USR-RSM-001"], ["namanh", "USR-WHS-001"], ["phamdam", "USR-LOC-001"], ["trantuan", "USR-CTZ-001"]] as const) {
    const adapter = new LocalAuthenticationAdapter(new MemoryStorage(), clock(), () => "token");
    const result = await loginUser(adapter, username, "VNDMS@2026", clock());
    assert.equal(result.ok, true, username);
    assert.equal(result.user?.id, id);
    assert.equal(result.user?.role, "citizen");
    assert.equal(result.user?.teamId, undefined);
    assert.equal(result.user?.warehouseId, undefined);
  }
  const rescue = await loginUser(new LocalAuthenticationAdapter(new MemoryStorage(), clock(), () => "token"), "phamhieu", "VNDMS@2026", clock());
  assert.equal(rescue.user?.role, "rescue_unit");
  assert.equal(rescue.user?.teamId, undefined, "không còn gắn một đội cụ thể");
});
