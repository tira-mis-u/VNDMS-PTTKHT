# VNDMS — Module Completion Inventory

Inventory này dựa trên route parser, page/component thực tế, `OperationalSnapshot`, domain/application modules, permission matrix, Provider commands và test suite; không dựa vào tên thư mục hoặc tuyên bố trong README.

## 1. Module inventory

| Module | Route | UI | Domain | Application | Integration | RBAC | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| Authentication / Session | `/login` | Login, restore, logout, expiry feedback | Auth types | Auth contracts/use cases | Session, current user, audit | Có | Auth/session tests | DONE |
| Authorization / Audit | Toàn app, `/admin/audit` | Access Denied, audit table | Auth/resource types | Authorized read view, resource context | Mọi read/mutation boundary | Có | Authorization, audit, bypass tests | DONE |
| Incident | `/incidents`, `/incidents/:id` | List/detail, create, dispatch, lifecycle, timeline, map | Incident types + invariants | Incident use cases | Task, Team, SOS, Shelter, Relief, Playbook, Recovery | Có | Application/integration tests | DONE |
| Task / Dispatch | `/tasks`, `/tasks/:id` | List/detail, create, assign, progress, field update, map | Task rules/types | Task use cases | Incident, Team, SOS, Recovery, Playbook | Có | Mutation/cross-module tests | DONE |
| Rescue Team | `/teams`, `/teams/:id` | List/detail, dispatch, status, GPS, members/capabilities | Team rules/types | Team queries/use cases | Task, Incident, Shelter, SOS, Relief | Có, gồm ownership | Team/domain/integration tests | DONE |
| Shelter | `/shelters`, `/shelters/:id` | List/detail, capacity/readiness, map, actions | Shelter rules/types | Shelter queries/use cases | Evacuation, Team, Incident, Relief, SOS | Có | Shelter/evacuation tests | DONE |
| Evacuation workspace | `/workspace/Sơ tán` | Route riêng chỉ là placeholder; workflow thật nằm trong Shelter detail | Evacuation rules/types | Evacuation use cases | Shelter, Team, Incident, SOS | Có | Domain/application/integration tests | PARTIAL |
| SOS / Emergency Request | `/sos`, `/sos/:id` | List/detail, triage, verify/reject, link/create Incident/Task, dispatch, resolve | SOS rules/types | SOS queries/use cases | Incident, Task, Team, Shelter | Có | SOS + AI/cross-module tests | DONE |
| Relief / Distribution | `/relief`, `/relief/requests/:id` | Request lifecycle, allocation, shipment, receipt | Relief rules/types | Relief queries/use cases | Incident, Shelter, Warehouse, Team | Có | Domain/application/integration tests | DONE |
| Warehouse / Inventory | `/relief/warehouses`, `/relief/warehouses/:id` | List/detail, inventory adjustment, warehouse status | Relief/Warehouse types/rules | Relief use cases/queries | Relief requests, reservations, shipments, ownership | Có, gồm ownership | Relief/authorization tests | DONE |
| Playbooks / SOP | `/playbooks`, `/playbooks/:id`, `/playbooks/:id/execute` | Template, publish, activate, step execution/evidence | Playbook rules/types | Queries/use cases | Incident, Task, Team, Shelter, SOS, Relief, Recovery | Có | Domain/application/cross-module tests | DONE |
| Damage Assessment | `/recovery`, `/recovery/assessments/:id` | List/detail, items, evidence, review/verify/reject | Recovery rules/types | Recovery queries/use cases | Incident, Recovery Project | Có | Recovery tests | DONE |
| Recovery Project | `/recovery/projects`, `/recovery/projects/:id` | Lifecycle, budget, milestone, verification | Recovery rules/types | Recovery queries/use cases | Assessment, Incident, Task, Team, Relief, Playbook | Có | Recovery/cross-module tests | DONE |
| Analytics / Reporting | `/analytics/*` | Operations/resources/incidents/reports, entity links/export | Analytics types | Pure analytics/report queries | Authorized canonical snapshot | Có qua authorized read | Analytics/report tests | DONE |
| Simulation | `/simulation` | Deterministic controls, event log, map, reset | Simulation engine/types | Simulation use cases | Canonical state qua mutation boundary | Có | Engine/propagation/cross-module tests | DONE |
| Grounded AI | `/ai-assistant` | Query, evidence, recommendation, confirmation | AI rules/types | Grounding, queries, recommendations, actions | Authorized snapshot; confirmed canonical commands | Có và re-authorize | Grounding/authorization/action tests | DONE |
| Command Center | `/`, `/command` | Projection, queue, timeline, maps, entity links; quick-action dialog và header filters còn UI-only | Không sở hữu domain riêng | Canonical command-center queries | Tất cả core modules | Có | Canonical/projection tests | PARTIAL |
| GIS embedded | Các detail/map route | MapLibre thật trong Command Center và nhiều module | Không cần domain riêng | GIS adapter/config | Incident, Task, Team, Shelter, SOS, Relief, Recovery, Simulation | Theo authorized data | GIS label + browser checks | DONE |
| Unified Operational Map | `/workspace/Bản đồ tác nghiệp` | Map workspace đầy đủ: GeoJSON sources, circle layers, route polylines, legend, toolbar | Drawer/detail link canonical per kind | Unified geospatial query (`unifiedMapQueries`) | Đọc trực tiếp authorized OperationalSnapshot của 9 nhóm entity có tọa độ | Kế thừa Read-Surface perimeter qua `createAuthorizedOperationalView`, quyền `view` | 12 focused tests (`unified-operational-map.test.ts`) + simulation propagation | DONE |
| Hazard Situation | `/workspace/Tình hình thiên tai` | Placeholder; Situation Summary chỉ tồn tại trong Command Center | Không có hazard/observation model | Không có use case/module query riêng | Chỉ gián tiếp qua Incident/Simulation | Chỉ permission `view` của placeholder | Không | PLACEHOLDER |
| Alerts / Notifications | `/workspace/Cảnh báo`; notification header chưa điều hướng | Badge/popover tĩnh và placeholder; “Gửi cảnh báo” chỉ mở dialog không mutation | Không có Alert domain | Không có lifecycle/use case | Chưa nối Incident/Simulation/GIS/audit | Chỉ permission `view` của placeholder | Không | PLACEHOLDER |
| Reconstruction workspace | `/workspace/Tái thiết` | Placeholder; nghiệp vụ tương ứng một phần đã có ở Recovery Project | Có Recovery domain, không có module Tái thiết riêng | Có Recovery use cases | Incident, assessment, project, task, relief | Recovery RBAC đã có | Recovery tests, không có test route này | PARTIAL |
| Disaster History | `/workspace/Lịch sử thiên tai` | Placeholder | Không có archive/history model | Không có historical query/import | Chưa nối Incident/Analytics | Chỉ permission `view` | Không | PLACEHOLDER |
| Trends | `/workspace/Xu hướng` | Placeholder | Không có time-series/trend model | Analytics hiện chỉ đọc snapshot/kỳ báo cáo | Có thể phụ thuộc Analytics/Incident/Simulation | Chỉ permission `view` | Không | PLACEHOLDER |
| User / Role / Scope Admin | `/admin/users` | User table/drawer, active, role, geographic scope | Auth types | Auth admin use cases | Session, permission matrix, audit | `user_manage` | Auth/authorization tests | DONE |
| Profile | `/profile` | Canonical identity/scope/session; avatar local theo stable user ID | Không cần domain mới | Dùng auth session hiện hữu | Header/session/local avatar adapter | Authenticated user | Không có unit test riêng; đã browser-check | DONE |
| System Configuration | `/workspace/Cấu hình` | Placeholder | Không có config domain | Không có use case | Chưa có dependency | Chỉ placeholder guard | Không | PLACEHOLDER |
| Canonical state / Mutation Boundary | Không có route | Không phải module UI | Operational entity contracts | Authorized view + atomic draft/commit/discard | Tất cả core modules | Resource-aware | Boundary, rollback, bypass tests | DONE |

## 2. Navigation inventory

| Menu item | Route thực tế | Page thật | Nghiệp vụ thật | Domain/Application | Tests | Kết luận |
|---|---|---:|---:|---:|---:|---|
| Trung tâm điều hành | `/` | Có | Có, nhưng quick actions/filter còn UI-only | Application queries | Có | PARTIAL |
| Tình hình thiên tai | `/workspace/Tình hình thiên tai` | Không | Không | Không | Không | PLACEHOLDER |
| Bản đồ tác nghiệp | `/workspace/Bản đồ tác nghiệp` | Có | Unified geospatial query thuần khôi phục đầy đủ layer counts, route lines, focus deep-link và drawer trong scope | MapLibre + authorized unified query, không dataset phụ | `view` + authorized view | DONE |
| Cảnh báo | `/workspace/Cảnh báo` | Không | Không; badge/popover tĩnh | Không | Không | PLACEHOLDER |
| Sự cố | `/incidents` | Có | Có | Có | Có | DONE |
| Kế hoạch ứng phó | `/playbooks` | Có | Có | Có | Có | DONE |
| Nhiệm vụ | `/tasks` | Có | Có | Có | Có | DONE |
| Đội cứu hộ | `/teams` | Có | Có | Có | Có | DONE |
| Sơ tán | `/workspace/Sơ tán` | Không | Có nhưng chỉ embedded trong Shelter detail | Có | Có | PARTIAL |
| SOS | `/sos` | Có | Có | Có | Có | DONE |
| Điểm sơ tán | `/shelters` | Có | Có | Có | Có | DONE |
| Kho vật tư | `/relief/warehouses` | Có | Có | Có | Có | DONE |
| Phân phối cứu trợ | `/relief` | Có | Có | Có | Có | DONE |
| Đánh giá thiệt hại | `/recovery` | Có | Có | Có | Có | DONE |
| Tái thiết | `/workspace/Tái thiết` | Không | Recovery Project có nghiệp vụ tương ứng một phần | Có Recovery layer | Có Recovery tests | PARTIAL |
| Báo cáo | `/analytics/reports` | Có | Có | Có | Có | DONE |
| Phân tích tác nghiệp | `/analytics` | Có | Có | Có | Có | DONE |
| Mô phỏng ứng phó | `/simulation` | Có | Có | Có | Có | DONE |
| Lịch sử thiên tai | `/workspace/Lịch sử thiên tai` | Không | Không | Không | Không | PLACEHOLDER |
| Xu hướng | `/workspace/Xu hướng` | Không | Không | Không | Không | PLACEHOLDER |
| Trợ lý AI | `/ai-assistant` | Có | Có | Có | Có | DONE |
| Người dùng | `/admin/users` | Có | Có | Có | Có | DONE |
| Phân quyền | `/admin/users` | Có, dùng chung User Admin | Có | Có | Có | DONE |
| Nhật ký hệ thống | `/admin/audit` | Có | Security audit thật; không phải observability/system log tổng quát | Có | Có | DONE |
| Cấu hình | `/workspace/Cấu hình` | Không | Không | Không | Không | PLACEHOLDER |

Các item không khai báo `path` đều đi qua `placeholderPath(label)` và render `PlaceholderPage`. Nút **“Xem định hướng module”** trong page này không có handler. Header notification và Command Center `ActionDialog` cũng chưa gọi canonical mutation.

## 3. Incomplete modules by priority

### P0 — cần để capability vận hành chính không còn đứt đoạn

#### Alerts / Operational Notifications — L

- **Route hiện tại:** `/workspace/Cảnh báo`; notification header chưa có route thật.
- **Đã có:** menu badge, notification popover, nút “Gửi cảnh báo”, Incident/Simulation data và audit infrastructure.
- **Thiếu:** Alert entity/lifecycle, target geography/audience, issue/acknowledge/expire use cases, authorized query, canonical persistence, list/detail UI, link từ notification popover và tests.
- **Chưa DONE vì:** toàn bộ trải nghiệm hiện là static/placeholder; “Tiếp tục” chỉ đóng dialog.
- **Dependencies:** Incident, Simulation, GIS, authenticated users/scopes, audit, mutation boundary.

#### Evacuation Operations workspace — M

- **Route hiện tại:** `/workspace/Sơ tán`.
- **Đã có:** canonical `EvacuationOperation/Event`, rules, use cases, Provider commands, Shelter detail workflow, Team/Incident integration và tests.
- **Thiếu:** list/worklist và detail route riêng để theo dõi toàn bộ hoạt động sơ tán; navigation hiện đi vào placeholder.
- **Chưa DONE vì:** capability nghiệp vụ có thật nhưng không thể truy cập như một module từ sidebar.
- **Dependencies:** Shelter, Team, Incident, SOS, authorized view.

### P1 — quan trọng nhưng có thể làm sau P0

#### Command Center operational actions — M

- **Route:** `/`.
- **Đã có:** canonical projections, action queue, maps, timeline, exception links.
- **Thiếu:** quick actions phải launch route/form thật hoặc canonical command; thời gian/kịch bản filters và “Làm mới” hiện chỉ presentation.
- **Chưa DONE vì:** một số control nhìn như thao tác vận hành nhưng không tạo kết quả nghiệp vụ.
- **Dependencies:** Incident, Task, Team, SOS và Alerts.

#### Unified Operational Map — M

- **Route:** `/workspace/Bản đồ tác nghiệp`.
- **Đã hoàn thành:**
  - Unified authorized geospatial query thuần (`src/application/map/unifiedMapQueries.ts`) cho 9 nhóm entity có tọa độ, không store/dataset GIS song song.
  - Page úa MapLibre canvas (GeoJSON sources + circle/symbol/line layers), layer panel với số lượng từng lớp và empty-state, entity search, severity filter, legend, zoom/fit toolbar và focus deep-link `?focus=`.
  - Click entity → drawer meta + điều hướng canonical detail page; Command Center map có nút "Mở bản đồ tác nghiệp".
  - RBAC kế thừa `createAuthorizedOperationalView`: commander/operator full, officer theo scope địa lý, rescue/warehouse theo nguồn lực sở hữu, citizen không có operational layers.
  - 12 focused tests (`tests/application/unified-operational-map.test.ts`) bao phủ query, filter, layer, RBAC, simulation propagation và no-leak.
- **Chưa bảo phủ (ngoài scope):** Damage Assessment có coordinates nhưng vẫn ngoài sáu lớp operational do task scope; không clustering vì hiện chưa cần; không mutation trên bản đồ.
- **Dependencies:** Incident, Team, Shelter, SOS, Relief, Recovery, Simulation.

#### Hazard Situation — L

- **Route:** `/workspace/Tình hình thiên tai`.
- **Đã có:** Command Center Situation Summary, Incident và deterministic Simulation.
- **Thiếu:** ranh giới rõ giữa observation/hazard feed và incident; query/page riêng; nguồn dữ liệu thật hoặc adapter contract minh bạch.
- **Chưa DONE vì:** không có model/use case/module page; không nên sao chép Incident hoặc giả realtime feed.
- **Dependencies:** Incident, Simulation, GIS, Alerts.

#### Reconstruction navigation — S

- **Route:** `/workspace/Tái thiết`.
- **Đã có:** Recovery Project lifecycle, budget, milestones và linked resources tại `/recovery/projects`.
- **Thiếu:** quyết định product rõ ràng: trỏ menu vào Recovery Projects hoặc tạo view chuyên biệt không duplicate state.
- **Chưa DONE vì:** menu hiện mở placeholder trong khi nghiệp vụ tương ứng đã tồn tại.
- **Dependencies:** Recovery Project, Damage Assessment, Task, Relief.

### P2 — supporting / nice-to-have

#### Disaster History — L

- **Route:** `/workspace/Lịch sử thiên tai`.
- **Đã có:** Incident timeline và current local scenario.
- **Thiếu:** archive/read model, historical period query/import và retention boundary.
- **Chưa DONE vì:** không có durable historical source; local current-state data không đủ để giả lập lịch sử.
- **Dependencies:** Incident, Analytics, backend persistence tương lai.

#### Trends — M

- **Route:** `/workspace/Xu hướng`.
- **Đã có:** Analytics snapshot và report-period filters.
- **Thiếu:** time-series source, trend calculations và comparison query.
- **Chưa DONE vì:** current snapshot không phải historical trend.
- **Dependencies:** Analytics, Incident và durable history.

#### System Configuration — M

- **Route:** `/workspace/Cấu hình`.
- **Đã có:** không có config contract; chỉ các constants kỹ thuật hiện hữu.
- **Thiếu:** xác định setting nào thực sự user-managed, validation, permission và adapter.
- **Chưa DONE vì:** page hoàn toàn placeholder; không nên biến constants thành fake settings.
- **Dependencies:** Authentication/Admin và backend configuration boundary tương lai.

### Recommended next module

**Alerts / Operational Notifications**

**Vì sao chọn:** đây là placeholder P0 rõ nhất: sidebar hiển thị badge `3`, header nói có ba cảnh báo và Command Center có nút “Gửi cảnh báo”, nhưng không có entity, lifecycle, route hay mutation thật. Khoảng trống này trực tiếp làm demo trông như workflow chưa hoàn tất và Alerting là capability cốt lõi của disaster management.

**Business value:** cho phép chỉ huy phát hành cảnh báo theo mức độ/phạm vi, theo dõi đối tượng nhận và xác nhận, liên kết cảnh báo với Incident hoặc Simulation threshold, đồng thời để lại audit/timeline có attribution.

**Dependencies:** dùng lại authenticated actor, geographic authorization, Incident, Simulation, GIS, security audit, authorized read model và `OperationalMutationBoundary`; không tạo store/context/repository hoặc permission system thứ hai.

**Scope implement đề xuất:** Alert lifecycle tối thiểu (`Nháp → Đã phát hành → Đã xác nhận/Đã hết hiệu lực`), severity, geography/audience, message, source/evidence, linked Incident/Simulation event, acknowledgement summary và deterministic demo records có liên kết hợp lệ.

**Expected routes:** `/alerts`, `/alerts/:id`; cập nhật sidebar/header notification/Command Center để điều hướng hoặc mở form thật thay cho placeholder.

**Expected changes:**

- **Domain:** Alert types, lifecycle/validation rules.
- **Application:** authorized list/detail queries; create/issue/acknowledge/expire use cases.
- **Canonical integration:** mở rộng snapshot/provider contract hiện hữu và publish command qua mutation boundary.
- **Presentation:** worklist, detail, create/issue confirmation; không redesign shell.
- **RBAC:** bổ sung permission Alert vào ma trận hiện hữu và resource-aware geographic checks.
- **Tests:** lifecycle, validation, geographic read/mutation authorization, rollback, Incident/Simulation reference integrity, audit attribution, header/Command Center integration.

Module inventory completed. Feature development should continue with Alerts / Operational Notifications.
