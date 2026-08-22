# Use Cases — Alerts / Operational Notifications

Trung tâm thông báo tác nghiệp của VNDMS. Mọi cảnh báo được **suy ra (derive)** từ canonical operational state; không có bản ghi alert tĩnh, không có danh sách cảnh báo hard-code.

## 1. Actors

| Actor | Quyền liên quan | Ghi chú |
|---|---|---|
| Chỉ huy (commander) | `alert_view`, `alert_acknowledge` | Toàn quốc |
| Điều hành viên (operator) | `alert_view`, `alert_acknowledge` | Toàn quốc |
| Cán bộ địa phương (local_officer) | `alert_view`, `alert_acknowledge` | Chỉ trong phạm vi địa lý |
| Đội trưởng cứu hộ (rescue_leader) | `alert_view`, `alert_acknowledge` | Chỉ resource đội mình được phép thấy |
| Đội viên cứu hộ (rescue_member) | `alert_view` | Chỉ xem/đánh dấu đọc |
| Nhân viên kho (warehouse_staff) | `alert_view`, `alert_acknowledge` | Chỉ alert thuộc kho được phân công |
| Nhân viên cứu trợ (relief_worker) | `alert_view` | Chỉ xem |
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
| Evacuation | Tạm dừng hoặc tuyến bị chặn khi đang triển khai; triển khai chậm | high / medium |
| Relief | Yêu cầu đã duyệt/giữ hàng còn thiếu; kho hết hàng; tồn dưới mức đặt lại | critical/high / high / medium |
| Shipment | Quá giờ dự kiến; có sự cố | high / critical |
| Playbook | Execution đang hoạt động có bước bắt buộc bị chặn | high |
| Recovery | Assessment chờ xác minh >24h; milestone quá hạn; ngân sách vượt/sắp vượt (≥85%) | medium / medium / high |

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

Mọi alert giữ `source.path` tới route canonical hiện hữu (ví dụ `/sos/SOS-0242`, `/relief/requests/REQ-0241`, `/playbooks/PB-FLOOD-001/execute`). Alert không tự có hành động nghiệp vụ riêng — xử lý diễn ra ở module chuyên trách; khi xử lý xong, alert hết hiệu lực.

## 4. Tích hợp

- **Command Center**: panel “Cảnh báo tác nghiệp” đọc đúng collection `store.alerts` (chips theo nhóm + 5 alert ưu tiên), không dataset riêng.
- **Grounded AI**: intent `alert_overview` (“Có cảnh báo nào nghiêm trọng?”) trả FACT với evidence = OperationalAlert + entity nguồn; actions rỗng — AI không tự xác nhận/giải quyết alert.
- **Analytics**: `getAlertAnalytics` (severity/category/unresolved/ack rate) trên Authorized Alert View.
- **Simulation**: tick lan truyền cập nhật canonical state → alert xuất hiện/biến mất tự nhiên (ví dụ TH-01 gần đầy ở tick 13); reset → baseline deterministic.

## 5. Ràng buộc nghiệp vụ

- Derivation chỉ chạy trên **Authorized Operational View** — không thể thấy alert của entity ngoài quyền.
- Không tạo alert khi điều kiện không đúng dữ liệu (“không alert cho có”).
- Không email/SMS/push/websocket — local deterministic demo, notification surface trong shell.
