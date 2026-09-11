# Use Cases — Alerts / Operational Notifications

Trung tâm thông báo tác nghiệp của VNDMS. Mọi cảnh báo được **suy ra (derive)** từ canonical operational state; không có bản ghi alert tĩnh, không có danh sách cảnh báo hard-code.

## 1. Actors

| Actor | Quyền liên quan | Ghi chú |
|---|---|---|
| Quản trị viên (admin) | `alert_view` | Toàn quốc, chỉ xem |
| Cán bộ PCTT (disaster_officer) | `alert_view`, `alert_acknowledge`, `published_alert_manage` | Toàn quốc |
| Cán bộ địa phương (local_officer) | `alert_view`, `alert_acknowledge` | Chỉ trong phạm vi địa lý |
| Đơn vị cứu hộ (rescue_unit) | `alert_view`, `alert_acknowledge` | Mọi đội |
| Đội viên cứu hộ (rescue_member) | `alert_view` | Chỉ xem/đánh dấu đọc |
| Công dân (citizen) | `published_alert_view` | Chỉ cảnh báo đã công bố |
| Ngườii dân (citizen) | — | Không thấy alert tác nghiệp |

## 2. Quy tắc sinh cảnh báo (derivation rules)

Một điều kiện nghiệp vụ đang đúng ⇒ đúng một alert với key deterministic `<category>:<sourceType>:<sourceId>:<condition>`. Điều kiện không còn đúng ⇒ alert tự hết hiệu lực (biến mất khỏi mọi view ở lần render/query tiếp theo).

| Nhóm | Điều kiện | Severity |
|---|---|---|
| Incident | Khẩn cấp đang mở; Cao ở giai đoạn đầu (<50%); chưa có đội phụ trách | critical / high / medium |
| SOS | P1 đã xác minh chưa điều phối; chờ xử lý quá 30 phút; mất liên lạc | critical / high |
| Task | Quá hạn; ưu tiên cao chưa giao đội; đang thực hiện nhưng đình trệ (>3h không cập nhật, tiến độ <50%) | high / medium |
| Team | Mất liên lạc; không khả dụng khi đang có sự cố Khẩn cấp | high / medium |
| Shelter | Quá tải; gần đầy (≥85% cam kết); không thể tiếp cận | critical / high / medium |

Alert `critical` luôn yêu cầu xác nhận (`requiresAcknowledgement`).

## 3. Luồng sử dụng chính

### 3.1 Xem cảnh báo (mọi role có `alert_view`)

1. Badge trên sidebar mục **Cảnh báo** và chuông header hiển thị số cảnh báo **chưa đọc thực tế** (không hard-code).
2. Header popover: tóm tắt (chưa đọc / cần xác nhận / đang hiệu lực), tối đa 6 alert ưu tiên nhất; mỗi item link sang chi tiết alert hoặc trực tiếp entity nguồn.
3. `/alerts`: worklist với search (không dấu), filter severity/category/trạng thái/cửa sổ thởi gian, sắp xếp severity → thởi điểm ghi nhận.
4. `/alerts/:key`: chi tiết — điều kiện suy ra, nguồn canonical, phạm vi địa lý, trạng thái đọc/xác nhận, nhật ký alert.

### 3.2 Đánh dấu đã đọc / chưa đọc

- Từ popover, list hoặc detail. Read receipt gắn `userId + timestamp`, lưu trong `alertInteractions` của canonical snapshot (qua `OperationalMutationBoundary`).
- “Đánh dấu tất cả đã đọc” chỉ áp dụng cho các alert user hiện tại **nhìn thấy được**.
- Read receipt là tương tác cá nhân → không tạo security audit, không tạo timeline event.

### 3.3 Xác nhận cảnh báo (acknowledge)

- Chỉ alert `requiresAcknowledgement` (critical) và chưa được xác nhận.
- Đi qua: session → `alert_view` + read permission của entity nguồn (geography + ownership) → `alert_acknowledge` (ghi security audit `MUTATION_AUTHORIZED`/`PERMISSION_DENIED`) → commit atomic (interaction + AlertEvent) hoặc rollback nguyên trạng nếu lỗi giữa chừng.
- Sau xác nhận: status “Đã xác nhận”, hiển thị ngườii/thởi điểm xác nhận, timeline ghi attribution.

### 3.4 Mở entity nguồn

Mọi alert giữ `source.path` tới route canonical hiện hữu (ví dụ `/sos/SOS-YAGI-01`, `/tasks/TSK-YAGI-02`). Alert không tự có hành động nghiệp vụ riêng — xử lý diễn ra ở module chuyên trách; khi xử lý xong, alert hết hiệu lực.

## 4. Tích hợp

- **Command Center**: panel “Cảnh báo tác nghiệp” đọc đúng collection `store.alerts` (chips theo nhóm + 5 alert ưu tiên), không dataset riêng.
- **Cảnh báo công bố** (`PublishedAlert`): thực thể riêng do cán bộ PCTT soạn nháp → công bố → thu hồi, hiển thị ở khối "Cảnh báo công bố" trên trang Cảnh báo và ở Cổng công dân (chỉ bản "Đã công bố").
- **Analytics**: `getAlertAnalytics` (severity/category/unresolved/ack rate) trên Authorized Alert View.

## 5. Ràng buộc nghiệp vụ

- Derivation chỉ chạy trên **Authorized Operational View** — không thể thấy alert của entity ngoài quyền.
- Không tạo alert khi điều kiện không đúng dữ liệu (“không alert cho có”).
- Không email/SMS/push/websocket — local deterministic demo, notification surface trong shell.
