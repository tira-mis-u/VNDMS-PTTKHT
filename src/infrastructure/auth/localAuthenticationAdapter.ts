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
import {
  isSupabaseConfigured,
  isExplicitDemoMode,
  supabase,
  toAuthUser,
  type SupabaseProfileRow,
} from "../supabase/supabaseClient";
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
      // Normalize: đảm bảo geographicScope không bao giờ null/undefined —
      // tránh crash khi data cũ trong localStorage thiếu trường này.
      const safeUser: AuthUser = {
        ...user,
        displayName: user.displayName || user.username || `Người dùng ${String(user.id).slice(0, 8)}`,
        username: user.username || String(user.id).slice(0, 8),
        geographicScope: user.geographicScope ?? { level: "national", name: "Toàn quốc", code: "VN" },
      };
      const demo = demoUsers.find(
        (d) => d.id === safeUser.id || d.username.toLowerCase() === safeUser.username?.toLowerCase(),
      );
      if (demo) {
        return {
          ...safeUser,
          username: demo.username,
          displayName: safeUser.displayName || demo.displayName,
          role: V2_ACCOUNT_ROLE_MAP[safeUser.id] ?? V2_ACCOUNT_ROLE_MAP[demo.id] ?? safeUser.role,
        };
      }
      return safeUser;
    });

    demoUsers.forEach((demo) => {
      const alreadyPresent = synced.some(
        (u) => u.id === demo.id || u.username?.toLowerCase() === demo.username.toLowerCase(),
      );
      if (!alreadyPresent) {
        synced.push(structuredClone(demo));
      }
    });

    // Khử trùng lặp theo username (nếu tồn tại cả tài khoản Cloud UUID và mock USR-*)
    const deduplicated: AuthUser[] = [];
    const seenUsernames = new Set<string>();

    // Sắp xếp ưu tiên: tài khoản Cloud UUID (hoặc ID dài) lên trước để giữ lại tài khoản Cloud
    const sorted = [...synced].sort((a, b) => {
      const aIsUuid = a.id && a.id.length > 20 ? 1 : 0;
      const bIsUuid = b.id && b.id.length > 20 ? 1 : 0;
      return bIsUuid - aIsUuid;
    });

    for (const u of sorted) {
      const uname = (u.username || "").toLowerCase();
      if (!uname || !seenUsernames.has(uname)) {
        if (uname) seenUsernames.add(uname);
        deduplicated.push(u);
      }
    }

    storage.setItem(USERS_KEY, JSON.stringify(deduplicated));
    return deduplicated;
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
  private useCloudAuth: boolean;
  private allowLocalDemo: boolean;
  constructor(
    storage: StorageLike,
    clock: () => Date = () => new Date(),
    tokenFactory: () => string = () => crypto.randomUUID(),
    useCloudAuth?: boolean,
  ) {
    this.storage = storage;
    this.clock = clock;
    this.tokenFactory = tokenFactory;
    this.useCloudAuth = useCloudAuth ?? (isSupabaseConfigured && !isExplicitDemoMode && typeof window !== "undefined");
    // Node/test adapters are intentionally local; a browser must opt in through
    // VITE_VNDMS_DEMO_MODE instead of silently falling back after Cloud failure.
    this.allowLocalDemo = isExplicitDemoMode || typeof window === "undefined";
  }
  async authenticate(username: string, password: string) {
    const trimmedUsername = username.trim();

    // 1. Khi Supabase được cấu hình, bắt buộc xác thực tập trung qua Supabase Auth
    if (this.useCloudAuth && supabase) {
      const email = trimmedUsername.includes("@")
        ? trimmedUsername.toLowerCase()
        : `${trimmedUsername.toLowerCase()}@vndms.gov.vn`;

      let authData: { session: any; user: any } | null = null;
      let authError: any = null;
      try {
        const res = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        authData = res.data;
        authError = res.error;
      } catch (networkErr: any) {
        authError = {
          message: networkErr?.message || "Lỗi kết nối tới Supabase Cloud",
          status: 500,
        };
      }

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error("Tên đăng nhập hoặc mật khẩu không chính xác.");
        }
        if (authError.message.includes("Email not confirmed")) {
          throw new Error("Tài khoản chưa được xác nhận email trên hệ thống.");
        }

        // Khi Supabase gặp sự cố hạ tầng (500, Database error querying schema, mạng rớt hoặc Supabase ngắt kết nối/khởi động lại):
        // Tự động kích hoạt cơ chế Failover sang xác thực cục bộ để không làm gián đoạn tác nghiệp cứu trợ khẩn cấp.
        console.warn(
          `[VNDMS Auth] Supabase Cloud gặp sự cố kết nối/schema (${authError.message}). Kích hoạt cơ chế xác thực dự phòng cục bộ...`
        );
        try {
          return await this.authenticateLocal(trimmedUsername, password);
        } catch (localErr: any) {
          if (localErr.message.includes("không chính xác") || localErr.message.includes("vô hiệu hóa")) {
            throw localErr;
          }
          throw new Error(`[Supabase Auth] Đăng nhập thất bại: ${authError.message}`);
        }
      }

      if (authData && authData.session && authData.user) {
        // Lấy profile tương ứng từ Supabase profiles table
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!profileRow) {
          await supabase.auth.signOut();
          throw new Error("Hồ sơ phân quyền trên Cloud không tồn tại hoặc không thể đọc. Đăng nhập đã bị hủy.");
        }
        const authUser = toAuthUser(profileRow as SupabaseProfileRow);
        if (!authUser.active) {
          await supabase.auth.signOut();
          throw new Error("Tài khoản đã bị vô hiệu hóa trên hệ thống.");
        }

        const issued = this.clock();
        const expiresAt = authData.session.expires_at
          ? new Date(authData.session.expires_at * 1000).toISOString()
          : new Date(issued.getTime() + 8 * 60 * 60 * 1000).toISOString();

        const session: Session = {
          id: `SES-${authData.session.access_token.slice(-12)}`,
          token: authData.session.access_token,
          userId: authUser.id,
          issuedAt: issued.toISOString(),
          expiresAt,
          lastValidatedAt: issued.toISOString(),
        };

        this.storage.setItem(SESSION_KEY, JSON.stringify(session));

        // Cập nhật người dùng vào bộ nhớ đệm
        const existingUsers = safeUsers(this.storage);
        const userIdx = existingUsers.findIndex(
          (u) => u.id === authUser.id || u.username.toLowerCase() === authUser.username.toLowerCase(),
        );
        if (userIdx >= 0) {
          existingUsers[userIdx] = authUser;
        } else {
          existingUsers.push(authUser);
        }
        this.storage.setItem(USERS_KEY, JSON.stringify(existingUsers));

        return { user: structuredClone(authUser), session };
      }

      throw new Error("Không thể khởi tạo phiên đăng nhập từ Supabase Auth.");
    }

    if (!this.allowLocalDemo && !this.useCloudAuth) {
      throw new Error("Supabase chưa được cấu hình. Bật VITE_VNDMS_DEMO_MODE=true mới dùng được đăng nhập cục bộ.");
    }
    return this.authenticateLocal(trimmedUsername, password);
  }

  private async authenticateLocal(trimmedUsername: string, password: string) {
    // Chế độ cục bộ / dự phòng cho demo, offline hoặc khi Cloud gián đoạn
    const users = safeUsers(this.storage);
    const user = users.find(
      (item) => item.username.toLowerCase() === trimmedUsername.toLowerCase(),
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
      id: `SES-LOCAL-${this.tokenFactory()}`,
      token: `LOCAL-${this.tokenFactory()}`,
      userId: user.id,
      issuedAt: issued.toISOString(),
      expiresAt: expires.toISOString(),
      lastValidatedAt: issued.toISOString(),
    };
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));

    return { user: structuredClone(user), session };
  }
  async register(input: import("../../domain/auth/types").RegisterInput): Promise<import("../../domain/auth/types").RegisterResult> {
    const trimmedUsername = input.username.trim();

    // 1. Khi Supabase được cấu hình, bắt buộc tạo tài khoản tập trung trên Supabase Auth
    if (this.useCloudAuth && supabase) {
      const email = trimmedUsername.includes("@")
        ? trimmedUsername.toLowerCase()
        : `${trimmedUsername.toLowerCase()}@vndms.gov.vn`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          data: {
            username: trimmedUsername,
            display_name: input.displayName.trim(),
            full_name: input.displayName.trim(),
            // BẢO MẬT: Luôn dùng 'citizen' khi tự đăng ký để ngăn chặn leo thang đặc quyền.
            // Role chỉ được cấp qua SQL migration hoặc quản trị viên.
            role: "citizen",
            scope_level: input.geographicScope?.level ?? "national",
            scope_name: input.geographicScope?.name ?? "Toàn quốc",
            scope_code: input.geographicScope?.code ?? "VN",
          },
        },
      });

      if (signUpError) {
        throw new Error(`[Supabase Auth] Đăng ký không thành công: ${signUpError.message}`);
      }

      const userId = signUpData.user?.id || `USR-REG-${Date.now().toString(36).toUpperCase()}`;
      const nowStr = this.clock().toISOString();
      // Luôn dùng role 'citizen' — server trigger handle_new_user() sẽ ghi profile với role này
      const newUser: AuthUser = {
        id: userId,
        displayName: input.displayName.trim(),
        username: trimmedUsername,
        role: "citizen",
        geographicScope: input.geographicScope ?? {
          level: "national",
          code: "VN",
          name: "Toàn quốc",
        },
        active: true,
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      let sessionToken = signUpData.session?.access_token;
      let expiresAt = signUpData.session?.expires_at
        ? new Date(signUpData.session.expires_at * 1000).toISOString()
        : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      if (!sessionToken) {
        // Thử đăng nhập tự động nếu Supabase trả session ngay (tài khoản @vndms.gov.vn đã seed)
        const signInRes = await supabase.auth.signInWithPassword({ email, password: input.password }).catch(() => null);
        if (signInRes?.data?.session) {
          sessionToken = signInRes.data.session.access_token;
          if (signInRes.data.session.expires_at) {
            expiresAt = new Date(signInRes.data.session.expires_at * 1000).toISOString();
          }
        }
      }

      // Đăng ký thành công nhưng email chưa được xác nhận — KHÔNG ném lỗi, trả trạng thái chờ
      if (!sessionToken) {
        return {
          user: structuredClone(newUser),
          session: null,
          pendingEmailConfirmation: true,
        };
      }

      const session: Session = {
        id: `SES-${sessionToken.slice(-12)}`,
        token: sessionToken,
        userId: newUser.id,
        issuedAt: nowStr,
        expiresAt,
        lastValidatedAt: nowStr,
      };

      this.storage.setItem(SESSION_KEY, JSON.stringify(session));
      const users = safeUsers(this.storage);
      if (!users.some((u) => u.id === newUser.id)) {
        users.push(newUser);
        this.saveUsers(users);
      }

      return { user: structuredClone(newUser), session, pendingEmailConfirmation: false };
    }

    if (!this.allowLocalDemo) {
      throw new Error("Supabase chưa được cấu hình. Bật VITE_VNDMS_DEMO_MODE=true mới dùng được đăng ký cục bộ.");
    }
    // 2. Chế độ cục bộ được bật rõ ràng cho demo/offline
    const users = safeUsers(this.storage);
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
    return { user: structuredClone(newUser), session, pendingEmailConfirmation: false };
  }
  async resetPassword(usernameOrPhone: string, newPassword: string) {
    if (this.useCloudAuth && supabase) {
      const identifier = usernameOrPhone.trim().toLowerCase();
      const email = identifier.includes("@") ? identifier : `${identifier}@vndms.gov.vn`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/login`,
      });
      if (error) throw new Error(`[Supabase Auth] Không thể gửi email đặt lại mật khẩu: ${error.message}`);
      // A password is changed only after the user opens the authenticated recovery
      // link.  Never alter the local credential cache in Cloud mode.
      return {
        user: {
          id: "CLOUD-RESET-PENDING",
          username: identifier,
          displayName: identifier,
          role: "citizen" as UserRole,
          geographicScope: { level: "national" as import("../../domain/auth/types").GeographicScopeLevel, code: "VN", name: "Toàn quốc" },
          active: false,
          createdAt: this.clock().toISOString(),
          updatedAt: this.clock().toISOString(),
        } satisfies import("../../domain/auth/types").AuthUser,
      };
    }
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
    if (this.useCloudAuth) {
      // This synchronous interface cannot validate a JWT with Auth.  Refuse to
      // restore cached local state; useOperationalSecurity performs the async,
      // server-verified restoration through auth.getUser().
      this.storage.removeItem(SESSION_KEY);
      return {
        valid: false,
        session: null,
        user: null,
        reason: "Đang chờ Supabase Auth xác minh phiên Cloud.",
        expired: false,
      };
    }
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
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
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
