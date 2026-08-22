# Domain model — Authentication & Security

## AuthUser

User gồm ID, display name, username, role, `GeographicScope`, active state và optional teamId/warehouseId. Demo seed có Commander, Operator, Local Officer, Rescue Leader, Rescue Member, Warehouse Staff, Relief Worker và Citizen.

## Session

Session gồm opaque token, session ID, user ID, issuedAt, expiresAt và lastValidatedAt. Local adapter dùng TTL 8 giờ. Session không phải business entity và không sao chép operational state.

## AuthorizationDecision

Quyết định rõ ràng gồm allowed, reason, permission, current scope và resource scope. Quyền lấy duy nhất từ `permissionMatrix`; geographic/ownership rules bổ sung sau role permission.

## SecurityAuditEvent

Audit gồm actor ID/name, role, action, resource type/ID, timestamp, geographic scope, result, reason và permission. Audit là cross-cutting security record, không thay Incident/Task/Recovery timeline.

## Roles

`UserRole` được mở rộng bằng `warehouse_staff` và `relief_worker`. Permission matrix hiện hữu được mở rộng, không tạo hệ thống quyền thứ hai. `user_manage` và `audit_view` dành cho quản trị; `simulation_control` tiếp tục được đánh giá qua authenticated user.
