# Kiểm thử — Authentication & Security

## Authentication/session

Valid/invalid login, inactive account, 8-hour session, refresh restoration, expiration, malformed session, logout và rejection sau logout.

## Authorization

Role permission, missing permission, national/local geographic scope, warehouse/team ownership, unauthenticated/inactive denial và admin user mutations.

P0 hardening bổ sung:

- `p0-read-authorization.test.ts`: collection/detail/related-record filtering cho Local Officer, global roles, Rescue, Warehouse và Citizen.
- `p0-resource-mutation-authorization.test.ts`: geographic/ownership denial, multi-resource decisions và static scan mọi provider call site có resource context.
- `p0-canonical-command-center.test.ts`: canonical mutation, Simulation propagation, reset và không còn Command Center dataset thứ hai.

## Audit/integration

LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT ordering; denied decision attribution; authorized mutation audit; login/protected/admin route parsing.

## Regression quality gate

- Focused security tests: ba file application/integration.
- Full suite: `npx --yes tsx --test tests/**/*.test.ts`.
- `npm run lint`, `npm run build`.
- HTTP 200 cho `/login`, `/command`, `/admin/users`, `/admin/audit` và tất cả operational routes (SPA transport check).
- Functional session checks dùng adapter tests vì curl không duy trì browser localStorage.
- Static scan: không AuthContext/store/event bus/permission matrix thứ hai, emoji hoặc icon ngoài Lucide.
