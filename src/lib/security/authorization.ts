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
  assignedTeamId?: string | null;
  assignedTeamIds?: string[];
  warehouseId?: string | null;
  warehouseIds?: string[];
  lifecycleStatus?: string;
}

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

function ownershipReason(user: AuthUser, resource: AuthorizationResource) {
  if (
    (user.role === "rescue_leader" || user.role === "rescue_member") &&
    user.teamId
  ) {
    const teamOwners = resource.assignedTeamIds?.length
      ? resource.assignedTeamIds
      : resource.assignedTeamId
        ? [resource.assignedTeamId]
        : resource.ownerId
          ? [resource.ownerId]
          : [];
    if (teamOwners.length && !teamOwners.includes(user.teamId))
      return "Thao tác chỉ được phép đối với đội được phân công.";
  }
  if (user.role === "warehouse_staff" && user.warehouseId) {
    const warehouseOwners = resource.warehouseIds?.length
      ? resource.warehouseIds
      : resource.warehouseId
        ? [resource.warehouseId]
        : resource.ownerId
          ? [resource.ownerId]
          : [];
    if (warehouseOwners.length && !warehouseOwners.includes(user.warehouseId))
      return "Thao tác chỉ được phép đối với kho được phân công.";
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
        reason: `Tài nguyên ${resource.type} ${resource.id} nằm ngoài phạm vi địa lý được phân công.`,
      };
    const reason = ownershipReason(user, resource);
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
      ? `Được phép thực hiện ${request.sensitiveOperation} theo vai trò, phạm vi và ownership hiện tại.`
      : "Được phép theo vai trò, phạm vi và ownership hiện tại.",
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
