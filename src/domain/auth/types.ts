import type { UserRole } from "../shared/auth";
import type { Permission } from "../../lib/permissions/permissions";
export type Role = UserRole;
export type GeographicScopeLevel =
  "national" | "province" | "district" | "commune" | "warehouse";
export interface GeographicScope {
  level: GeographicScopeLevel;
  name: string;
  code: string;
}
export interface AuthUser {
  id: string;
  displayName: string;
  username: string;
  role: Role;
  geographicScope: GeographicScope;
  active: boolean;
  /**
   * Quan hệ đội/kho cũ (trước V2) chỉ còn là dữ liệu lịch sử; KHÔNG được
   * dùng để cấp hoặc thu hẹp quyền. Xem `lib/security/authorization.ts`.
   */
  teamId?: string;
  warehouseId?: string;
  organization?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}
export interface AuthCredential {
  userId: string;
  passwordHash: string;
}
export interface Session {
  id: string;
  token: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  lastValidatedAt: string;
}
export interface AuthenticationResult {
  user: AuthUser;
  session: Session;
}
export interface RegisterResult {
  user: AuthUser;
  session: Session | null;
  pendingEmailConfirmation: boolean;
}
export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
  permission: Permission;
  scope: GeographicScope;
  resourceScope?: string;
}
export type AuditResult = "SUCCESS" | "DENIED" | "FAILED";
export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_RESTORED"
  | "SESSION_EXPIRED"
  | "PERMISSION_DENIED"
  | "MUTATION_AUTHORIZED"
  /**
   * Mọi thao tác nghiệp vụ đã được cấp quyền trên bản ghi điều hành/ứng phó
   * (sự cố, nhiệm vụ, đội, điểm sơ tán, SOS, phản ánh, cảnh báo công bố…).
   * Tách khỏi MUTATION_AUTHORIZED (chỉ còn dùng cho thay đổi TÀI KHOẢN) để
   * nhật ký lọc/đọc được theo nhóm chức năng thay vì hòa vào mục tài khoản.
   */
  | "OPERATIONAL_MUTATION"
  /** Tương tác hàng đợi cảnh báo: đánh dấu đã đọc/đọc lại/đọc tất cả. */
  | "ALERT_INTERACTION"
  | "USER_REGISTERED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_ROLE_CHANGED"
  | "USER_SCOPE_CHANGED"
  | "ROLE_MODEL_MIGRATED"
  | "PANIC_ALERT_TRIGGERED"
  | "LIVE_BEACON_TOGGLED";
export interface RegisterInput {
  displayName: string;
  username: string;
  password: string;
  role: Role;
  geographicScope?: GeographicScope;
  organization?: string;
}
export interface SecurityAuditEvent {
  id: string;
  actorId: string | null;
  actorName: string;
  role: Role | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  timestamp: string;
  geographicScope: string;
  result: AuditResult;
  reason: string;
  permission?: Permission;
}
export interface SessionValidation {
  valid: boolean;
  session: null | Session;
  user: null | AuthUser;
  reason: string;
  expired: boolean;
}
