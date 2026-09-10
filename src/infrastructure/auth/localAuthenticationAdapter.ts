import type {
  AuthUser,
  Session,
  SessionValidation,
} from "../../domain/auth/types";
import type { AuthenticationGateway } from "../../application/auth/authContracts";
import {
  isUserRole,
  LEGACY_ROLE_MAP,
  type UserRole,
} from "../../domain/shared/auth";
import { demoCredentials, demoUsers } from "./demoUsers";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const SESSION_KEY = "vndms.auth.session.v5";
const USERS_KEY = "vndms.auth.users.v5";
const CREDENTIALS_KEY = "vndms.auth.credentials.v5";
/**
 * Migration mô hình vai trò V2 (4 vai). Idempotent: chỉ chạy khi
 * `vndms.auth.roleModel.version` < ROLE_MODEL_VERSION; bản sao dữ liệu trước
 * migration được giữ ở `vndms.auth.users.v5.backup.r1` để rollback thủ công.
 */
export const ROLE_MODEL_VERSION = 2;
export const ROLE_MODEL_VERSION_KEY = "vndms.auth.roleModel.version";
export const USERS_BACKUP_KEY = `vndms.auth.users.v5.backup.r${ROLE_MODEL_VERSION - 1}`;
export const MIGRATION_LOG_KEY = "vndms.auth.roleModel.migrationLog";

/** Mapping BẮT BUỘC theo ID tài khoản (không dựa vào vai cũ). */
export const V2_ACCOUNT_ROLE_MAP: Readonly<Record<string, UserRole>> = {
  "USR-CMD-001": "admin",
  "USR-OPS-001": "disaster_officer",
  "USR-RSL-001": "rescue_unit",
  "USR-LOC-001": "citizen",
  "USR-RSM-001": "citizen",
  "USR-WHS-001": "citizen",
  "USR-CTZ-001": "citizen",
};

export interface RoleModelMigrationEntry {
  userId: string;
  username: string;
  fromRole: string;
  toRole: UserRole;
  droppedTeamId: string | null;
  droppedWarehouseId: string | null;
  /** "mapped" = theo bảng ID; "legacy" = theo vai cũ; "exception" = giữ nguyên, cần rà soát. */
  strategy: "mapped" | "legacy" | "unchanged" | "exception";
}
export interface RoleModelMigrationResult {
  version: number;
  migratedAt: string;
  entries: RoleModelMigrationEntry[];
  exceptions: RoleModelMigrationEntry[];
}

type StoredUser = Omit<AuthUser, "role"> & { role: string };

/**
 * Chuyển một bản ghi tài khoản sang mô hình V2. Không đổi id/username/
 * displayName/mật khẩu; teamId/warehouseId cũ bị gỡ vì không còn là căn cứ
 * cấp quyền. Tài khoản ngoài bảng với vai lạ được giữ nguyên và báo ngoại lệ.
 */
export function migrateUserToRoleModelV2(user: StoredUser): {
  user: AuthUser;
  entry: RoleModelMigrationEntry;
} {
  const mapped = V2_ACCOUNT_ROLE_MAP[user.id];
  const legacy = LEGACY_ROLE_MAP[user.role];
  const toRole: UserRole | null = mapped ?? (isUserRole(user.role) ? user.role : legacy ?? null);
  const strategy: RoleModelMigrationEntry["strategy"] = mapped
    ? "mapped"
    : isUserRole(user.role)
      ? "unchanged"
      : legacy
        ? "legacy"
        : "exception";
  const { teamId, warehouseId, ...rest } = user;
  const next: AuthUser = {
    ...rest,
    role: toRole ?? "citizen",
  };
  if (strategy === "exception") {
    // Không suy đoán: giữ nguyên bản ghi (kể cả role lạ) để quản trị rà soát.
    return {
      user: { ...user, role: user.role as UserRole },
      entry: {
        userId: user.id,
        username: user.username,
        fromRole: user.role,
        toRole: user.role as UserRole,
        droppedTeamId: null,
        droppedWarehouseId: null,
        strategy,
      },
    };
  }
  return {
    user: next,
    entry: {
      userId: user.id,
      username: user.username,
      fromRole: user.role,
      toRole: next.role,
      droppedTeamId: teamId ?? null,
      droppedWarehouseId: warehouseId ?? null,
      strategy,
    },
  };
}

function readRoleModelVersion(storage: StorageLike) {
  const raw = storage.getItem(ROLE_MODEL_VERSION_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

/**
 * Chạy migration nếu cần. Trả về kết quả khi có thay đổi, null khi đã ở
 * phiên bản hiện hành. Sao lưu trước, ghi version sau — nếu lỗi giữa chừng,
 * lần tải sau sẽ chạy lại từ bản gốc.
 */
export function runRoleModelMigration(
  storage: StorageLike,
  clock: () => Date = () => new Date(),
): RoleModelMigrationResult | null {
  if (readRoleModelVersion(storage) >= ROLE_MODEL_VERSION) return null;
  const raw = storage.getItem(USERS_KEY);
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const entries: RoleModelMigrationEntry[] = [];
  if (Array.isArray(parsed) && raw) {
    if (!storage.getItem(USERS_BACKUP_KEY)) storage.setItem(USERS_BACKUP_KEY, raw);
    const migrated = (parsed as StoredUser[]).map((user) => {
      const outcome = migrateUserToRoleModelV2(user);
      entries.push(outcome.entry);
      return outcome.user;
    });
    storage.setItem(USERS_KEY, JSON.stringify(migrated));
  }
  const result: RoleModelMigrationResult = {
    version: ROLE_MODEL_VERSION,
    migratedAt: clock().toISOString(),
    entries,
    exceptions: entries.filter((entry) => entry.strategy === "exception"),
  };
  storage.setItem(MIGRATION_LOG_KEY, JSON.stringify(result));
  storage.setItem(ROLE_MODEL_VERSION_KEY, String(ROLE_MODEL_VERSION));
  return result;
}

/** Khôi phục danh sách tài khoản trước migration (rollback thủ công). */
export function rollbackRoleModelMigration(storage: StorageLike) {
  const backup = storage.getItem(USERS_BACKUP_KEY);
  if (!backup) return false;
  storage.setItem(USERS_KEY, backup);
  storage.removeItem(ROLE_MODEL_VERSION_KEY);
  storage.removeItem(MIGRATION_LOG_KEY);
  storage.removeItem(SESSION_KEY);
  return true;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}
function safeUsers(storage: StorageLike): AuthUser[] {
  try {
    runRoleModelMigration(storage);
    const raw = storage.getItem(USERS_KEY);
    if (!raw) {
      storage.setItem(USERS_KEY, JSON.stringify(demoUsers));
      return structuredClone(demoUsers);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      storage.setItem(USERS_KEY, JSON.stringify(demoUsers));
      return structuredClone(demoUsers);
    }
    // Đồng bộ username/displayName canonical cho 7 tài khoản demo; KHÔNG
    // ghi đè vai trò/mật khẩu của tài khoản khác (danh sách ngoại lệ do
    // migration ghi lại).
    const synced = parsed.map((user: AuthUser) => {
      const demo = demoUsers.find((d) => d.id === user.id);
      if (demo) {
        return {
          ...user,
          username: demo.username,
          displayName: demo.displayName,
          role: V2_ACCOUNT_ROLE_MAP[user.id] ?? user.role,
        };
      }
      return user;
    });
    demoUsers.forEach((demo) => {
      if (!synced.some((u) => u.id === demo.id)) {
        synced.push(structuredClone(demo));
      }
    });
    storage.setItem(USERS_KEY, JSON.stringify(synced));
    return synced;
  } catch {
    return structuredClone(demoUsers);
  }
}
function safeCredentials(storage: StorageLike) {
  try {
    const raw = storage.getItem(CREDENTIALS_KEY);
    if (!raw) return structuredClone(demoCredentials);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : structuredClone(demoCredentials);
  } catch {
    return structuredClone(demoCredentials);
  }
}
export class LocalAuthenticationAdapter implements AuthenticationGateway {
  private storage: StorageLike;
  private clock: () => Date;
  private tokenFactory: () => string;
  constructor(
    storage: StorageLike,
    clock: () => Date = () => new Date(),
    tokenFactory: () => string = () => crypto.randomUUID(),
  ) {
    this.storage = storage;
    this.clock = clock;
    this.tokenFactory = tokenFactory;
  }
  async authenticate(username: string, password: string) {
    const users = safeUsers(this.storage);
    const user = users.find(
      (item) => item.username.toLowerCase() === username.trim().toLowerCase(),
    );
    const hash = await sha256(password);
    const credentials = safeCredentials(this.storage);
    const credential = user
      ? credentials.find((item: { userId: string; passwordHash: string }) => item.userId === user.id)
      : null;
    if (!user || !credential || credential.passwordHash !== hash)
      throw new Error("Tên đăng nhập hoặc mật khẩu không chính xác.");
    if (!user.active)
      throw new Error(
        "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      );
    const issued = this.clock();
    const expires = new Date(issued.getTime() + 8 * 60 * 60 * 1000);
    const session: Session = {
      id: `SES-${this.tokenFactory()}`,
      token: this.tokenFactory(),
      userId: user.id,
      issuedAt: issued.toISOString(),
      expiresAt: expires.toISOString(),
      lastValidatedAt: issued.toISOString(),
    };
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    return { user: structuredClone(user), session };
  }
  async register(input: import("../../domain/auth/types").RegisterInput) {
    const users = safeUsers(this.storage);
    const trimmedUsername = input.username.trim();
    if (
      users.some(
        (u) => u.username.toLowerCase() === trimmedUsername.toLowerCase(),
      )
    ) {
      throw new Error("Tên đăng nhập này đã được sử dụng.");
    }
    const id = `USR-REG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const nowStr = this.clock().toISOString();
    const newUser: AuthUser = {
      id,
      displayName: input.displayName.trim(),
      username: trimmedUsername,
      role: input.role,
      geographicScope: input.geographicScope ?? {
        level: "national",
        code: "VN",
        name: "Toàn quốc",
      },
      active: true,
      createdAt: nowStr,
      updatedAt: nowStr,
    };
    const passwordHash = await sha256(input.password);
    const nextUsers = [...users, newUser];
    this.saveUsers(nextUsers);
    const credentials = safeCredentials(this.storage);
    credentials.push({ userId: id, passwordHash });
    this.storage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));

    const issued = this.clock();
    const expires = new Date(issued.getTime() + 8 * 60 * 60 * 1000);
    const session: Session = {
      id: `SES-${this.tokenFactory()}`,
      token: this.tokenFactory(),
      userId: newUser.id,
      issuedAt: issued.toISOString(),
      expiresAt: expires.toISOString(),
      lastValidatedAt: issued.toISOString(),
    };
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    return { user: structuredClone(newUser), session };
  }
  async resetPassword(usernameOrPhone: string, newPassword: string) {
    const users = safeUsers(this.storage);
    const target = usernameOrPhone.trim().toLowerCase();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === target ||
        (u.phone && u.phone.trim() === target),
    );
    if (!user) {
      throw new Error("Không tìm thấy tài khoản với tên đăng nhập hoặc số điện thoại này.");
    }
    const passwordHash = await sha256(newPassword);
    const credentials = safeCredentials(this.storage);
    const index = credentials.findIndex((c: { userId: string }) => c.userId === user.id);
    if (index >= 0) {
      credentials[index].passwordHash = passwordHash;
    } else {
      credentials.push({ userId: user.id, passwordHash });
    }
    this.storage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    user.updatedAt = this.clock().toISOString();
    this.saveUsers(users);
    return { user: structuredClone(user) };
  }
  restoreSession(): SessionValidation {
    const raw = this.storage.getItem(SESSION_KEY);
    if (!raw)
      return {
        valid: false,
        session: null,
        user: null,
        reason: "Chưa có phiên đăng nhập.",
        expired: false,
      };
    try {
      const session = JSON.parse(raw) as Session;
      if (
        !session?.id ||
        !session.token ||
        !session.userId ||
        !session.expiresAt
      )
        throw new Error("malformed");
      const user = safeUsers(this.storage).find(
        (item) => item.id === session.userId,
      );
      if (!user) {
        this.storage.removeItem(SESSION_KEY);
        return {
          valid: false,
          session: null,
          user: null,
          reason: "Người dùng của phiên không còn tồn tại.",
          expired: false,
        };
      }
      if (!user.active) {
        this.storage.removeItem(SESSION_KEY);
        return {
          valid: false,
          session: null,
          user: null,
          reason: "Tài khoản đã bị vô hiệu hóa.",
          expired: false,
        };
      }
      if (new Date(session.expiresAt).getTime() <= this.clock().getTime()) {
        this.storage.removeItem(SESSION_KEY);
        return {
          valid: false,
          session: null,
          user: null,
          reason: "Phiên đăng nhập đã hết hạn.",
          expired: true,
        };
      }
      const validated = {
        ...session,
        lastValidatedAt: this.clock().toISOString(),
      };
      this.storage.setItem(SESSION_KEY, JSON.stringify(validated));
      return {
        valid: true,
        session: validated,
        user: structuredClone(user),
        reason: "Khôi phục phiên thành công.",
        expired: false,
      };
    } catch {
      this.storage.removeItem(SESSION_KEY);
      return {
        valid: false,
        session: null,
        user: null,
        reason: "Dữ liệu phiên không hợp lệ.",
        expired: false,
      };
    }
  }
  logout() {
    this.storage.removeItem(SESSION_KEY);
  }
  listUsers() {
    return safeUsers(this.storage);
  }
  /** Kết quả migration V2 gần nhất (null nếu chưa chạy hoặc không có gì đổi). */
  lastRoleModelMigration(): RoleModelMigrationResult | null {
    try {
      const raw = this.storage.getItem(MIGRATION_LOG_KEY);
      return raw ? (JSON.parse(raw) as RoleModelMigrationResult) : null;
    } catch {
      return null;
    }
  }
  saveUsers(users: AuthUser[]) {
    this.storage.setItem(USERS_KEY, JSON.stringify(users));
  }
}
export const browserAuthenticationAdapter = () =>
  new LocalAuthenticationAdapter(window.localStorage);
