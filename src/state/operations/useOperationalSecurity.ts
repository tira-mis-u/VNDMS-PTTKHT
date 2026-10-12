import { useEffect, useState } from "react";
import type { UserRole } from "@/domain/shared/auth";
import type {
  GeographicScope,
  Role,
  SecurityAuditEvent,
  Session,
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
import {
  auditActionForMutation,
  operationalAuditReason,
} from "@/application/auth/auditPresentation";
import { permissionLabel } from "@/lib/permissions/labels";
import { roleLabels } from "@/domain/auth/labels";
import {
  isSupabaseConfigured,
  supabase,
  toAuthUser,
  type SupabaseProfileRow,
} from "@/infrastructure/supabase/supabaseClient";

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
    // Migration mô hình vai trò V2 (chạy trong listUsers/restoreSession) được ghi
    // vào nhật ký bảo mật đúng một lần cho mỗi lần chạy thật.
    const migration = authGateway.lastRoleModelMigration();
    const migrationResourceId = migration
      ? `roleModel:v${migration.version}:${migration.migratedAt}`
      : null;
    const migrationEvent =
      migration &&
      migration.entries.length > 0 &&
      !existing.some(
        (item) =>
          item.action === "ROLE_MODEL_MIGRATED" &&
          item.resourceId === migrationResourceId,
      )
        ? createSecurityAudit({
            actorId: null,
            actorName: "Hệ thống",
            role: null,
            action: "ROLE_MODEL_MIGRATED",
            resourceType: "RoleModel",
            resourceId: migrationResourceId,
            timestamp: migration.migratedAt,
            geographicScope: "Toàn quốc",
            result: "SUCCESS",
            reason: `Chuyển ${migration.entries.length} tài khoản sang mô hình 4 vai; ${migration.exceptions.length} ngoại lệ giữ nguyên chờ rà soát.`,
          })
        : null;
    const prepended = [event, migrationEvent].filter(
      (item): item is SecurityAuditEvent => Boolean(item),
    );
    if (prepended.length) {
      auditGateway.replace([...prepended, ...existing]);
      return [...prepended, ...existing];
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
    options?: { logGranted?: boolean },
  ) => {
    const decision = authorizeResources(currentUser, {
      permission,
      resources,
      sensitiveOperation,
    });
    // Mặc định mọi thao tác ghi để lại một dòng nhật ký quyền (dù denial vẫn
    // PERMISSION_DENIED). Nhóm quản trị User tự ghi dòng nghiệp vụ riêng
    // (auditUserAdmin) nên truyền logGranted:false để MỘT hành động = MỘT block
    // + MỘT thông báo (owner request 2026-09).
    const logGranted = options?.logGranted !== false;
    const operationTitle =
      (sensitiveOperation || "").trim() || permissionLabel(permission);
    if (decision.allowed ? logGranted : true) {
      appendSecurityAudit(
        createSecurityAudit({
          actorId: currentUser?.id ?? null,
          actorName,
          role: currentUser?.role ?? null,
          action: decision.allowed
            ? auditActionForMutation(decision.resourceType)
            : "PERMISSION_DENIED",
          resourceType: decision.resourceType,
          resourceId: decision.resourceId,
          timestamp: new Date().toISOString(),
          geographicScope: currentScopeName,
          result: decision.allowed ? "SUCCESS" : "DENIED",
          reason: decision.allowed
            ? operationalAuditReason({
                operation: sensitiveOperation,
                permissionLabel: permissionLabel(permission),
                decisionReason: decision.reason,
                resources,
              })
            : `${operationTitle} — ${decision.reason}`,
          permission,
        }),
      );
    }
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
      if (outcome.session) {
        setSession(outcome.session);
        setCurrentUser(outcome.user);
      }
      setUsers(authGateway.listUsers());
    }
    return {
      ok: outcome.ok,
      error: outcome.error,
      user: outcome.ok && outcome.user ? outcome.user : undefined,
      pendingEmailConfirmation: outcome.pendingEmailConfirmation,
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

  // Đồng bộ phiên Supabase Auth khi tải trang hoặc khi trạng thái phiên thay đổi
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;

    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION"
        ) {
          if (currentSession?.user) {
            const { data: verified, error: verifiedError } = await client.auth.getUser(currentSession.access_token);
            if (verifiedError || !verified.user || verified.user.id !== currentSession.user.id) {
              await client.auth.signOut();
              setSession(null);
              setCurrentUser(null);
              return;
            }
            const { data: profile, error: profileError } = await client
              .from("profiles")
              .select("*")
              .eq("id", verified.user.id)
              .maybeSingle();

            if (profile && !profileError) {
              const authUser = toAuthUser(profile as SupabaseProfileRow);
              if (!authUser.active) {
                await client.auth.signOut();
                setSession(null);
                setCurrentUser(null);
                return;
              }
              setCurrentUser(authUser);
              const domainSession: Session = {
                id: `SES-${currentSession.access_token.slice(-12)}`,
                token: currentSession.access_token,
                userId: authUser.id,
                issuedAt: new Date().toISOString(),
                expiresAt: currentSession.expires_at
                  ? new Date(currentSession.expires_at * 1000).toISOString()
                  : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
                lastValidatedAt: new Date().toISOString(),
              };
              setSession(domainSession);
            } else {
              await client.auth.signOut();
              setSession(null);
              setCurrentUser(null);
            }
          }
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setCurrentUser(null);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = () => {
    if (currentUser && session)
      appendSecurityAudit(logoutUser(authGateway, currentUser, session));
    else authGateway.logout();
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
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
  const updateUserActive = async (userId: string, active: boolean): Promise<void> => {
    // Tự khóa tài khoản của mình cũng bị chặn ở tầng logic (giữ nguyên như
    // quy tắc tự đổi vai trò: admin chỉ quản trị người khác).
    if (!active && currentUser?.id === userId) {
      appendSecurityAudit(
        createSecurityAudit({
          actorId: currentUser.id,
          actorName,
          role: currentUser.role,
          action: "PERMISSION_DENIED",
          resourceType: "User",
          resourceId: userId,
          timestamp: new Date().toISOString(),
          geographicScope: currentScopeName,
          result: "DENIED",
          reason: "Không thể tự vô hiệu hóa tài khoản của chính mình.",
          permission: "user_manage",
        }),
      );
      throw new Error("Không thể tự vô hiệu hóa tài khoản của chính mình.");
    }
    enforcePermission("user_manage", [{ type: "User", id: userId }], undefined, {
      logGranted: false,
    });
    // No-op guard: đặt lại đúng vai trò/scope/trạng thái hiện có thì KHÔNG ghi
    // gì cả — một hành động trùng giá trị không được sinh dòng nhật ký bảo mật
    // hay badge thông báo (owner request 2026-09).
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser || targetUser.active === active) return;
    if (!currentUser) return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc("admin_update_profile_authorization", {
        target_id: userId,
        next_active: active,
      });
      if (error) throw new Error(`Không thể cập nhật trạng thái tài khoản trên Supabase: ${error.message}`);
    }
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
  const updateUserRole = async (userId: string, nextRole: Role): Promise<void> => {
    // Triệt để ở tầng logic (không chỉ disabled trên UI): admin không thể tự
    // đổi vai trò của chính mình — kể cả khi gọi thẳng vào store. Vẫn đổi được
    // vai trò của admin khác.
    if (currentUser?.id === userId) {
      appendSecurityAudit(
        createSecurityAudit({
          actorId: currentUser.id,
          actorName,
          role: currentUser.role,
          action: "PERMISSION_DENIED",
          resourceType: "User",
          resourceId: userId,
          timestamp: new Date().toISOString(),
          geographicScope: currentScopeName,
          result: "DENIED",
          reason: "Không thể tự thay đổi vai trò của chính mình.",
          permission: "user_manage",
        }),
      );
      throw new Error("Không thể tự thay đổi vai trò của chính mình.");
    }
    enforcePermission("user_manage", [{ type: "User", id: userId }], undefined, {
      logGranted: false,
    });
    // No-op guard: chọn lại đúng vai trò hiện tại (vd. đã là Công dân mà vẫn
    // bấm Công dân) KHÔNG được sinh dòng nhật ký + thông báo (owner 2026-09).
    // Select component giờ cũng chặn phát onChange khi trùng giá trị — đây là
    // lớp phòng thủ thứ hai ngay tại store cho mọi nơi gọi khác (AI actions…).
    const roleTarget = users.find((user) => user.id === userId);
    if (!roleTarget || roleTarget.role === nextRole) return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc("admin_update_profile_authorization", {
        target_id: userId,
        next_role: nextRole,
      });
      if (error) throw new Error(`Không thể cập nhật vai trò trên Supabase: ${error.message}`);
    }
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
      `Đổi vai trò thành ${roleLabels[nextRole] ?? nextRole}.`,
    );
    if (session?.userId === userId)
      setCurrentUser(next.find((item) => item.id === userId) ?? null);
  };
  const updateUserScope = async (userId: string, scope: GeographicScope): Promise<void> => {
    enforcePermission("user_manage", [{ type: "User", id: userId }], undefined, {
      logGranted: false,
    });
    // No-op guard cùng loại với vai trò: scope không đổi → không ghi nhật ký.
    const scopeTarget = users.find((user) => user.id === userId);
    if (
      !scopeTarget ||
      (scopeTarget.geographicScope.level === scope.level &&
        scopeTarget.geographicScope.code === scope.code &&
        scopeTarget.geographicScope.name === scope.name)
    )
      return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc("admin_update_profile_authorization", {
        target_id: userId,
        next_scope_level: scope.level,
        next_scope_name: scope.name,
        next_scope_code: scope.code,
      });
      if (error) throw new Error(`Không thể cập nhật phạm vi trên Supabase: ${error.message}`);
    }
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
    organization?: string;
  }): Promise<void> => {
    if (!currentUser) return Promise.resolve();
    const nowStr = new Date().toISOString();
    // No-op guard: lưu hồ sơ y nguyên giá trị cũ (mở modal → bấm Lưu không sửa
    // gì) không được sinh dòng nhật ký bảo mật (owner request 2026-09).
    const sameProfile =
      (!input.displayName?.trim() ||
        input.displayName.trim() === currentUser.displayName) &&
      (input.organization === undefined || input.organization === currentUser.organization);
    if (sameProfile) return Promise.resolve();
    const persist = isSupabaseConfigured && supabase
      ? supabase.from("profiles").update({
          full_name: input.displayName?.trim() || currentUser.displayName,
          display_name: input.displayName?.trim() || currentUser.displayName,
          organization: input.organization ?? currentUser.organization ?? null,
          updated_at: nowStr,
        }).eq("id", currentUser.id)
      : Promise.resolve({ error: null });
    return Promise.resolve(persist).then(({ error }) => {
      if (error) throw new Error(`Không thể lưu hồ sơ trên Supabase: ${error.message}`);
    const next = users.map((u) =>
      u.id === currentUser.id
        ? {
            ...u,
            displayName: input.displayName?.trim() || u.displayName,
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
        geographicScope: currentScopeName,
        result: "SUCCESS",
        reason: `Người dùng ${currentUser.displayName} (@${currentUser.username}) đã tự cập nhật thông tin cá nhân/liên hệ.`,
      }),
    );
    });
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
      if (isSupabaseConfigured && supabase) {
        supabase.auth.getUser().then(({ data, error }) => {
          if (error || !data.user || data.user.id !== session.userId) {
            setSession(null);
            setCurrentUser(null);
          }
        });
        return;
      }
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
