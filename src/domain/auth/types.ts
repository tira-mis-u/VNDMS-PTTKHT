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
  | "USER_REGISTERED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_ROLE_CHANGED"
  | "USER_SCOPE_CHANGED"
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
