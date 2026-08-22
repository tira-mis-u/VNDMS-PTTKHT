# VNDMS — Operational Mutation Boundary Refactor

**Ngày hoàn thành:** 21/08/2026  
**Tham chiếu:** finding P1 “OperationalProvider is becoming a God object and lacks a clean atomic mutation/transaction boundary” trong `system-readiness-audit.md`  
**Phạm vi:** chỉ finding P1 nêu trên; giữ nguyên kiến trúc và hành vi sau P0.

## 1. Kết luận

`OperationalProvider` vẫn là application state boundary và canonical operational state owner duy nhất. Refactor không tạo Store, Context, Event Bus, permission matrix, authorization engine, audit system hoặc operational model thứ hai.

Toàn bộ operational command được publish ra `OperationalStateContext` nay đi qua một application-level mutation boundary dùng draft snapshot. Incident; Task–Team; SOS–Task–Team; Shelter–Evacuation–Team; Relief–Warehouse–Shipment–Team; Playbook; Recovery; và Simulation cùng dùng boundary này.

Boundary bảo đảm atomicity cục bộ cho state in-memory xác định:

- thành công: publish một canonical snapshot hoàn chỉnh;
- lỗi tại bất kỳ bước nào: bỏ toàn bộ draft, giữ nguyên snapshot trước command và ném lại lỗi;
- nested command: dùng chung draft, không publish sớm;
- Simulation snapshot và Simulation control: commit/reset cùng nhau.

Đây **không phải database transaction production**. Không có durability, isolation giữa client/process, server concurrency control hoặc rollback tài nguyên bên ngoài.

## 2. Kiến trúc sau refactor

```text
Presentation
  → authorized application command exposed by OperationalProvider
  → existing resource-aware authorization
  → OperationalMutationBoundary
      → isolated OperationalSnapshot + SimulationState draft
      → domain/application use cases
      → canonical entity timeline writers
  → one commit to Provider-owned React state
  → authorized canonical read view
  → OperationalStateContext
```

Các lớp và trách nhiệm:

- **Presentation:** gọi Context command; không tự phân quyền hoặc mutate operational state.
- **OperationalProvider:** canonical boundary duy nhất; phối hợp command, authorization, use case, commit và publication.
- **Application/domain:** giữ lifecycle rule, validation và calculation hiện hữu.
- **OperationalMutationBoundary:** quản lý draft, nested execution, commit/discard và rethrow.
- **useAtomicOperationalState:** React aggregate-state mechanics duy nhất, adapter setter-shaped cho orchestration hiện hữu; không phải Context/store thứ hai.
- **Infrastructure repository:** tiếp tục chỉ cấp deterministic cloned baseline; không bị mô tả sai thành transactional repository.
- **Authorized read boundary:** tiếp tục lọc canonical snapshot trước presentation, Analytics và AI.

## 3. Trách nhiệm đã bỏ khỏi Provider

Các phần sau được tách khỏi `OperationalContext.tsx` theo trách nhiệm hẹp:

1. **Cơ chế aggregate state và draft/commit/discard** → `useAtomicOperationalState.ts` và `operationalMutationBoundary.ts`.
2. **Xây resource context/linked resource graph phục vụ authorization** → `operationalResourceContext.ts`.
3. **Canonical entity timeline writer construction** → `operationalTimeline.ts`.
4. **Authentication, session, permission enforcement và security-audit mechanics** → `useOperationalSecurity.ts`.

Provider giảm từ bản trung gian trước extraction **3.861 dòng / 126.101 byte** xuống **3.348 dòng / 109.813 byte** sau final formatting và draft-read adjustments. Provider vẫn còn lớn có chủ đích vì external command contract và cross-entity orchestration phải ở canonical boundary; refactor không chuyển toàn bộ logic sang một generic God service.

## 4. Mutation boundary và rollback

### 4.1 Draft lifecycle

`OperationalMutationBoundary.execute()`:

1. Clone latest `{ snapshot, control }` thành isolated draft.
2. Cho mọi setter-shaped write cập nhật draft thay vì React state.
3. Cho nested command tăng depth và dùng cùng draft.
4. Khi outer command hoàn tất, commit draft một lần.
5. Khi command ném lỗi, xóa draft, không gọi commit và rethrow nguyên lỗi.

`currentOperationalSnapshot()` và `currentSimulationState()` đọc draft khi boundary active; ngoài command chúng đọc latest committed ref. Cơ chế này giữ deterministic Simulation propagation và tránh đọc snapshot đã cũ trong nested orchestration.

### 4.2 Phạm vi rollback

Các canonical timeline/event collection nằm trong `OperationalSnapshot`, vì vậy timeline write cũng rollback cùng entity mutation. Simulation control nằm trong cùng atomic state object với operational snapshot, vì vậy tick/reset không thể publish một nửa.

Security authorization audit là concern cross-cutting hiện hữu và không phải canonical operational entity store. Việc giữ denied authorization record không được xem là partial operational commit.

### 4.3 Giới hạn

Boundary chỉ áp dụng cho local synchronous deterministic operation. Nó không cung cấp:

- database ACID transaction;
- distributed transaction hoặc outbox;
- rollback network request/file/external side effect;
- multi-tab/process isolation;
- server-side security hoặc durable audit.

Production vẫn cần backend transaction, server authorization, persistence và immutable audit.

## 5. Authorization và sensitive commands

Authorization vẫn chạy trước mutation qua `useOperationalSecurity.enforcePermission()` và centralized `authorizeResources()` hiện hữu. Permission matrix vẫn chỉ nằm tại `src/lib/permissions/permissions.ts`.

Resource context tiếp tục mang permission, geographic scope, team/warehouse ownership, lifecycle state và mọi linked resource. Multi-resource command chỉ vào mutation sau khi toàn bộ resources đã được kiểm tra.

Static và regression verification xác nhận:

- một `permissionMatrix` definition;
- một `authorizeResources` definition;
- một `OperationalProvider` definition;
- một operational React Context;
- một `OperationalMutationBoundary` definition;
- `useAtomicOperationalState` chỉ được gọi bởi Provider;
- không có feature import trực tiếp in-memory operational repository hoặc mutation boundary;
- representative sensitive commands đều được publish dưới dạng `atomic(command)`.

Các representative path đã quét: Incident–Team, Task–Team, SOS–Task–Team, Shelter–Evacuation–Team, Relief–Warehouse–Shipment–Team, Playbook linked evidence/mutations, Recovery và Simulation.

## 6. AI và Simulation

AI executable action không có mutation path riêng. Recommendation vẫn cần confirmation; executor re-read current authorized state, re-check final authorization và gọi Provider command. Provider command sau đó đi qua cùng atomic boundary như thao tác UI.

Simulation timer gọi `executeAtomic(stepSimulation)`. Manual play/pause/step/speed/reset được publish qua `atomic(...)`. Snapshot propagation và control state đọc active draft, nên tick/reset vẫn deterministic và publish cùng nhau.

## 7. Tests bổ sung

`tests/application/operational-mutation-boundary.test.ts` có 16 tests:

1. Single-resource commit thành công.
2. Task + Team multi-resource atomic success.
3. Lỗi ở mutation thứ hai bỏ mutation thứ nhất.
4. Lỗi muộn rollback mọi slice trước đó.
5. RBAC denial không commit.
6. Geographic denial không để partial state.
7. Ownership denial không để partial state.
8. SOS + Task + Team đồng bộ trong một snapshot.
9. Shelter + Evacuation + Team đồng bộ trong một commit.
10. Relief + Warehouse + Shipment + Team rollback cùng nhau.
11. Playbook linked canonical mutation rollback cùng execution.
12. Simulation snapshot/control propagation xác định.
13. Timeline commit khi thành công và discard khi lỗi.
14. Reset publish repository baseline và Simulation baseline cùng nhau.
15. Nested command không publish trước outer command.
16. Static scan bảo đảm operational commands được publish qua atomic boundary.

Các yêu cầu Task–Team, SOS–Task–Team, Shelter–Evacuation–Team, Relief–Warehouse–Team, Playbook, Simulation, timeline và reset đều có coverage trực tiếp. Existing P0 authorization, domain synchronization, AI confirmation/final authorization và security audit suites được chạy lại.

## 8. Kết quả verification

| Gate                                                | Kết quả                              |
| --------------------------------------------------- | ------------------------------------ |
| Mutation boundary suite                             | **16/16 pass**                       |
| Focused P1/P0/domain/AI/security regression         | **86/86 pass**                       |
| Full suite                                          | **180/180 pass**                     |
| Lint                                                | **0 warnings, 0 errors**             |
| TypeScript + production build                       | **Pass — 1.954 modules transformed** |
| Production route transport checks                   | **31/31 HTTP 200**                   |
| Permission matrix definitions                       | **1**                                |
| `authorizeResources` definitions                    | **1**                                |
| `OperationalProvider` definitions                   | **1**                                |
| Operational React Context                           | **1**                                |
| `OperationalMutationBoundary` definitions           | **1**                                |
| Feature direct repository/boundary bypass           | **0**                                |
| Representative sensitive command atomic publication | **8/8**                              |

Build giữ existing non-fatal large-chunk advisory; route code splitting không thuộc finding này.

## 9. Files created

- `src/application/operations/operationalMutationBoundary.ts`
- `src/application/authorization/operationalResourceContext.ts`
- `src/application/operations/operationalTimeline.ts`
- `src/state/operations/useAtomicOperationalState.ts`
- `src/state/operations/useOperationalSecurity.ts`
- `tests/application/operational-mutation-boundary.test.ts`
- `docs/05-architecture/operational-mutation-boundary-refactor.md`

## 10. Files modified

- `src/state/operations/OperationalContext.tsx` — integrate atomic state, publish all operational commands through boundary, route Simulation timer through boundary, consume extracted modules.
- `tests/application/p0-resource-mutation-authorization.test.ts` — scanner theo dõi resource authorization tại Provider và extracted security hook.
- `docs/05-architecture/ARCHITECTURE.md` — ghi nhận canonical owner, atomic draft boundary và giới hạn production.

Không thay đổi shell, sidebar/header, design system, custom History API router hoặc feature presentation contract.

## 11. Findings intentionally untouched

Đúng theo phạm vi task, refactor này không triển khai:

- unified mutation Result/error UI hoặc Error Boundary;
- fixed operational clock, ISO timestamp migration hoặc ID generation service;
- backend persistence, database transaction, server authorization hoặc Simulation reset redesign;
- Incident lifecycle redesign;
- query extraction ngoài Provider logic bị ảnh hưởng;
- AI decomposition;
- strict TypeScript migration;
- route code splitting/bundle budget;
- accessibility overhaul, CSS cleanup hoặc CI modernization.

Các P1/P2/P3 finding khác trong readiness audit vẫn giữ nguyên trạng thái; tài liệu này không tuyên bố đã xử lý chúng.
