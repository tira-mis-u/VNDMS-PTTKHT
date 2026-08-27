import type {
  AuthUser,
  Session,
  SessionValidation,
} from "../../domain/auth/types";
import type { AuthenticationGateway } from "../../application/auth/authContracts";
import { demoCredentials, demoUsers } from "./demoUsers";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const SESSION_KEY = "vndms.auth.session.v5";
const USERS_KEY = "vndms.auth.users.v5";
const CREDENTIALS_KEY = "vndms.auth.credentials.v5";
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}
function safeUsers(storage: StorageLike): AuthUser[] {
  try {
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
    // Synchronize canonical usernames from demoUsers definition
    const synced = parsed.map((user: AuthUser) => {
      const demo = demoUsers.find((d) => d.id === user.id);
      if (demo) {
        return {
          ...user,
          username: demo.username,
          displayName: demo.displayName,
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
        level: "district",
        code: "HN-TAYHO",
        name: "Tây Hồ, Hà Nội",
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
  saveUsers(users: AuthUser[]) {
    this.storage.setItem(USERS_KEY, JSON.stringify(users));
  }
}
export const browserAuthenticationAdapter = () =>
  new LocalAuthenticationAdapter(window.localStorage);
