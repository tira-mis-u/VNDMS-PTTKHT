/**
 * Cách trình bày một dòng nhật ký bảo mật cho các thao tác nghiệp vụ.
 * Tách thành module thuần (không React) để hook runtime và test dùng chung —
 * đảm bảo mọi lệnh ghi vào store (điều hành/ứng phó) đều để lại dấu vết ĐỌC
 * ĐƯỢC trong trang Nhật ký bảo mật, thay vì hòa vào nhãn "tài khoản".
 */
import type { AuditAction } from "../../domain/auth/types";

/** Loại tài nguyên thuộc phạm vi quản trị tài khoản/phiên, KHÔNG phải nghiệp vụ. */
export const ACCOUNT_SCOPED_RESOURCES: ReadonlySet<string> = new Set([
  "User",
  "Session",
  "Security",
  "RoleModel",
  "PermissionBoundary",
]);

export function auditActionForMutation(resourceType: string): AuditAction {
  return ACCOUNT_SCOPED_RESOURCES.has(resourceType)
    ? "MUTATION_AUTHORIZED"
    : "OPERATIONAL_MUTATION";
}

export interface AuditResourceRef {
  type: string;
  id: string;
}

export interface OperationalAuditReasonInput {
  /** Nhãn người đọc do nơi gọi cung cấp (sensitiveOperation), nếu có. */
  operation?: string;
  /** Nhãn tiếng Việt của quyền (permissionLabel). */
  permissionLabel: string;
  /** Lý do quyết định quyền từ authorizeResources. */
  decisionReason: string;
  /** Danh sách bản ghi liên quan (sự cố + đội + nhiệm vụ…) của một thao tác. */
  resources?: readonly AuditResourceRef[];
}

/**
 * Dòng "Lý do" nhân văn cho phép: <thao tác> — đối tượng: <loại:id, …> — <quyết định quyền>.
 */
export function operationalAuditReason(
  input: OperationalAuditReasonInput,
): string {
  const title = (input.operation || "").trim() || input.permissionLabel;
  const objects = (input.resources ?? [])
    .map((resource) => `${resource.type}:${resource.id}`)
    .filter(Boolean);
  const seen = new Set<string>();
  const uniqueObjects = objects.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
  const objectPart = uniqueObjects.length
    ? ` — đối tượng: ${uniqueObjects.join(", ")}`
    : "";
  const decision = (input.decisionReason || "").trim();
  return `${title}${objectPart}${decision ? ` — ${decision}` : ""}`;
}
