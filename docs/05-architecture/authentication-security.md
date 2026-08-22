# Kiến trúc — Authentication, Session, RBAC & Audit

## Luồng phụ thuộc

Presentation (`features/auth`, header, route guard) → application auth use cases → domain auth contracts → replaceable local adapters. Authorization tiếp tục dùng `lib/permissions/permissions.ts`, bổ sung decision/scope logic ở `lib/security/authorization.ts`.

## State

Không có AuthContext/AuthStore. `OperationalProvider` hiện hữu giữ current session/user/users/audit cùng canonical operational state và cung cấp mutation boundary duy nhất. Business modules vẫn dùng `can()` và các provider mutations.

## Adapter boundary

`AuthenticationGateway` và `AuditGateway` tách application khỏi localStorage. `LocalAuthenticationAdapter` là demo frontend: SHA-256 credential comparison, random opaque token, TTL, restore/logout. Một backend adapter sau này có thể thay thế gateway mà không đổi UI/use cases.

## Protected routing

App chỉ render shell khi có valid session/current user. `/login` là unauthenticated surface. Route permission map chặn module không phù hợp và hiển thị Access Denied. `/admin/users` yêu cầu `user_manage`; `/admin/audit` yêu cầu `audit_view`.

## Read authorization boundary

`src/application/authorization/authorizedOperationalView.ts` tạo read model được phép từ canonical `OperationalSnapshot`. `OperationalProvider` giữ raw state nội bộ cho mutation/Simulation nhưng chỉ publish authorized collections qua Context. Vì vậy list, detail URL, Command Center, Analytics và AI grounding cùng nhận một view đã lọc theo permission, geographic scope và ownership; page không phải tự triển khai policy.

Related collections được lọc theo parent/entity IDs đã được phép để Local Officer không suy ra Incident ngoài scope qua Task, SOS, Relief, Playbook hoặc Recovery. Commander/Operator national giữ visibility hiện hữu; Rescue và Warehouse roles được giới hạn bằng team/warehouse ownership hiện hữu; Citizen không nhận operational read collection.

## Mutation/audit boundary

Provider `enforcePermission` gọi centralized `authorizeResources` với một hoặc nhiều `AuthorizationResource`, ghi `MUTATION_AUTHORIZED` hoặc `PERMISSION_DENIED`, rồi mới chạy use case. Context gồm resource type/ID, geographic scope, team/warehouse ownership và lifecycle status. Multi-resource commands như Task–Team, Evacuation–Team/Shelter, SOS–Team, Relief–Warehouse–Team và Playbook linked evidence phải pass toàn bộ resource decisions. Không có mutation call site nào còn bỏ resource argument.

AI action vẫn re-read canonical state và re-check permission tại action service; executor gọi provider mutation nên resource-aware authorization được kiểm tra lần cuối ngay trước mutation. Actor business events lấy displayName của session.

## Security/threat considerations

Đây không phải backend authentication. localStorage dễ bị ảnh hưởng nếu có XSS; client code và password hash đều có thể kiểm tra. Không có HttpOnly cookie, server revocation, rate limiting, MFA, CSRF/session binding hay tamper-proof audit. Kiến trúc chỉ mô phỏng semantics và replacement boundary đúng cho graduation demo.
