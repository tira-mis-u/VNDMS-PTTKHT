# VNDMS — Command Center Operational Actions: Completion Report

Ngày hoàn thành: 22/08/2026 · Phạm vi: Command Center (`/`) — biến 5 quick actions từ ActionDialog giả thành workflow nghiệp vụ thật theo `module-completion-inventory.md` (hạng mục P1 "Command Center operational actions").

## 1. Tóm tắt

Trước thay đổi, 5 nút "Thao tác nhanh" mở một dialog stub: textarea không lưu, "Tiếp tục" chỉ đóng dialog, không mutation nào xảy ra. CTA trong DetailDrawer ("Quản lý sự cố" / "Mở phương án điều phối") cũng mở dialog tương tự.

Thay đổi này triển khai toàn bộ 5 quick action thành thao tác thật trên canonical contracts hiện hữu: mỗi action là một **command-center action plan** ở application layer (validate + tóm tắt tác động + yêu cầu confirmation) rồi **execute qua store command** — tức là đi đúng đường `Presentation → plan → store command → enforcePermission + lifecycle re-check → atomic commit → audit/timeline` của `OperationalMutationBoundary`. Không tạo Context/Store/EventBus/permission matrix/audit store/entity/state song song nào mới; không refactor module ngoài Command Center và application layer của nó.

## 2. Actions đã triển khai

| Quick action | Workflow thật | Canonical command reused | Permission boundary |
|---|---|---|---|
| **Tạo sự cố** | Form tiếp nhận sự cố (tên/loại/mức/khu vực/mô tả) → success screen → mở detail | `createIncident(CreateIncidentInput)` → id `INC-xxxx` mới + event "created" | `create` với resource `{Incident, geographicScope = khu vực nhập}` |
| **Giao nhiệm vụ** | Chọn sự cố đang mở → nội dung/loại/ưu tiên/đội (tùy chọn)/hạn → success → mở `/tasks/:id` | `createTask(NewTaskInput)` — assign đội ngay khi chọn (atomic trong command) | `task_create` trên incidentResource + teamResource |
| **Gửi cảnh báo** | Chọn cảnh báo đang chờ xác nhận (derived) → xác nhận đã tiếp nhận; **empty state trung thực** khi không có | `acknowledgeAlert(key)` — ghi AlertEvent có attribution | `alert_acknowledge` (resource-aware, geographic scope của alert) |
| **Điều phối đội** | 2 hành động: (a) **Điều đội tới sự cố** — chọn sự cố mở + đội sẵn sàng; (b) **Thu hồi đội khỏi nhiệm vụ** — chỉ các đội có task ở lifecycle cho phép (`canReleaseTaskAssignment`) | `dispatchTeam(incidentId, teamId)`; `releaseTeamFromTask(teamId)` (đồng bộ team↔task hai phía) | `dispatch` trên incident+team resources; `team_assign` trên task+team resources |
| **Xử lý SOS** | Chọn SOS cần xử lý → hành động: Hoàn tất xác minh / Điều chỉnh ưu tiên / Điều đội cứu hộ (chỉ SOS đã xác minh) / Từ chối không hợp lệ | `verifySos`, `retriageSos` (qua `updateSosPriority`), `createRescueTaskFromSos`, `rejectSos` | `sos_verify`, `sos_triage`, `sos_dispatch` (+`assertSosScope` trong command) |

Hỗ trợ thêm tại application layer (không phải capability mới):

- `commandCenterActions.ts`: candidate selectors (`openIncidents`, `triageableSos`, `acknowledgeableAlerts`, `dispatchableTeams`, `recallableTeams`), plan builders (`buildCreateIncidentPlan`, `buildCreateTaskPlan`, `buildAcknowledgeAlertPlan`, `buildDispatchTeamPlan`, `buildRecallTeamPlan`, `buildSosTriagePlan`) và `executeCommandCenterAction` — router plan → store command, trả `entityPath` để điều hướng sau thành công.
- `taskUseCases.ts`: export predicate `canReleaseTaskAssignment` (trước đây nằm inline trong `releaseTaskAssignment`) — giờ là nguồn dùng chung cho selector/plan/boundary; domain message không đổi.

## 3. Hành vi đảm bảo theo spec

- **Confirmation bắt buộc**: mọi builder trả lỗi "Thao tác chưa được xác nhận" khi `confirmed: false`; UI chỉ gọi execute từ nút "Xác nhận và …".
- **Dialog hiển thị đủ**: đối tượng (select + panel "Trạng thái hiện tại"), hành động, resources bị ảnh hưởng (summary lines của plan), actor (`displayName + roleLabels`), phạm vi tài khoản + phạm vi địa bàn (`ActionMeta`), lệnh canonical sẽ chạy qua mutation boundary, validation/permission note/lỗi inline trước khi commit.
- **Re-check tại boundary**: mọi execute gọi store command → `enforcePermission(permission, resources, sensitiveOperation)` + `assertTeamDispatchable`/`assertSosScope`/lifecycle guards trong use cases chạy lại trên state mới nhất; UI validation chỉ là lớp đầu.
- **Audit/timeline**: command hiện hữu tự ghi `SecurityAuditEvent` (MUTATION_AUTHORIZED/PERMISSION_DENIED) + event timeline (IncidentEvent/SosEvent/TaskEvent/AlertEvent) — không audit store mới.
- **Rollback atomic + không mất state**: execute bọc trong `atomic(command)` của provider; lỗi throw → draft discard; dialog bắt exception hiển thị inline, canonical snapshot nguyên vẹn (có test deep-equal).
- **Projection tự cập nhật**: queue/timeline/situation/map/alerts đọc canonical — sau mutation chúng refresh tự nhiên (được chứng minh bằng test: situation summary đổi, pending-ack giảm, đội hết/thành sẵn sàng, SOS đổi ưu tiên trong queue).
- **Empty/disabled trung thực**: không đội sẵn sàng (đặc thù seed: tất cả đang bận) → hướng dẫn thu hồi; không SOS/alert/incident phù hợp → EmptyState; nút confirm disable kèm `title` khi thiếu quyền.
- **Drawer CTA**: "Quản lý sự cố"/"Mở phương án điều phối" chuyển từ dialog giả sang điều hướng trang canonical (`/incidents/:id`, `/relief/warehouses/:id`, `/teams/:id`, `/shelters/:id`, `/sos/:id`); "Xử lý SOS" mở dialog triage có preselect đúng SOS từ drawer.

## 4. Files tạo/chỉnh

**Tạo mới**
- `src/application/command-center/commandCenterActions.ts` — action plans + selectors + executor (không import state/infrastructure, test bảo vệ bằng source scan).
- `tests/application/command-center-actions.test.ts` — 16 test (xem mục 6).

**Chỉnh sửa**
- `src/features/command-center/components/ActionDialog.tsx` — viết lại hoàn toàn: 5 workflow + ActionMeta + OutcomeView + Escape/backdrop close + inline error/success.
- `src/features/command-center/components/CommandCenter.tsx` — `handleDrawerAction` (navigate canonical thay dialog giả), truyền `navigate`/`presetSosId` xuống ActionDialog.
- `src/application/tasks/taskUseCases.ts` — export `canReleaseTaskAssignment` (predicate dùng chung).
- `src/styles/command-center.css` — styles meta/context/outcome/permission note (+ dark mode + responsive 640px).
- `tests/README.md` — bổ sung mô tả suite mới.

## 5. UX

- Design system hiện hữu: `incident-form-dialog` chrome, `field`/`form-hint`/`team-form-error`, `Badge`, `Button`, `EmptyState`; icon Lucide (không emoji).
- Dialog semantics: `role="dialog"` `aria-modal`, `aria-labelledby`, backdrop button `aria-label`, Escape đóng, autoFocus trường đầu, inline error `role="alert"`, read-only note `role="note"`.
- Responsive + dark mode cho toàn bộ khối mới.

## 6. Tests

16 test trong `tests/application/command-center-actions.test.ts`:

1. Selectors đọc authorized view (seed: 0 đội sẵn sàng, 1 đội thu hồi được, 4 incident mở, 5 alert chờ ack, SOS xếp ưu tiên).
2. Confirmation bắt buộc — cả 6 builder.
3. Happy path + validation Tạo sự cố (thiếu tiêu đề/khu vực chặn trước commit).
4. Happy path + validation Giao nhiệm vụ (sự cố đóng/đội ngoài phạm vi).
5. Gửi cảnh báo: chỉ key đang chờ; key lạ/alerts rỗng.
6. Điều phối đội: đội bận bị chặn; thu hồi CH-03 đúng lifecycle (CH-01 bị từ chối do TSK-0241 đang thực hiện) → dispatchable → plan dispatch hợp lệ.
7. SOS triage: verify plan; verify lại bị chặn; rescue SOS chưa xác minh bị chặn; triage trùng mức bị chặn; triage hợp lệ.
8. Commander được phép toàn bộ (cùng resource context provider dùng); citizen bị từ chối.
9. Geographic/ownership denial: warehouse staff không dispatch; rescue_member không ack; local officer không verify SOS ngoài Tây Hồ.
10. Tạo sự cố qua `OperationalMutationBoundary` harness — commit 1 lần, projection Situation Summary thay đổi.
11. Atomic rollback: lỗi giữa chuỗi mutation → `deepEqual(state, before)`, 0 commit.
12. Thu hồi → dispatch lưu thông: đội sẵn sàng xuất hiện/biến mất trong projection theo từng commit; task về "Chờ giao"; incident nhận đội + đổi trạng thái.
13. SOS qua boundary: verify → re-check lifecycle chặn lần 2; retriage → queue phản ánh mức mới.
14. Ack alert qua boundary: status "Đã xác nhận" có attribution, alert rờii danh sách chờ — canonical derivation tự cập nhật (không tạo alert riêng).
15. Simulation compatibility: sau khi tạo sự cố mới, `applyNextSimulationTick` vẫn deterministic, entity mới tồn tại sau tick.
16. Static architecture: action layer không import `state/`/`infrastructure/`, không context/store/repository bypass trong dialog.

## 7. Quality gates (cuối)

| Gate | Kết quả |
|---|---|
| `npm test` | **261/261 pass** (245 + 16 mới) |
| `npm run test:focused` | **34/34 pass** |
| `oxlint` | 0 warnings / 0 errors |
| `tsc -b` + `vite build` | Pass (chỉ warning chunk-size MapLibre + dynamic-import đã tồn tại trước) |
| SSR smoke (renderToString) | 7 trường hợp: 5 dialog + empty-all + preset SOS |
| Route smoke (dev server 4174) | 200: `/`, `/alerts`, `/sos/SOS-0243`, `/incidents/INC-0241`, `/tasks/TSK-0243`, `/teams/CH-03` |
| Static bypass scan | Không `createContext`/store/event bus/repository/localStorage trong action layer + dialog |

## 8. Limitations còn lại (không che giấu)

- **"Gửi cảnh báo" là xác nhận tiếp nhận, không phải broadcast**: kiến trúc Alerts là derive-only — không có outbound notification channel (email/SMS/push), hành động này thực hiện đúng mutation alert duy nhất hiện có (`acknowledgeAlert`). Dialog ghi rõ trong empty state; đổi nhãn nút là quyết định product ngoài scope.
- **Không có đội sẵn sàng trong seed**: chế độ "Điều đội tới sự cố" rỗng cho tới khi thu hồi CH-03 (hoặc simulation/nghiệp vụ khác giải phóng đội) — đây là trạng thái demo thật, không phải lỗi; dialog giải thích và empty state trung thực.
- **Thu hồi chỉ cho task "Chờ giao"/"Đã giao"**: theo đúng domain guard — task đang thực hiện phải đi qua luồng Nhiệm vụ (cập nhật/đóng), không bypass từ Command Center.
- **Plan layer không thay thế boundary**: lỗi quyền/geo qua plan chỉ là UX hint; quyết định cuối vẫn ở `enforcePermission` trong command — hợp đồng này được giữ nguyên và test bao phủ cả hai lớp.
- Form "Tạo sự cố" dùng tọa độ mặc định khu vực Hà Nội giống dialog tại module Sự cố (không thêm geocoding).

## 9. CỐ Ý KHÔNG xử lý (ngoài scope)

- **Unified Operational Map** (`/workspace/Bản đồ tác nghiệp`) — P1 riêng, có GIS surface riêng.
- **Hazard Situation** (`/workspace/Tình hình thiên tai`) — PLACEHOLDER, cần hazard model ngoài scope.
- **Reconstruction nav** (`/workspace/Tái thiết`), **Disaster History**, **Trends**, **System Configuration** — P2/PLACEHOLDER.
- Header time-window filter ("24 giờ gần nhất") và kịch-bản filter trong Command Center header — presentation-only, thuộc hạng "Command Center filters" chưa được lên lịch.
- Quick action callbacks từ ActionQueue/PlaybookOperations/RecoveryExceptions nhiều nhãn riêng — các nhãn đó đã điều hướng trang canonical từ trước, không đổi.
- Production backend, realtime, CI/CD, observability, LLM/RAG, database — theo ràng buộc demo local deterministic.

Module inventory cập nhật: **Command Center (operational actions) = DONE**. Nguyên trạng các module P1/P2 khác giữ nguyên.
