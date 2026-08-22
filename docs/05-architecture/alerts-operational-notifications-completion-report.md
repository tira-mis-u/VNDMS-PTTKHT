# Completed Alerts / Operational Notifications on the existing VNDMS architecture

Ngày hoàn tất: 21/08/2026. Feature implementation tăng dần trên kiến trúc hiện hữu; không rebuild, không redesign shell, không tạo state/store/context/event bus/permission matrix/GIS mới.

## 1. Files created

### Domain/application

- `src/domain/alerts/types.ts` — `OperationalAlert`, `DerivedAlert`, `AlertSeverity`, `AlertCategory`, `AlertCondition` (25 mã), `AlertStatus`, `AlertSourceRef`, `AlertInteraction`, `AlertEvent`, labels/tones/rank tiếng Việt.
- `src/domain/alerts/rules.ts` — pure derivation engine: `deriveOperationalAlerts`, `resolveAlertState(s)`, `markAlertRead`, `markAlertUnread`, `acknowledgeAlert`, `assertAlertCanAcknowledge`, `compareAlerts`.
- `src/application/alerts/alertQueries.ts` — `deriveAuthorizedAlerts` (Authorized Alert View), `alertAuthorizationResource`, `filterAndSortAlerts`, `summarizeAlerts`, `getAlertAnalytics`, `alertDetailPath`.
- `src/application/alerts/alertUseCases.ts` — `markAlertReadReceipt`, `acknowledgeOperationalAlert` (validation + AlertEvent attribution).

### Presentation

- `src/features/alerts/index.ts`
- `src/features/alerts/pages/AlertListPage.tsx` — `/alerts`
- `src/features/alerts/pages/AlertDetailPage.tsx` — `/alerts/:key`
- `src/features/alerts/components/AlertNotificationPopover.tsx` — chuông + popover header
- `src/features/command-center/components/OperationalAlerts.tsx` — panel “Cảnh báo tác nghiệp”
- `src/styles/alerts.css` — light/dark/responsive theo design system hiện hữu

### Tests/docs

- `tests/domain/alert-management.test.ts`
- `tests/application/alert-management.test.ts`
- `tests/integration/alert-cross-module.test.ts`
- `docs/03-use-cases/alerts-operational-notifications.md`
- `docs/04-domain-model/alerts-operational-notifications.md`
- `docs/05-architecture/alerts-operational-notifications.md`
- `docs/12-testing/alerts-operational-notifications.md`
- Báo cáo này.

## 2. Files modified

- `src/application/operations/operationalSnapshot.ts` — thêm 2 slice interaction: `alertInteractions`, `alertEvents`.
- `src/infrastructure/persistence/inMemoryOperationalRepository.ts` — seed hai slice rỗng (deterministic baseline).
- `src/application/authorization/authorizedOperationalView.ts` — pass-through hai slice interaction trong canonical read model.
- `src/state/operations/useAtomicOperationalState.ts` — `setAlertInteractions`, `setAlertEvents` (cùng cơ chế slice hiện hữu).
- `src/state/operations/OperationalStateContext.ts` — store contract: `alerts`, `alertEvents`, `alertInteractions`, 4 commands.
- `src/state/operations/OperationalContext.tsx` — commands atomic `markAlertRead`, `markAlertUnread`, `markAllAlertsRead`, `acknowledgeAlert`; value expose Authorized Alert View + events đã lọc theo key hiển thị.
- `src/lib/permissions/permissions.ts` — thêm `alert_view`, `alert_acknowledge` vào union + permission matrix hiện hữu (commander/operator/local_officer/rescue_leader/warehouse_staff: full; rescue_member/relief_worker: view; citizen: không).
- `src/app/routes/router.ts` — `alert-list`, `alert-detail`, label “Cảnh báo”.
- `src/app/App.tsx` — lazy pages, guard `alert_view`, render `/alerts`, `/alerts/:key`.
- `src/components/navigation/navigationConfig.ts` — mục “Cảnh báo” trỏ `/alerts`, bỏ badge tĩnh `3`.
- `src/components/layout/AppSidebar.tsx` — badge “Cảnh báo” = số chưa đọc thực.
- `src/components/layout/AppHeader.tsx` — popover thông báo thật (dữ liệu thay chữ “3 cảnh báo” tĩnh).
- `src/components/ui/index.tsx` — `SectionHeader` thêm `onAction` tùy chọn (backward compatible).
- `src/features/command-center/components/CommandCenter.tsx` — gắn panel cảnh báo.
- `src/domain/ai/types.ts` — intent `alert_overview`, entity type `OperationalAlert`/`Shipment`, request field `alerts?`.
- `src/domain/ai/rules.ts` — classifier map “cảnh báo/thông báo tác nghiệp” → `alert_overview`.
- `src/application/ai/aiGrounding.ts` — branch `alert_overview` (FACT + evidence, actions rỗng).
- `src/features/ai-assistant/pages/AiAssistantPage.tsx` — truyền `store.alerts`.
- `src/features/analytics/pages/OperationalAnalyticsPage.tsx` — section “Cảnh báo tác nghiệp” (aggregation + link `/alerts`).
- `src/main.tsx` — import `alerts.css`.

## 3. Domain model

Alert là **phái sinh thuần** từ canonical state: `<category>:<sourceType>:<sourceId>:<condition>`. 25 condition rules phủ 9 nhóm: Incident (3), SOS (3), Task (3), Team (2), Shelter (3), Evacuation (2), Relief/Warehouse/Shipment (5), Playbook (1), Recovery (4 gộp). Mọi rule tái sử dụng domain rules sẵn có (`isTaskOverdue`, `isSosWaitingTooLong`, `isEvacuationDelayed`, `calculateShelterCapacity`, `calculateFulfillment`, `isLowStock/isOutOfStock`, `isAssessmentVerificationOverdue`, `isBudgetRisk`…); đồng hồ dùng chung `demoCurrentTime`.

Trạng thái lưu trữ tối thiểu: read receipt theo `userId` + acknowledgement `{ userId, actor, at }` trong `alertInteractions`; `AlertEvent` cho ack. Snapshot slices này không duplicate operational record.

## 4. Application queries / use cases

- `deriveAuthorizedAlerts(user, authorizedView)` — yêu cầu `alert_view`; derive trên **view đã authorized** ⇒ alert của entity ngoài quyền không tồn tại; resolve status theo user (`Chưa đọc/Đã đọc/Đã xác nhận`).
- Filter/search (Unicode-không-dấu), severity/category/status/time-window; ordering severity→detectedAt.
- Summary + analytics (bySeverity/byCategory/unresolved/ack rate).
- Use case read (không audit, tương tác cá nhân) và ack (validation + event attribution), Provider chạy chúng trong `OperationalMutationBoundary` (atomic commit/rollback).

## 5. Alert derivation (baseline seed đã kiểm chứng)

21 alert cho tài khoản toàn quốc: 5 critical (TH-03 quá tải, INC-0241 khẩn cấp, SHP-0243 sự cố, REQ-0241 thiếu hàng P1, SOS-0242 P1 chưa điều phối), 11 high, 5 medium. Điều kiện hết đúng ⇒ alert hết hiệu lực; simulation tick 13 làm xuất hiện `shelter:TH-01:shelter_near_capacity`, tick 20 thu hồi alert INC-0241 sau khi được kiểm soát, reset khôi phục baseline — tất cả deterministic, không duplicate ở mọi tick.

## 6. Authorization

- Read: derive từ Authorized View + `alert_view` gate. Kết quả mẫu: local_officer thấy 8 (chỉ Tây Hồ), warehouse_staff thấy 1 (INV-0103 của KHO-01), rescue_member không thấy alert đội CH-04, citizen thấy 0.
- Mutation: silent `authorizeResources(readPermission, [alertResource])` (geography + ownership mirror entity nguồn) rồi `enforcePermission("alert_acknowledge", …)` có audit `MUTATION_AUTHORIZED`/`PERMISSION_DENIED`. Ack hỏng giữa chừng ⇒ rollback nguyên snapshot (không interaction/event sót lại).
- Không quảng bá client-side check là production security.

## 7. UI / routes

- `/alerts`: stat cards (21/21/5/5 cho commander tại baseline), toolbar search+4 filters, worklist severity, nút theo quyền, error inline khi command từ chối.
- `/alerts/:key`: hero, facts, timeline, “Mở nguồn”; not-found phân biệt xử lý-xong/ngoài-scope.
- Header: badge unread thật; popover top-6, đánh dấu đọc/tất cả, xác nhận, mở nguồn, “Xem tất cả”.
- Sidebar “Cảnh báo”: badge unread động.
- Dark mode + responsive 640/900px breakpoints; Lucide-only; không emoji.

## 8. Integrations

- **Command Center**: panel “Cảnh báo tác nghiệp” (chips nhóm + top 5) dùng `store.alerts` — không dataset riêng; SectionHeader action điều hướng `/alerts`.
- **AI**: intent `alert_overview` trả FACT + evidence (`OperationalAlert` + entity nguồn), `actions` rỗng — AI không tự xác nhận/resolve alert; officer chỉ nhận evidence trong scope.
- **Analytics**: section aggregation trên Authorized Alert View (Analytics không phải nguồn alert).
- **Simulation**: tick propagation vào canonical state ⇒ alert tự sinh/thu hồi; reset = repository baseline ⇒ interactions cũng reset.
- **User admin**: ma trận quyền mới tự hiển thị trong màn Users hiện hữu (đọc `permissionMatrix`).

## 9. Tests

227/227 pass (195 baseline + 32 mới), `test:focused` 34/34. Phủ: derivation, severity, deterministic key, dedup, stale removal, read/unread, ack, source navigation, đủ 9 nhóm, RBAC + geography + ownership + citizen denial, rollback, Command Center parity, AI grounding, Analytics aggregation, simulation tick/reset, router.

## 10. Quality gates

- `npm test`: **227/227 pass**.
- `npm run test:focused`: **34/34 pass**.
- `oxlint`: **0 warning, 0 error**.
- `tsc -b && vite build`: **pass** (còn 1 chunk-size warning MapLibre có sẵn từ trước).
- Route smoke (preview build): `/`, `/alerts`, `/alerts/:key`, `/incidents`, `/simulation`, `/ai-assistant` → **200**.
- Static scan: 1 `OperationalProvider`, 1 operational context, 1 permission matrix (Admin page chỉ đọc), 1 authorization engine, 0 event bus, 0 alert/notification store, 0 emoji UI, 0 legacy brand mention (branding normalization test pass).

## 11. Known limitations (không che giấy)

- Read receipt/acknowledgement chỉ sống trong state phiên — refresh trang mất; không có persistence server (nhất quán với toàn bộ local demo; không diễn tả là production).
- `alertEvents` chỉ ghi ack; read không tạo timeline/audit (tránh nhiễu).
- Quick action “Gửi cảnh báo” (broadcast kênh ngoài) thuộc backlog Command Center (inventory: PARTIAL) — không thuộc phạm vi phái sinh alert này.
- Không realtime/push/email/SMS/WebSocket/worker — đúng ràng buộc local deterministic demo.
