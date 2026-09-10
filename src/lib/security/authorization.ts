import type { AuthUser, AuthorizationDecision } from "../../domain/auth/types";
import type { Permission } from "../permissions/permissions";
import { hasPermission } from "../permissions/permissions";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export interface AuthorizationResource {
  type: string;
  id: string;
  geographicScope?: string;
  ownerId?: string;
  /** Tài khoản đã tạo bản ghi (SOS/phản ánh) — dùng cho quyền *_own. */
  ownerUserId?: string | null;
  assignedTeamId?: string | null;
  assignedTeamIds?: string[];
  lifecycleStatus?: string;
}

/** Quyền chỉ hợp lệ trên bản ghi do chính tài khoản tạo. */
const OWN_ONLY_PERMISSIONS: readonly Permission[] = [
  "sos_view_own",
  "report_view_own",
];

/** Quyền của đơn vị cứu hộ chỉ hợp lệ trên nhiệm vụ/SOS đã được giao cho một đội. */
const RESCUE_ASSIGNED_ONLY_PERMISSIONS: readonly Permission[] = [
  "task_accept",
  "task_start",
  "task_update",
  "task_report_done",
  "update_progress",
  "sos_update_field",
];

export interface ResourceAuthorizationRequest {
  permission: Permission;
  resources: readonly AuthorizationResource[];
  sensitiveOperation?: string;
}

export interface ResourceAuthorizationDecision extends AuthorizationDecision {
  resourceType: string;
  resourceId: string | null;
  resources: readonly AuthorizationResource[];
}

export function isWithinGeographicScope(
  user: AuthUser,
  resourceScope?: string,
) {
  if (!resourceScope || user.geographicScope.level === "national") return true;
  const userScope = normalize(user.geographicScope.name);
  const resource = normalize(resourceScope);
  return resource.includes(userScope);
}

/**
 * Quy tắc sở hữu V2. `teamId`/`warehouseId` cũ trên tài khoản KHÔNG còn được
 * dùng: đơn vị cứu hộ (rescue_unit) đại diện cho toàn bộ lực lượng cứu hộ và
 * chỉ bị giới hạn bởi việc bản ghi đã được giao cho một đội hay chưa.
 */
function ownershipReason(
  user: AuthUser,
  permission: Permission,
  resource: AuthorizationResource,
) {
  if (OWN_ONLY_PERMISSIONS.includes(permission)) {
    if (resource.ownerUserId === undefined) return null;
    if (resource.ownerUserId !== user.id)
      return "Chỉ được xem bản ghi do chính tài khoản này gửi.";
  }
  if (
    user.role === "rescue_unit" &&
    RESCUE_ASSIGNED_ONLY_PERMISSIONS.includes(permission) &&
    (resource.type === "Task" || resource.type === "SOS")
  ) {
    const assigned = resource.assignedTeamIds?.length
      ? resource.assignedTeamIds
      : resource.assignedTeamId
        ? [resource.assignedTeamId]
        : [];
    if (!assigned.length)
      return "Đơn vị cứu hộ chỉ thao tác trên nhiệm vụ/SOS đã được cán bộ phân công.";
  }
  return null;
}

export function authorizeResources(
  user: AuthUser | null,
  request: ResourceAuthorizationRequest,
): ResourceAuthorizationDecision {
  const fallback = {
    level: "national" as const,
    name: "Chưa xác định",
    code: "NONE",
  };
  const first = request.resources[0];
  const base = {
    permission: request.permission,
    scope: user?.geographicScope ?? fallback,
    resourceScope: first?.geographicScope,
    resourceType:
      request.resources.map((resource) => resource.type).join("+") || "System",
    resourceId:
      request.resources
        .map((resource) => resource.id)
        .filter(Boolean)
        .join(",") || null,
    resources: request.resources,
  };
  if (!user)
    return {
      ...base,
      allowed: false,
      reason: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
    };
  if (!user.active)
    return { ...base, allowed: false, reason: "Tài khoản đã bị vô hiệu hóa." };
  if (!hasPermission(user.role, request.permission))
    return {
      ...base,
      allowed: false,
      reason: `Vai trò hiện tại không được cấp quyền ${request.permission}.`,
    };
  for (const resource of request.resources) {
    if (!isWithinGeographicScope(user, resource.geographicScope))
      return {
        ...base,
        resourceScope: resource.geographicScope,
        resourceType: resource.type,
        resourceId: resource.id,
        allowed: false,
        reason: `Tài nguyên ${resource.id} nằm ngoài phạm vi địa lý được phân công.`,
      };
    const reason = ownershipReason(user, request.permission, resource);
    if (reason)
      return {
        ...base,
        resourceScope: resource.geographicScope,
        resourceType: resource.type,
        resourceId: resource.id,
        allowed: false,
        reason,
      };
  }
  return {
    ...base,
    allowed: true,
    reason: request.sensitiveOperation
      ? `Được phép thực hiện ${request.sensitiveOperation} theo vai trò và phạm vi quản lý hiện tại.`
      : "Được phép theo vai trò và phạm vi quản lý hiện tại.",
  };
}

export function authorize(
  user: AuthUser | null,
  permission: Permission,
  resourceScope?: string,
  ownerId?: string,
): AuthorizationDecision {
  return authorizeResources(user, {
    permission,
    resources:
      resourceScope || ownerId
        ? [
            {
              type: "Resource",
              id: ownerId ?? resourceScope ?? "unknown",
              geographicScope: resourceScope,
              ownerId,
              // Quyền *_own (V2) so khớp ownerUserId với tài khoản hiện tại.
              ownerUserId: ownerId,
            },
          ]
        : [],
  });
}

export function assertAuthorized(
  user: AuthUser | null,
  permission: Permission,
  resourceScope?: string,
  ownerId?: string,
) {
  const decision = authorize(user, permission, resourceScope, ownerId);
  if (!decision.allowed) throw new Error(decision.reason);
  return decision;
}

export function assertAuthorizedResources(
  user: AuthUser | null,
  request: ResourceAuthorizationRequest,
) {
  const decision = authorizeResources(user, request);
  if (!decision.allowed) throw new Error(decision.reason);
  return decision;
}
