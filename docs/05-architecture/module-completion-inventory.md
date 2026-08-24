# VNDMS — Module Completion Inventory

Cập nhật sau Phase 4 Dependency Completion, Product Hardening & Map Label Precision ngày 24/08/2026. Nguồn chi tiết: [`master-capability-matrix.md`](./master-capability-matrix.md). Inventory chỉ ghi `DONE` cho phạm vi có canonical data, query/mutation phù hợp, RBAC, provenance, UI, responsive, accessibility, browser evidence và test đạt.

| Module | Route | Canonical contract | RBAC | Browser/Test | Status |
|---|---|---|---|---|---|
| Authentication / Session | `/login`, `/profile` | Auth user/session + registry | Session/role | Full tests + route/interaction matrix | DONE |
| Authorization / Security Audit | Toàn app, `/admin/audit` | Authorized view + SecurityAuditEvent | Resource/geography/ownership | 150 RBAC checks + security tests | DONE |
| Command Center | `/`, `/command` | Authorized operational projections | `view` + command permission | Route/interaction/application tests | DONE |
| Hazard Operational Situation | `/workspace/Tình hình thiên tai` | Composition từ authorized snapshot | `view` | Insights tests + 12-mode matrix | DONE |
| Unified Operational Map | `/workspace/Bản đồ tác nghiệp` | Authorized map projection + two verified Point anchors | Entity permissions | 18 runtime label checks + product screenshots + route/drawer matrix | DONE — phạm vi Point-label |
| Alerts / Notifications | `/alerts`, `/alerts/:key` | Derived alert + interaction/event | Alert + source permission | Domain/application/integration/browser | DONE |
| Incident | `/incidents`, `/incidents/:id` | Incident + event | Geographic/resource RBAC | Domain/application/integration/browser | DONE |
| Playbooks / SOP | `/playbooks`, detail/execution | Playbook + execution/event | Playbook RBAC | Domain/application/integration/browser | DONE |
| Task / Dispatch | `/tasks`, `/tasks/:id` | Task + updates | Task/ownership RBAC | Domain/application/integration/browser | DONE |
| Rescue Team | `/teams`, `/teams/:id` | Team/member/event | Team ownership | Domain/application/integration/browser | DONE |
| Evacuation Operations | `/evacuations`, `/evacuations/:id` | Evacuation operation/event | Geographic/ownership | Domain/application/integration/browser | DONE |
| SOS | `/sos`, `/sos/:id` | SOS + events | SOS/geographic/ownership | Domain/application/integration/browser | DONE |
| Shelter | `/shelters`, `/shelters/:id` | Shelter + events | Shelter/geographic | Domain/application/integration/browser | DONE |
| Warehouse / Inventory | `/relief/warehouses`, detail | Warehouse + inventory | Warehouse ownership | Relief/authorization/browser | DONE |
| Relief / Distribution | `/relief`, request detail | Request/reservation/shipment/event | Geographic/warehouse | Domain/application/integration/browser | DONE |
| Damage Assessment | `/recovery`, assessment detail | Assessment/items/evidence | Assessment RBAC | Recovery tests/browser | DONE |
| Recovery Project / Reconstruction | `/workspace/Tái thiết`, project detail | RecoveryProject canonical alias | Recovery RBAC | Recovery + alias + browser | DONE |
| Operational Analytics | `/analytics/*` | Authorized snapshot + metadata | `view` | Analytics tests + 12-mode matrix | DONE |
| Operational Reports | `/analytics/reports` | ReportActor + snapshot `asOf` + source | `view` | Report tests/product/browser | DONE |
| Deterministic Simulation | `/simulation` | Simulation state + canonical effects | Simulation permissions | Engine/integration/browser | DONE |
| Current Operational Incident History | `/workspace/Lịch sử thiên tai` | Closed Incident + IncidentEvent | `view` | Insights tests + browser states | DONE |
| Canonical Operational Trends | `/workspace/Xu hướng` | Timestamped source records | `view` | Insights tests + populated/insufficient browser | DONE |
| Grounded Assistant | `/ai-assistant` | Authorized snapshot + evidence/actions | Assistant + action re-check | AI tests + conversation browser | DONE |
| User Administration | `/admin/users` | Auth users/role/scope | `user_manage` | Auth/admin/browser | DONE |
| Permission Administration Alias | `/workspace/Phân quyền` | Same User Administration + existing matrix | `user_manage` | Alias tests + 6-role browser matrix | DONE |
| Authoritative Hoàng Sa/Trường Sa GIS Geometry | Chưa tích hợp | Chưa tải được geometry có thẩm quyền; Point hiện hữu không phải centroid/shape | Không áp dụng | Point-only limitation + provenance audit | BLOCKED — thiếu dữ liệu GIS có thẩm quyền |
| System Configuration | `/workspace/Cấu hình` | Chưa có schema/persistence/version/audit contract | Route dùng `user_manage` | Honest blocked state verified | BLOCKED — thiếu backend/persistence và product contract |
| Hazard Observation / Forecast | Chưa có | Không có source thật | Chưa định nghĩa | No-fake-data audit | BLOCKED — thiếu dữ liệu và product contract |
| Long-term Disaster Archive | Chưa có | Không có archive/import/retention | Chưa định nghĩa | Limited-scope history verified | BLOCKED — thiếu backend/persistence |
| Long-term Trend Forecast | Chưa có | Không có longitudinal/forecast source | Chưa định nghĩa | Insufficient state verified | BLOCKED — thiếu dữ liệu |
| Report Issuance / Approval | Chưa có workflow | Không có numbering/signature/approval state | Chưa định nghĩa | “Chưa cấp số · Chưa phê duyệt” verified | BLOCKED — thiếu product contract |

## Acceptance summary

- Sidebar: 25/25 items có route rõ ràng; 0 navigation placeholder.
- Route matrix Phase 4: 26 routes × 6 viewport × 2 theme = 312 checks, 0 failure.
- Detail/overlay Phase 4: 72 detail + 34 interaction checks trên desktop/tablet/mobile, light/dark; 0 failure.
- Focused interaction product states: 32/32; direct route/menu RBAC: 150/150.
- Map precision: 18/18 runtime symbol checks (2 địa danh × 3 zoom × 3 viewport), 3/3 product workspace checks; 0 HTML Marker thay thế.
- Axe serious/critical: 0 trong route, detail và interaction evidence.
- Full tests: 297/297; focused tests: 53/53.
- Static architecture/UI/language/typography/personnel/form/native-select/fake-data/map/provenance: đạt.
- TypeScript, lint `--deny-warnings`, build và `git diff --check`: đạt.

Các capability `BLOCKED` không được thay bằng dữ liệu, workflow, geometry hoặc persistence giả. Hai Point hiện hữu chỉ là Đảo Hoàng Sa và Đảo Trường Sa theo nguồn; inventory không tuyên bố đã vẽ chính xác hình dạng quần đảo.
