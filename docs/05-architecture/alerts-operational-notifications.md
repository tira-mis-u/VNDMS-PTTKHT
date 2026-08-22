# Architecture — Alerts / Operational Notifications

## Luồng dữ liệu

```
Canonical Operational State (OperationalProvider — state owner duy nhất)
  → createAuthorizedOperationalView(user, snapshot)      [canonical read model]
  → deriveAuthorizedAlerts(user, view)                   [Authorized Alert View]
       = deriveOperationalAlerts(view)  (domain, pure, deterministic)
       + resolveAlertsForUser(derived, alertInteractions, user.id)
  → Presentation: Header popover, /alerts, /alerts/:key, Command Center panel,
    Analytics section, AI (alert_overview)
```

Mutation (đánh dấu đọc / xác nhận):

```
Presentation
  → Provider command (atomic via OperationalMutationBoundary)
  → re-derive từ full canonical snapshot (draft khi đang trong boundary)
  → authorizeResources(user, alert.readPermission, [alertResource])   [silent]
  → enforcePermission("alert_acknowledge", [alertResource])           [audited]
  → domain/application use case → commit 1 lần (interaction + AlertEvent)
  → rollback nguyên trạng nếu command throw giữa chừng
  → Security audit MUTATION_AUTHORIZED / PERMISSION_DENIED cho ack
```

Lỗi tra cứu sớm: alert key không còn trong derivation ⇒ throw “Cảnh báo không tồn tại hoặc điều kiện tạo cảnh báo đã được xử lý” (chống ack/read alert đã stale).

## Thành phần

| Layer | File | Vai trò |
|---|---|---|
| Domain | `src/domain/alerts/types.ts`, `rules.ts` | Types, 25 condition rules, interaction state rules |
| Application | `src/application/alerts/alertQueries.ts`, `alertUseCases.ts` | Authorized view, filters/summary/analytics, read/ack use cases |
| Canonical | `operationalSnapshot.ts` (+2 slice), repository seed rỗng, `authorizedOperationalView.ts` pass-through | Interaction state tối thiểu trong snapshot hiện hữu |
| State | `OperationalContext.tsx`, `OperationalStateContext.ts`, `useAtomicOperationalState.ts` | Commands `markAlertRead/Unread`, `markAllAlertsRead`, `acknowledgeAlert`; value `alerts`, `alertEvents` (đã lọc theo alert hiển thị) |
| RBAC | `src/lib/permissions/permissions.ts` | Thêm `alert_view`, `alert_acknowledge` vào **matrix hiện hữu** |
| Presentation | `src/features/alerts/` (pages + popover), `AppHeader`, `AppSidebar`, `navigationConfig`, `router.ts`, `App.tsx` | Badge động, popover, `/alerts`, `/alerts/:key` |
| Tích hợp | `command-center/components/OperationalAlerts.tsx`, `ai/aiGrounding.ts` (+ `alert_overview`), `analytics/pages/OperationalAnalyticsPage.tsx` | Panel CC, intent AI, section Analytics |

## Quyết định kiến trúc

1. **Derive, không materialize.** Alert không phải bản ghi; mọi “database alert tĩnh” sẽ vi phạm no-duplicate. Interaction state nhỏ (`alertInteractions`, `alertEvents`) là cách duy nhất lưu read/ack — nằm trong snapshot canonical nên được reset deterministic cùng simulation và không cần persistence mới.
2. **Derive từ view đã authorized.** Không có “alert query rồi filter” — alert của entity vô hình thì không tồn tại. Không có bypass qua đường query riêng.
3. **Defense-in-depth lúc mutation.** Alert mirror `readPermission` + geographic/ownership của entity nguồn thành `AuthorizationResource`; ack đi qua `enforcePermission` (audit), read đi qua `authorizeResources` (không audit — đây là tương tác cá nhân).
4. **Không NotificationContext/Store/EventBus/permission matrix thứ hai.** Mọi thứ đi qua provider + boundary + matrix hiện có.
5. **Không kênh ngoài.** Không email/SMS/push/WebSocket/worker — local deterministic demo.

## UI

- Header: chuông + badge số **chưa đọc** thật; popover `role="dialog"` (đọc nhanh, đánh dấu đọc, xác nhận, mở nguồn, mở trung tâm).
- `/alerts`: 4 stat card (đang hiệu lực / chưa đọc / khẩn cấp / chờ xác nhận), toolbar search + 4 filter, result bar, worklist severity-line; nút theo quyền (`store.can` chỉ là hint UI — enforcement ở boundary).
- `/alerts/:key`: hero theo severity, facts dl, timeline AlertEvent, CTA mở entity nguồn; trạng thái không tìm thấy phân biệt “đã xử lý / ngoài phạm vi”.
- Command Center “Cảnh báo tác nghiệp”: chips theo nhóm + top 5, đọc `store.alerts`.
- Sidebar badge “Cảnh báo” = unread thực; header text “3 cảnh báo” tĩnh đã bị thay bằng dữ liệu thật.
- Dark mode + responsive theo pattern `html[data-theme="dark"]` hiện hữu; icon chỉ Lucide.

## Giới hạn đã biết (không che giấu)

- Interaction state chỉ tồn tại trong bộ nhớ phiên làm việc (refresh trang mất read/ack) — nhất quán với repository in-memory của toàn bộ demo; không được diễn tả như persistence production.
- Authorization enforcement là client-side deterministic local demo; không phải server-side security.
- Quick action “Gửi cảnh báo” trong Command Center thuộc phạm vi Command Center (broadcast alert qua kênh ngoài) — không nằm trong phái sinh alert hiện tại; dialog workflow còn lại theo inventory module Command Center (PARTIAL).
