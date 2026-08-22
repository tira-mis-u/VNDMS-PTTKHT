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
test("đăng nhập hợp lệ tạo session 8 giờ và user Commander", async () => {
  const adapter = new LocalAuthenticationAdapter(
    new MemoryStorage(),
    clock(),
    () => "token",
  );
  const result = await loginUser(
    adapter,
    "Trần Quốc Thuận",
    "VNDMS@2026",
    clock(),
  );
  assert.equal(result.ok, true);
  assert.equal(result.user?.role, "commander");
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
    "Trần Quốc Thuận",
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
    "vndms.auth.users.v2",
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
    "Nguyễn Quốc Trung",
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
  await adapter.authenticate("Nguyễn Quốc Trung", "VNDMS@2026");
  const restored = new LocalAuthenticationAdapter(
    storage,
    clock("2026-08-21T04:00:00.000Z"),
    () => "other",
  ).restoreSession();
  assert.equal(restored.valid, true);
  assert.equal(restored.user?.username, "Nguyễn Quốc Trung");
});
test("session hết hạn bị xóa và từ chối", async () => {
  const storage = new MemoryStorage();
  const adapter = new LocalAuthenticationAdapter(
    storage,
    clock(),
    () => "token",
  );
  await adapter.authenticate("Trần Quốc Thuận", "VNDMS@2026");
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
  const auth = await adapter.authenticate("Trần Quốc Thuận", "VNDMS@2026");
  const audit = logoutUser(adapter, auth.user, auth.session, clock());
  assert.equal(audit.action, "LOGOUT");
  assert.equal(adapter.restoreSession().valid, false);
});
test("session malformed được loại bỏ an toàn", () => {
  const storage = new MemoryStorage();
  storage.setItem("vndms.auth.session.v2", '{"foo":true}');
  const result = new LocalAuthenticationAdapter(
    storage,
    clock(),
  ).restoreSession();
  assert.equal(result.valid, false);
  assert.match(result.reason, /không hợp lệ/);
});
