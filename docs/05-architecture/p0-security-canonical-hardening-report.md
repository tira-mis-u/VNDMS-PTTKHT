# VNDMS — Báo cáo P0 Security & Canonical-State Hardening

**Ngày hoàn thành:** 21/08/2026  
**Tham chiếu:** `docs/05-architecture/system-readiness-audit.md`  
**Phạm vi:** chỉ ba blocker P0; không triển khai các finding P1/P2/P3.

## 1. Kết luận

Ba blocker P0 đã được xử lý trong kiến trúc hiện hữu:

1. Command Center không còn operational dataset thứ hai và chỉ đọc canonical state qua pure application queries.
2. Operational collections được lọc tại application read boundary trước khi presentation, Analytics hoặc AI nhận dữ liệu.
3. Mọi provider mutation authorization invocation nhận resource context; multi-resource commands kiểm tra toàn bộ resource liên quan.

Không tạo Context, Store, Event Bus, Audit Store, permission matrix, GIS abstraction hoặc operational entity system mới. `OperationalProvider` vẫn là canonical state owner duy nhất; `permissionMatrix` hiện hữu vẫn là RBAC source duy nhất.

## 2. Original P0 findings

### P0-1 — Command Center có nguồn operational data thứ hai

`commandCenterSeed.ts` chứa Incident, SOS, Team, Shelter, action queue, timeline, resource exceptions và operational status tĩnh. Một số Command Center components trộn các mảng này với state từ provider; ba detail maps ngoài Command Center cũng dùng shelter/SOS tĩnh.

### P0-2 — Read paths không enforce geographic authorization đồng nhất

Provider publish raw collections; route guard chỉ kiểm module permission. Local Officer có thể tìm entity ngoài scope trong list/detail bằng URL. Related collections, Analytics và AI có thể nhận raw records trước khi tự lọc.

### P0-3 — Mutation permission calls thiếu resource scope/ownership

Audit ghi nhận 103 textual occurrences liên quan `enforcePermission`; trước hardening các invocation chỉ truyền permission. Ownership/scope branches trong centralized authorization không có đủ context để quyết định và audit resource ID thường null.

## 3. Architectural changes

### 3.1 Canonical snapshot contract

Tạo `src/application/operations/operationalSnapshot.ts` làm application contract cho canonical snapshot. Infrastructure in-memory repository implement contract này; Simulation và provider dùng cùng type. Đây không phải state system mới.

Luồng runtime:

```text
Scenario seed
  → inMemoryOperationalRepository
  → OperationalProvider raw canonical state
  → authorized application read view
  → OperationalStateContext
  → feature/application queries
  → presentation
```

### 3.2 Command Center application queries

Tạo `src/application/command-center/commandCenterQueries.ts` với các pure selectors:

- `getCommandCenterHeader`
- `getSituationSummary`
- `getCommandCenterActionQueue`
- `getCommandCenterTimeline`
- `getCommandCenterResourceExceptions`
- `findCommandCenterEntity`

Các selectors nhận canonical snapshot. Header operational status/updated time, situation severity, metrics, action queue, timeline, exceptions và drawer entity đều được dẫn xuất từ canonical entities. Chỉ metadata hợp lệ của scenario (`id`, `name`, `scope`) còn tĩnh.

`src/data/scenarios/red-river-flood/commandCenterSeed.ts` đã bị xóa vì toàn bộ operational content trong đó là bản sao redundant. Không xóa canonical scenario seeds của Incident/Task/Team/Shelter/SOS/Relief/Playbook/Recovery/Simulation.

### 3.3 Canonical maps

- Command Center Map tiếp tục dùng MapLibre nhưng đọc provider collections.
- Incident detail map chỉ hiển thị authorized canonical SOS/Shelter liên quan Incident.
- Task/Team detail maps lấy canonical authorized Shelter thay vì Command Center seed.
- Không tạo map abstraction hoặc GIS source mới.

## 4. Read authorization model

### 4.1 Boundary

`src/application/authorization/authorizedOperationalView.ts` tạo một `OperationalSnapshot` được phép đọc từ raw canonical snapshot và authenticated user. Provider dùng view này khi tạo Context value; raw arrays vẫn chỉ tồn tại nội bộ để mutation và deterministic Simulation hoạt động.

Presentation không nhận record bị từ chối, vì vậy:

- list không cần tự triển khai geographic policy;
- detail URL không thể tìm entity ngoài scope;
- related events/updates chỉ tồn tại khi parent được phép;
- Command Center/Analytics đọc cùng authorized collections;
- AI grounding/evidence nhận authorized snapshot từ Context.

### 4.2 Policy reuse

Boundary tái sử dụng:

- `permissionMatrix` hiện hữu;
- `authorizeResources()` trong centralized security module;
- authenticated `AuthUser.geographicScope`;
- `teamId` và `warehouseId` hiện hữu;
- canonical entity geographic/relationship fields.

Không có permission matrix hoặc geographic policy thứ hai.

### 4.3 Role behavior

- **Commander:** national visibility theo permission hiện hữu.
- **Operator:** national visibility theo scope hiện hữu.
- **Local Officer:** chỉ records có resource scope chứa assigned district scope; parent/related records ngoài scope bị loại.
- **Rescue Leader/Member:** module permission hiện hữu cộng team ownership khi canonical resource có assigned team.
- **Warehouse Staff:** warehouse permission, geographic scope và warehouse ownership hiện hữu.
- **Relief Worker:** các module read permission hiện hữu trong geographic scope.
- **Citizen:** không có operational read permissions nên nhận collections rỗng; quyền `sos_create` không bị thay đổi.

Geographic comparison được làm directional: resource scope phải nằm trong/ghi rõ user scope; province-only resource không tự động mở cho district user.

### 4.4 Related-entity protection

Filtering giữ các relation sau nhất quán:

- Incident → events, Task, SOS, Evacuation, Playbook execution, Damage Assessment, Recovery Project.
- Task → task updates, Incident, assigned Team.
- Shelter/Evacuation → destination, Incident, assigned Team.
- Relief → Incident/Shelter/Evacuation/Team, Warehouse, Reservation, Shipment, events.
- Playbook → execution, Incident, linked operational records.
- Recovery → Incident, Assessment, assigned Team, related events.

## 5. Resource-scoped mutation authorization

### 5.1 Contract

`AuthorizationResource` mang context khi phù hợp:

- `type`, `id`
- `geographicScope`
- `ownerId`
- `assignedTeamId` / `assignedTeamIds`
- `warehouseId` / `warehouseIds`
- `lifecycleStatus`

`ResourceAuthorizationRequest` mang permission, resources và optional sensitive operation label. `authorizeResources()`:

1. xác minh session/user active;
2. kiểm permission từ matrix duy nhất;
3. kiểm từng resource geographic scope;
4. kiểm Rescue Team ownership;
5. kiểm Warehouse ownership;
6. từ chối toàn command nếu bất kỳ resource nào không hợp lệ.

Legacy `authorize(user, permission, scope, owner)` được giữ tương thích và delegate vào resource-aware engine.

### 5.2 Provider mutation boundary

`OperationalProvider.enforcePermission(permission, resources, operation?)` ghi security audit với resource type/ID cụ thể. Static scan hiện có:

- 1 `enforcePermission` definition;
- 102 executable mutation invocations;
- 0 invocation thiếu resource argument.

Số 103 trong audit ban đầu tương ứng textual occurrence gồm definition và executable call sites.

### 5.3 Multi-resource commands

Các command sau validate tất cả resource liên quan trước mutation:

- Incident dispatch: Incident + Team.
- Task create/assign/dispatch/release: Task + Incident + current/target Team.
- Evacuation create/assign/redirect/update: Evacuation + Incident + destination/target Shelter + assigned/target Team.
- SOS link/dispatch/task/route: SOS + Incident + Team/Shelter.
- Relief reserve/dispatch/shipment/receipt: Relief Request + Reservation + Warehouse + optional Team.
- Warehouse inventory/status: Inventory-owned Warehouse.
- Damage/Recovery: current/proposed geographic scope + Incident + Assessments + assigned Teams khi có.
- Playbook activate/execute/evidence: Playbook + Execution + Incident + mọi linked Task/Team/Shelter/Evacuation/SOS/Relief IDs được cập nhật.
- User administration: target User resource.
- Simulation controls: scenario Simulation resource.

Domain lifecycle rules vẫn chạy sau authorization và không bị nới lỏng.

### 5.4 AI final authorization

AI vẫn yêu cầu explicit confirmation, re-read canonical snapshot và re-check permission tại `executeGroundedAction`. Executor tiếp tục gọi provider commands; do đó final mutation đi qua resource-aware `enforcePermission` ngay trước state change. AI không có mutation path riêng.

## 6. Affected modules

- Command Center header, summary, action queue, map, timeline, detail drawer và resource exceptions.
- Incident/Task/Team detail map data sources.
- OperationalProvider Context publication và toàn bộ mutation boundary.
- Incident, Task, Team, Shelter/Evacuation, SOS, Relief/Warehouse, Playbook, Recovery, Simulation, User Admin commands.
- Analytics và AI gián tiếp nhận authorized Context view, không tạo riêng policy/filter.
- Infrastructure repository và Simulation dùng application snapshot contract.

## 7. Tests added

### `tests/application/p0-canonical-command-center.test.ts`

- canonical mutation thay đổi Command Center output;
- Simulation tạo canonical SOS và làm query thay đổi;
- reset trả query về baseline;
- không còn file/import Command Center operational dataset thứ hai.

### `tests/application/p0-read-authorization.test.ts`

- Local Officer đọc Tây Hồ và không đọc Long Biên;
- unauthorized detail URL không lấy entity;
- Task/SOS/event relation không leak Incident ngoài scope;
- Commander/Operator giữ global visibility;
- Citizen nhận zero operational read collections;
- Rescue/Warehouse collections tuân team/warehouse ownership.

### `tests/application/p0-resource-mutation-authorization.test.ts`

- mutation decision hợp lệ thành công;
- wrong geography bị từ chối;
- wrong Team/Warehouse ownership bị từ chối;
- multi-resource command fail nếu một resource ngoài scope;
- static scan provider bảo đảm mọi invocation có resource argument và không chứa permission matrix.

Existing AI confirmation/re-authorization, Simulation propagation và security audit suites được chạy lại trong focused regression.

## 8. Verification results

| Gate                                                 | Kết quả                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Focused P0/security/AI/Simulation                    | **42/42 pass**                                                          |
| Full suite                                           | **164/164 pass**                                                        |
| Lint                                                 | **0 warnings, 0 errors**                                                |
| TypeScript + production build                        | **Pass — 1,949 modules transformed**                                    |
| Main artifact                                        | 1,791.25 kB minified / 449.67 kB gzip; existing non-fatal chunk warning |
| HTTP SPA route checks                                | **31/31 HTTP 200**                                                      |
| Permission matrix definitions                        | **1**                                                                   |
| `authorizeResources` definitions                     | **1**                                                                   |
| OperationalProvider definitions                      | **1**                                                                   |
| React operational Context                            | **1**                                                                   |
| Runtime `src/` imports of `commandCenterSeed` / file | **0 / absent**                                                          |
| Mutation calls lacking resource argument             | **0/102**                                                               |
| Circular dependency                                  | Không thay đổi audit baseline: 0                                        |

## 9. Files created

- `src/application/operations/operationalSnapshot.ts`
- `src/application/authorization/authorizedOperationalView.ts`
- `src/application/command-center/commandCenterQueries.ts`
- `tests/application/p0-canonical-command-center.test.ts`
- `tests/application/p0-read-authorization.test.ts`
- `tests/application/p0-resource-mutation-authorization.test.ts`
- `docs/05-architecture/p0-security-canonical-hardening-report.md`

## 10. Files modified

### Runtime/architecture

- `src/lib/security/authorization.ts`
- `src/state/operations/OperationalContext.tsx`
- `src/application/simulation/simulationUseCases.ts`
- `src/infrastructure/persistence/inMemoryOperationalRepository.ts`

### Command Center and canonical maps

- `src/features/command-center/components/CommandCenter.tsx`
- `src/features/command-center/components/ActionQueue.tsx`
- `src/features/command-center/components/CoordinationTimeline.tsx`
- `src/features/command-center/components/DetailDrawer.tsx`
- `src/features/command-center/components/OperationalMap.tsx`
- `src/features/command-center/components/ResourceExceptions.tsx`
- `src/features/command-center/components/SituationSummary.tsx`
- `src/features/incidents/components/IncidentDetailMap.tsx`
- `src/features/tasks/components/TaskDetailMap.tsx`
- `src/features/teams/components/TeamOperationalMap.tsx`

Các Command Center components còn lại chỉ được formatter chuẩn hóa trong cùng pass, không đổi semantics:

- `ActionDialog.tsx`
- `IncidentOverview.tsx`
- `LogisticsExceptions.tsx`
- `PlaybookOperations.tsx`
- `QuickActions.tsx`
- `RecoveryExceptions.tsx`

### Documentation

- `docs/05-architecture/ARCHITECTURE.md`
- `docs/05-architecture/authentication-security.md`
- `docs/12-testing/authentication-security.md`

## 11. File removed

- `src/data/scenarios/red-river-flood/commandCenterSeed.ts` — duplicated operational runtime dataset; canonical scenario seed files vẫn giữ nguyên.

## 12. Remaining security limitations

Hardening này cải thiện correctness của application-layer authorization nhưng **không làm frontend trở thành production security boundary**.

Vẫn còn:

- browser client có thể sửa JavaScript/localStorage;
- auth/session/audit vẫn local và không tamper-proof;
- không có server-side authorization hoặc database row-level policy;
- không có HttpOnly session, MFA, rate limiting, CSRF/session binding hoặc server revocation;
- không có backend transaction/persistence;
- geographic scope hiện vẫn dựa trên canonical administrative display strings thay vì authoritative code hierarchy.

**Production bắt buộc có backend/server-side authentication, authorization, resource filtering, mutation validation và immutable audit.** Application resource contract trong thay đổi này là boundary để backend triển khai cùng semantics sau này, không phải thay thế backend.

## 13. P1/P2/P3 findings intentionally untouched

Theo đúng task scope, các finding sau chưa được triển khai:

### P1

- Provider God object/atomic snapshot transaction refactor.
- Runtime fixed clock và canonical ISO timestamp migration.
- Operational persistence/backend repository.
- Simulation reset semantics ngoài baseline hiện hữu.
- Incident lifecycle/closure invariants không thuộc P0.
- Unified mutation Result/Error Boundary.

### P2

- Toàn bộ dependency-direction/type strictness roadmap ngoài snapshot contract cần thiết cho P0.
- General query extraction cho mọi feature ngoài Command Center.
- ID generation service.
- AI file decomposition.
- Full TypeScript strict migration.

### P3

- Route-level code splitting và bundle budget.
- Context rerender optimization.
- Command Center quick-action placeholder replacement.
- Dialog accessibility primitive.
- Router 404/navigation/badge/Citizen landing redesign.
- CSS ownership cleanup.
- Test runner package script/CI setup.
- Toàn bộ documentation modernization/diagram/runbook ngoài tài liệu security/canonical liên quan trực tiếp.
