import type { AuthenticationGateway } from "./authContracts";
import type {
  AuthUser,
  GeographicScope,
  Role,
  SecurityAuditEvent,
  Session,
  SessionValidation,
} from "../../domain/auth/types";
export interface LoginOutcome {
  ok: boolean;
  user: AuthUser | null;
  session: Session | null;
  error: string;
  audit: SecurityAuditEvent;
}
const auditId = (action: string, timestamp: string, actor: string | null) =>
  `AUD-${action}-${timestamp.replace(/\D/g, "")}-${actor ?? "ANON"}-${crypto.randomUUID()}`;
export function createSecurityAudit(
  input: Omit<SecurityAuditEvent, "id">,
): SecurityAuditEvent {
  return {
    id: auditId(input.action, input.timestamp, input.actorId),
    ...input,
  };
}
export async function loginUser(
  gateway: AuthenticationGateway,
  username: string,
  password: string,
  now = () => new Date(),
): Promise<LoginOutcome> {
  const timestamp = now().toISOString();
  try {
    const result = await gateway.authenticate(username, password);
    return {
      ok: true,
      ...result,
      error: "",
      audit: createSecurityAudit({
        actorId: result.user.id,
        actorName: result.user.displayName,
        role: result.user.role,
        action: "LOGIN_SUCCESS",
        resourceType: "Session",
        resourceId: result.session.id,
        timestamp,
        geographicScope: result.user.geographicScope.name,
        result: "SUCCESS",
        reason: "Xác thực bằng bộ kết nối thử nghiệm thành công.",
      }),
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Đăng nhập thất bại.";
    return {
      ok: false,
      user: null,
      session: null,
      error: reason,
      audit: createSecurityAudit({
        actorId: null,
        actorName: username || "Không xác định",
        role: null,
        action: "LOGIN_FAILED",
        resourceType: "Session",
        resourceId: null,
        timestamp,
        geographicScope: "Không xác định",
        result: "FAILED",
        reason,
      }),
    };
  }
}
export async function registerUser(
  gateway: AuthenticationGateway,
  input: import("../../domain/auth/types").RegisterInput,
  now = () => new Date(),
): Promise<LoginOutcome> {
  const timestamp = now().toISOString();
  try {
    const result = await gateway.register(input);
    return {
      ok: true,
      ...result,
      error: "",
      audit: createSecurityAudit({
        actorId: result.user.id,
        actorName: result.user.displayName,
        role: result.user.role,
        action: "USER_REGISTERED",
        resourceType: "User",
        resourceId: result.user.id,
        timestamp,
        geographicScope: result.user.geographicScope.name,
        result: "SUCCESS",
        reason: "Đăng ký tài khoản tác nghiệp mới thành công.",
      }),
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Đăng ký thất bại.";
    return {
      ok: false,
      user: null,
      session: null,
      error: reason,
      audit: createSecurityAudit({
        actorId: null,
        actorName: input.displayName || input.username || "Không xác định",
        role: null,
        action: "LOGIN_FAILED",
        resourceType: "User",
        resourceId: null,
        timestamp,
        geographicScope: input.geographicScope?.name ?? "Không xác định",
        result: "FAILED",
        reason,
      }),
    };
  }
}
export function restoreUserSession(
  gateway: AuthenticationGateway,
): SessionValidation {
  return gateway.restoreSession();
}
export function logoutUser(
  gateway: AuthenticationGateway,
  user: AuthUser,
  session: Session,
  now = () => new Date(),
) {
  gateway.logout(session.id);
  return createSecurityAudit({
    actorId: user.id,
    actorName: user.displayName,
    role: user.role,
    action: "LOGOUT",
    resourceType: "Session",
    resourceId: session.id,
    timestamp: now().toISOString(),
    geographicScope: user.geographicScope.name,
    result: "SUCCESS",
    reason: "Phiên đăng nhập đã được hủy trên bộ xác thực cục bộ.",
  });
}
export function setUserActive(
  users: AuthUser[],
  userId: string,
  active: boolean,
  actor: AuthUser,
  timestamp: string,
) {
  if (userId === actor.id && !active)
    throw new Error("Không thể tự vô hiệu hóa tài khoản đang đăng nhập.");
  if (!users.some((item) => item.id === userId))
    throw new Error("Không tìm thấy người dùng.");
  return users.map((item) =>
    item.id === userId ? { ...item, active, updatedAt: timestamp } : item,
  );
}
export function changeUserRole(
  users: AuthUser[],
  userId: string,
  role: Role,
  timestamp: string,
) {
  if (!users.some((item) => item.id === userId))
    throw new Error("Không tìm thấy người dùng.");
  return users.map((item) =>
    item.id === userId ? { ...item, role, updatedAt: timestamp } : item,
  );
}
export function changeUserScope(
  users: AuthUser[],
  userId: string,
  geographicScope: GeographicScope,
  timestamp: string,
) {
  if (!geographicScope.name.trim() || !geographicScope.code.trim())
    throw new Error("Phạm vi địa lý không hợp lệ.");
  if (!users.some((item) => item.id === userId))
    throw new Error("Không tìm thấy người dùng.");
  return users.map((item) =>
    item.id === userId
      ? { ...item, geographicScope, updatedAt: timestamp }
      : item,
  );
}
