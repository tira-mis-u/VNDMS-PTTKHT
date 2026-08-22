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

- Authorized Alert View theo role: commander 21; local_officer chỉ Tây Hồ (không TH-03/SHP-0243/CH-04/INC-0234); warehouse_staff chỉ `KHO-01` (đúng 1 alert); rescue_member không thấy alert đội CH-04 (ownership).
- Citizen và null user ⇒ rỗng; `citizen` không có `alert_view`/`alert_acknowledge`.
- `alertAuthorizationResource` mirror geography + warehouse của entity nguồn.
- Read/ack qua authorize boundary: officer đọc được SOS Tây Hồ, bị chặn shelter Hoàn Kiếm (“ngoài phạm vi địa lý”); rescue_member bị chặn ack; warehouse_staff bị chặn do thiếu quyền đọc nguồn SOS.
- Use case read receipt + ack với event attribution; ack lần hai báo lỗi.
- Filters: severity/category/status/search Unicode-không-dấu/cửa sổ thởi gian.
- `summarizeAlerts`, `getAlertAnalytics` (pending ack 5; ack rate 0 → 20% sau 1/5 ack).
- `alertDetailPath` encode an toàn.

## `tests/integration/alert-cross-module.test.ts`

- Pipeline đầy đủ: repository → authorized view → derive; ack commit đúng 1 lần kèm AlertEvent attribution; xử lý entity nguồn ⇒ alert hết hiệu lực dù interaction còn trong snapshot.
- Rollback: command throw sau khi ghi interactions/events ⇒ draft bị hủy nguyên trạng (mutation boundary).
- Deny tại boundary: officer ack ngoài scope; rescue_leader ack đội khác (ownership); rescue_member thiếu `alert_acknowledge`; officer ack trong scope thành công. Không ghi gì khi bị từ chối.
- Command Center parity: cùng phép derive ⇒ cùng collection (không dataset riêng).
- AI grounding: intent `alert_overview`, FACT + evidence `OperationalAlert`, `actions` rỗng (AI không tự xử lý); officer không thấy evidence ngoài Tây Hồ.
- Simulation: tick 13 xuất hiện `shelter:TH-01:shelter_near_capacity`; tick 20 alert INC-0241 hết hiệu lực; không duplicate key ở mọi tick; reset ⇒ baseline + interactions rỗng.
- Analytics: ack rate đổi theo canonical mutation.
- Router: `/alerts`, `/alerts/:key` (decode key), label “Cảnh báo”.

## Chạy

```bash
npm test           # 227 case (195 cũ + 32 mới) — pass
npm run test:focused
```
