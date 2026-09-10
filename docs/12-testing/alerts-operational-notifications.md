# Testing — Alerts / Operational Notifications

Ba file test mới (32 case), chạy cùng suite `npm test`:

## `tests/domain/alert-management.test.ts`

- Derivation baseline deterministic từ seed canonical: đủ 21 alert, đúng key mẫu cho cả 9 nhóm, không key trùng.
- Derive hai lần deep-equal (ổn định).
- Alert chỉ reference entity (type/id/path/readPermission), không copy dữ liệu.
- Severity mapping + `requiresAcknowledgement` (5 critical đều yêu cầu xác nhận).
- Sắp xếp severity → thởi điểm ghi nhận.
- Stale removal: gán đội cho SOS-0242, sửa sức chứa TH-03, hoàn thành TSK-0242, kiểm soát INC-0241 ⇒ alert tương ứng biến mất (kể cả alert phụ thuộc crisis như CN-01).
- Lifecycle interaction: chưa đọc → đã đọc → đã xác nhận; receipt theo user; markUnread giữ ack, dọn interaction rỗng; `markAlertRead` idempotent.
- Quy tắc ack: từ chối khi không yêu cầu hoặc đã xác nhận.

## `tests/application/alert-management.test.ts`

- Authorized Alert View theo 4 vai trên seed Yagi: `admin`/`disaster_officer`/`rescue_unit` (national) thấy 25 alert (critical 8 / high 14 / medium 3); `citizen` và null user ⇒ rỗng; `citizen` không có `alert_view`/`alert_acknowledge`; `admin` không có `alert_acknowledge`.
- `alertAuthorizationResource` mirror geography của entity nguồn.
- Read/ack qua authorize boundary: chỉ 8 alert critical yêu cầu ack; ack alert không yêu cầu bị từ chối.
- Use case read receipt + ack với event attribution; ack lần hai báo lỗi.
- Filters: severity/category/status/search Unicode-không-dấu/cửa sổ thởi gian.
- `summarizeAlerts`, `getAlertAnalytics` (pending ack 5; ack rate 0 → 20% sau 1/5 ack).
- `alertDetailPath` encode an toàn.

## `tests/integration/alert-cross-module.test.ts`

- Pipeline đầy đủ: repository → authorized view → derive; ack commit đúng 1 lần kèm AlertEvent attribution; xử lý entity nguồn ⇒ alert hết hiệu lực dù interaction còn trong snapshot.
- Rollback: command throw sau khi ghi interactions/events ⇒ draft bị hủy nguyên trạng (mutation boundary).
- Deny tại boundary: `admin` thiếu `alert_acknowledge`; `citizen` không có quyền đọc; `disaster_officer`/`rescue_unit` ack thành công. Không ghi gì khi bị từ chối.
- Command Center parity: cùng phép derive ⇒ cùng collection (không dataset riêng).
- Analytics: ack rate đổi theo canonical mutation.
- Router: `/alerts`, `/alerts/:key` (decode key), label “Cảnh báo”.

## Chạy

```bash
npm test           # 227 case (195 cũ + 32 mới) — pass
npm run test:focused
```
