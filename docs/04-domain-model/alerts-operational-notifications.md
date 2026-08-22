# Domain Model — Alerts / Operational Notifications

Module `src/domain/alerts/` — framework-independent, pure functions.

## 1. Types

```ts
AlertSeverity   = "critical" | "high" | "medium" | "low"
AlertCategory   = "incident" | "sos" | "task" | "team" | "shelter"
                | "evacuation" | "relief" | "playbook" | "recovery"
AlertStatus     = "Chưa đọc" | "Đã đọc" | "Đã xác nhận"
AlertCondition  = <25 mã điều kiện nghiệp vụ>  // vd "sos_p1_verified_unassigned"
```

### `DerivedAlert`

Cảnh báo thuần suy ra từ canonical state; không sao chép entity nguồn.

| Field | Ý nghĩa |
|---|---|
| `key` | Deterministic: `<category>:<sourceType>:<sourceId>:<condition>` — khử trùng lặp tự nhiên |
| `category` / `condition` | Phân loại hiển thị + mã điều kiện máy |
| `severity` | `critical` ⇒ `requiresAcknowledgement = true` |
| `title` / `message` | Nội dung tiếng Việt có ngữ cảnh nghiệp vụ |
| `source` | `{ type, id, code, path, label }` — reference + route canonical, không copy dữ liệu entity |
| `readPermission` | Quyền đọc của entity nguồn trong permission matrix hiện hữu (`sos_view`, `warehouse_view`…) |
| `geographicScope`, `ownerTeamId`, `ownerWarehouseId` | Mirror thuộc tính authorization của entity nguồn cho defense-in-depth lúc mutation |
| `detectedAt` | Mốc thởi gian nghiệp vụ deterministic (dueAt, updatedAt, receivedAt…) |

### `OperationalAlert`

`DerivedAlert` + trạng thái theo ngườii dùng: `status`, `readAt`, `acknowledgedAt`, `acknowledgedBy`.

### Trạng thái lưu trữ trong canonical snapshot (tối thiểu)

```ts
AlertInteraction { alertKey, readBy: { userId, readAt }[], acknowledgement: { userId, actor, at } | null }
AlertEvent       { id, alertKey, type: "acknowledged", message, actor, timestamp, source }
```

`OperationalSnapshot` được mở rộng thêm hai slice **interaction**: `alertInteractions`, `alertEvents` (seed rỗng). Đây không phải operational record trùng lặp — chỉ là trạng thái tương tác gắn với alert key; entity nguồn vẫn là nguồn sự thật duy nhất.

## 2. Rules (`rules.ts`)

- `deriveOperationalAlerts(input)` — pure; nhận structural subset của `OperationalSnapshot`; quét 9 nhóm điều kiện; khử trùng theo key; sort severity→detectedAt→key (`compareAlerts`). Khi điều kiện hết đúng, alert không còn trong kết quả.
- `resolveAlertState` / `resolveAlertsForUser` — ghép interaction vào theo `userId` ⇒ `OperationalAlert`.
- `markAlertRead` / `markAlertUnread` / `acknowledgeAlert` — biến đổi `AlertInteraction[]` thuần (idempotent, không duplicate receipt; markUnread dọn interaction rỗng nhưng giữ acknowledgement).
- `assertAlertCanAcknowledge` — chỉ cho phép khi `requiresAcknowledgement` và chưa xác nhận.
- Đồng hồ: dùng lại `demoCurrentTime` (21/08/2026 10:45) và `parseVietnameseDate` của module tasks — không có đồng hồ riêng.
- Tái sử dụng domain rules hiện hữu, không viết lại: `isTaskOverdue`, `taskPriorityRank`, `isSosWaitingTooLong`, `isEvacuationDelayed`, `calculateShelterCapacity`, `isLowStock`, `isOutOfStock`, `availableQuantity`, `calculateFulfillment`, `isAssessmentVerificationOverdue`, `isBudgetRisk`, `isOperationalDateBefore`.

## 3. Application contracts

- `application/alerts/alertQueries.ts`
  - `deriveAuthorizedAlerts(user, authorizedView)` — Authorized Alert View: yêu cầu `alert_view`, derive từ view đã lọc quyền, resolve theo user.
  - `alertAuthorizationResource(alert)` — resource cho `authorizeResources`/`enforcePermission`.
  - `filterAndSortAlerts`, `summarizeAlerts`, `getAlertAnalytics`, `alertDetailPath`.
- `application/alerts/alertUseCases.ts`
  - `markAlertReadReceipt(interactions, key, userId, at)`
  - `acknowledgeOperationalAlert(interactions, alert, actor, at)` → `{ interactions, event }` (validation + attribution).

## 4. Invariants

1. Cùng input ⇒ cùng output (deterministic, test bằng deepEqual hai lần derive).
2. Không bao giờ có 2 alert cùng key trong một lần derive.
3. Alert không tồn tại khi điều kiện sai — không có “alert stale”.
4. Interaction không làm alert biến mất; chỉ đổi status hiển thị. Ack alert mà điều kiện đã qua ⇒ không còn cơ hội ack (alert biến mất khỏi view; command báo “không tồn tại hoặc điều kiện đã được xử lý”).
5. Severity `critical` luôn kèm `requiresAcknowledgement`; các mức còn lại không.
