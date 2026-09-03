import { useEffect, useState } from "react";
import type { UserRole } from "@/domain/shared/auth";
import type {
  GeographicScope,
  Role,
  SecurityAuditEvent,
} from "@/domain/auth/types";
import type { Permission } from "@/lib/permissions/permissions";
import {
  authorize,
  authorizeResources,
  type AuthorizationResource,
} from "@/lib/security/authorization";
import { browserAuthenticationAdapter } from "@/infrastructure/auth/localAuthenticationAdapter";
import { browserAuditAdapter } from "@/infrastructure/auth/localAuditAdapter";
import {
  changeUserRole,
  changeUserScope,
  createSecurityAudit,
  loginUser,
  logoutUser,
  registerUser,
  resetUserPassword,
  setUserActive,
} from "@/application/auth/authUseCases";

/** Authentication/session/audit mechanics used by the sole OperationalProvider. */
export function useOperationalSecurity() {
  const [authGateway] = useState(() => browserAuthenticationAdapter());
  const [auditGateway] = useState(() => browserAuditAdapter());
  const [restoredSession] = useState(() => authGateway.restoreSession());
  const [session, setSession] = useState(restoredSession.session);
  const [currentUser, setCurrentUser] = useState(restoredSession.user);
  const [users, setUsers] = useState(() => authGateway.listUsers());
  const [securityAuditEvents, setSecurityAuditEvents] = useState<
    SecurityAuditEvent[]
  >(() => {
    const existing = auditGateway.load();
    let event: SecurityAuditEvent | null = null;
    if (restoredSession.expired)
      event = createSecurityAudit({
        actorId: null,
        actorName: "Phiên cũ",
        role: null,
        action: "SESSION_EXPIRED",
        resourceType: "Session",
        resourceId: null,
        timestamp: new Date().toISOString(),
        geographicScope: "Không xác định",
        result: "DENIED",
        reason: restoredSession.reason,
      });
    else if (
      restoredSession.valid &&
      restoredSession.user &&
      restoredSession.session
    )
      event = createSecurityAudit({
        actorId: restoredSession.user.id,
        actorName: restoredSession.user.displayName,
        role: restoredSession.user.role,
        action: "SESSION_RESTORED",
        resourceType: "Session",
        resourceId: restoredSession.session.id,
        timestamp: new Date().toISOString(),
        geographicScope: restoredSession.user.geographicScope.name,
        result: "SUCCESS",
        reason: "Khôi phục phiên lưu trên thiết bị sau khi tải lại trang.",
      });
    if (event) {
      auditGateway.replace([event, ...existing]);
      return [event, ...existing];
    }
    return existing;
  });
  const role: UserRole = currentUser?.role ?? "citizen";
  const actorName = currentUser?.displayName ?? "Người dùng chưa xác thực";
  const currentScopeName =
    currentUser?.geographicScope.name ?? "Không xác định";
  const appendSecurityAudit = (event: SecurityAuditEvent) => {
    setSecurityAuditEvents((current) => [event, ...current].slice(0, 500));
    auditGateway.append(event);
  };
  const can = (
    permission: Permission,
    resourceScope?: string,
    ownerId?: string,
  ) => authorize(currentUser, permission, resourceScope, ownerId).allowed;
  const enforcePermission = (
    permission: Permission,
    resources: readonly AuthorizationResource[],
    sensitiveOperation?: string,
  ) => {
    const decision = authorizeResources(currentUser, {
      permission,
      resources,
      sensitiveOperation,
    });
    appendSecurityAudit(
      createSecurityAudit({
        actorId: currentUser?.id ?? null,
        actorName,
        role: currentUser?.role ?? null,
        action: decision.allowed ? "MUTATION_AUTHORIZED" : "PERMISSION_DENIED",
        resourceType: decision.resourceType,
        resourceId: decision.resourceId,
        timestamp: new Date().toISOString(),
        geographicScope: currentScopeName,
        result: decision.allowed ? "SUCCESS" : "DENIED",
        reason: decision.reason,
        permission,
      }),
    );
    if (!decision.allowed) throw new Error(decision.reason);
    return decision;
  };
  const login = async (username: string, password: string) => {
    const outcome = await loginUser(authGateway, username, password);
    appendSecurityAudit(outcome.audit);
    if (outcome.ok) {
      setSession(outcome.session);
      setCurrentUser(outcome.user);
      setUsers(authGateway.listUsers());
    }
    return {
      ok: outcome.ok,
      error: outcome.error,
      user: outcome.ok && outcome.user ? outcome.user : undefined,
    };
  };
  const register = async (input: import("@/domain/auth/types").RegisterInput) => {
    const outcome = await registerUser(authGateway, input);
    appendSecurityAudit(outcome.audit);
    if (outcome.ok) {
      setSession(outcome.session);
      setCurrentUser(outcome.user);
      setUsers(authGateway.listUsers());
    }
    return {
      ok: outcome.ok,
      error: outcome.error,
      user: outcome.ok && outcome.user ? outcome.user : undefined,
    };
  };
  const resetPassword = async (usernameOrPhone: string, newPassword: string) => {
    const outcome = await resetUserPassword(authGateway, usernameOrPhone, newPassword);
    appendSecurityAudit(outcome.audit);
    if (outcome.ok) {
      setUsers(authGateway.listUsers());
    }
    return {
      ok: outcome.ok,
      error: outcome.error,
      user: outcome.user,
    };
  };
  const logout = () => {
    if (currentUser && session)
      appendSecurityAudit(logoutUser(authGateway, currentUser, session));
    else authGateway.logout();
    setSession(null);
    setCurrentUser(null);
  };
  const auditUserAdmin = (
    action:
      | "USER_ACTIVATED"
      | "USER_DEACTIVATED"
      | "USER_ROLE_CHANGED"
      | "USER_SCOPE_CHANGED",
    userId: string,
    reason: string,
  ) =>
    appendSecurityAudit(
      createSecurityAudit({
        actorId: currentUser?.id ?? null,
        actorName,
        role: currentUser?.role ?? null,
        action,
        resourceType: "User",
        resourceId: userId,
        timestamp: new Date().toISOString(),
        geographicScope: currentScopeName,
        result: "SUCCESS",
        reason,
        permission: "user_manage",
      }),
    );
  const updateUserActive = (userId: string, active: boolean) => {
    enforcePermission("user_manage", [{ type: "User", id: userId }]);
    if (!currentUser) return;
    const next = setUserActive(
      users,
      userId,
      active,
      currentUser,
      new Date().toISOString(),
    );
    setUsers(next);
    authGateway.saveUsers(next);
    auditUserAdmin(
      active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      userId,
      active ? "Kích hoạt tài khoản." : "Vô hiệu hóa tài khoản.",
    );
    if (session?.userId === userId)
      setCurrentUser(next.find((item) => item.id === userId) ?? null);
  };
  const updateUserRole = (userId: string, nextRole: Role) => {
    enforcePermission("user_manage", [{ type: "User", id: userId }]);
    const next = changeUserRole(
      users,
      userId,
      nextRole,
      new Date().toISOString(),
    );
    setUsers(next);
    authGateway.saveUsers(next);
    auditUserAdmin(
      "USER_ROLE_CHANGED",
      userId,
      `Đổi vai trò thành ${nextRole}.`,
    );
    if (session?.userId === userId)
      setCurrentUser(next.find((item) => item.id === userId) ?? null);
  };
  const updateUserScope = (userId: string, scope: GeographicScope) => {
    enforcePermission("user_manage", [{ type: "User", id: userId }]);
    const next = changeUserScope(
      users,
      userId,
      scope,
      new Date().toISOString(),
    );
    setUsers(next);
    authGateway.saveUsers(next);
    auditUserAdmin(
      "USER_SCOPE_CHANGED",
      userId,
      `Đổi phạm vi thành ${scope.name}.`,
    );
    if (session?.userId === userId)
      setCurrentUser(next.find((item) => item.id === userId) ?? null);
  };
  const updateSelfProfile = (input: {
    displayName?: string;
    geographicScope?: GeographicScope;
    organization?: string;
  }) => {
    if (!currentUser) return;
    const nowStr = new Date().toISOString();
    const next = users.map((u) =>
      u.id === currentUser.id
        ? {
            ...u,
            displayName: input.displayName?.trim() || u.displayName,
            geographicScope: input.geographicScope || u.geographicScope,
            organization: input.organization ?? u.organization,
            updatedAt: nowStr,
          }
        : u,
    );
    setUsers(next);
    authGateway.saveUsers(next);
    const updated = next.find((u) => u.id === currentUser.id) ?? null;
    setCurrentUser(updated);
    appendSecurityAudit(
      createSecurityAudit({
        actorId: currentUser.id,
        actorName: input.displayName || currentUser.displayName,
        role: currentUser.role,
        action: "MUTATION_AUTHORIZED",
        resourceType: "User",
        resourceId: currentUser.id,
        timestamp: nowStr,
        geographicScope: input.geographicScope?.name || currentScopeName,
        result: "SUCCESS",
        reason: `Người dùng ${currentUser.displayName} (@${currentUser.username}) đã tự cập nhật thông tin cá nhân/liên hệ/địa bàn.`,
      }),
    );
  };
  const recordSecurityAudit = (
    action: import("@/domain/auth/types").AuditAction,
    reason: string,
    resourceType = "Security",
    resourceId: string | null = null,
  ) => {
    if (!currentUser) return;
    appendSecurityAudit(
      createSecurityAudit({
        actorId: currentUser.id,
        actorName: currentUser.displayName,
        role: currentUser.role,
        action,
        resourceType,
        resourceId,
        timestamp: new Date().toISOString(),
        geographicScope: currentScopeName,
        result: "SUCCESS",
        reason,
      }),
    );
  };
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      const validation = authGateway.restoreSession();
      if (!validation.valid) {
        if (validation.expired) {
          const event = createSecurityAudit({
            actorId: currentUser?.id ?? null,
            actorName,
            role: currentUser?.role ?? null,
            action: "SESSION_EXPIRED",
            resourceType: "Session",
            resourceId: session.id,
            timestamp: new Date().toISOString(),
            geographicScope: currentScopeName,
            result: "DENIED",
            reason: validation.reason,
          });
          auditGateway.append(event);
          setSecurityAuditEvents((current) =>
            [event, ...current].slice(0, 500),
          );
        }
        setSession(null);
        setCurrentUser(null);
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [
    session,
    currentUser,
    actorName,
    currentScopeName,
    authGateway,
    auditGateway,
  ]);
  return {
    session,
    currentUser,
    users,
    securityAuditEvents,
    role,
    actorName,
    currentScopeName,
    can,
    enforcePermission,
    login,
    register,
    resetPassword,
    logout,
    updateUserActive,
    updateUserRole,
    updateUserScope,
    updateSelfProfile,
    recordSecurityAudit,
  };
}
