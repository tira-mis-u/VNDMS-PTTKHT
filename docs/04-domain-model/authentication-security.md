# Domain model — Authentication & Security

## AuthUser

User gồm ID, display name, username, role, `GeographicScope`, active state. `teamId`/`warehouseId` chỉ còn là dữ liệu lịch sử, không cấp quyền. Demo seed có đúng 7 tài khoản: 1 `admin`, 1 `disaster_officer`, 1 `rescue_unit`, 4 `citizen`.

## Session

Session gồm opaque token, session ID, user ID, issuedAt, expiresAt và lastValidatedAt. Local adapter dùng TTL 8 giờ. Session không phải business entity và không sao chép operational state.

## AuthorizationDecision

Quyết định rõ ràng gồm allowed, reason, permission, current scope và resource scope. Quyền lấy duy nhất từ `permissionMatrix`; geographic/ownership rules bổ sung sau role permission.

## SecurityAuditEvent

Audit gồm actor ID/name, role, action, resource type/ID, timestamp, geographic scope, result, reason và permission. Audit là cross-cutting security record, không thay Incident/Task/Recovery timeline.

## Roles

`UserRole` V2 = `admin | disaster_officer | rescue_unit | citizen`; vai cũ được ánh xạ qua `LEGACY_ROLE_MAP` khi migration (`ROLE_MODEL_VERSION = 2`, có backup và rollback). Một permission matrix duy nhất; `user_manage` và `audit_view` dành cho `admin`, quyền nghiệp vụ (xác minh/điều phối/xác nhận kết quả/công bố) dành cho `disaster_officer`.
