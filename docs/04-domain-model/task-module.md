# Module Quản lý Nhiệm vụ Tác chiến

## Routes

- `/tasks`: worklist toàn bộ nhiệm vụ, lọc theo trạng thái, ưu tiên, đội, sự cố, khu vực và thời gian.
- `/tasks/:id`: hồ sơ nhiệm vụ, lifecycle, tiến độ, đội, cập nhật hiện trường, timeline, bản đồ và kết quả.

## Domain model

`IncidentTask` được định nghĩa trong domain độc lập framework:

- `id`, `incidentId`, `title`, `type`
- `priority`, `status`, `progress`
- `teamId`, `teamLeader`, `assignee`
- `location`, `coordinates`, `dueAt`
- `createdAt`, `updatedAt`, `completedAt`

`TaskUpdate` lưu timestamp, actor, team, message, location, source và trạng thái đồng bộ mạng.

Task state nằm trong canonical `OperationalProvider`; không tạo state system song song.

## Lifecycle và state transitions

| Trạng thái hiện tại | Transition hợp lệ    |
| ------------------- | -------------------- |
| Chờ giao            | Đã giao, Đã hủy      |
| Đã giao             | Đã tiếp nhận, Đã hủy |
| Đã tiếp nhận        | Đang thực hiện       |
| Đang thực hiện      | Hoàn thành, Đã hủy   |
| Hoàn thành          | Không có             |
| Đã hủy              | Không có             |

Transition được kiểm tra trong `transitionTask()` tại data/service layer. Nhiệm vụ không thể sang `Đã giao` nếu chưa có đội.

## Permission matrix

| Vai trò       | Quyền nhiệm vụ                                                |
| ------------- | ------------------------------------------------------------- |
| Commander     | xem, tạo, giao, tiếp nhận, bắt đầu, cập nhật, hoàn thành, hủy |
| Operator      | xem, tạo, giao, điều phối, cập nhật                           |
| Local Officer | xem, tạo và cập nhật trong phạm vi                            |
| Rescue Leader | xem, tiếp nhận, bắt đầu, cập nhật, hoàn thành                 |
| Rescue Member | xem và cập nhật hiện trường                                   |
| Citizen       | không có quyền truy cập nghiệp vụ                             |

Mọi mutation gọi `assertPermission()` qua lớp permission tập trung trong `OperationalContext`, không chỉ dựa trên trạng thái hiển thị button. Khi có backend, cùng policy phải được enforce lại tại API/server.

## Incident integration

- Tạo task: thêm task và event vào incident timeline.
- Giao đội: cập nhật task, team state/currentTask và incident team nếu incident chưa có đội.
- Tiếp nhận/bắt đầu/hoàn thành: thêm incident event tương ứng.
- Field update: thêm `TaskUpdate` đồng thời ghi event vào incident timeline.
- Cập nhật progress: tính lại incident progress và cập nhật `updatedAt`.
- Hủy task: task bị loại khỏi phép tính tiến độ incident.

## Progress calculation

Incident progress là **trung bình cộng tiến độ của tất cả task liên quan chưa bị hủy**:

```text
incidentProgress = round(sum(task.progress) / activeTaskCount)
```

Ví dụ ba task có tiến độ 100%, 50% và 0% thì incident progress là 50%. Task hoàn thành đạt 100%, nhưng incident không thể tự đạt 100% nếu còn task khác chưa hoàn thành.

## Team integration

`assignTaskTeam()` cập nhật nhất quán:

1. `task.teamId`, `task.teamLeader`, `task.status`.
2. `team.status = Đang nhiệm vụ` và `team.currentTask = taskId`.
3. Incident liên quan nhận team nếu chưa có đội phụ trách.
4. Incident timeline ghi hoạt động điều phối.

## Command Center integration

- Action Queue lấy task trực tiếp từ shared store, ưu tiên task quá hạn, khẩn cấp và chờ giao.
- Coordination Timeline nhận task events từ incident event stream.
- Situation Summary dùng số task chưa hoàn thành từ shared store.
- Progress incident thay đổi được phản ánh trong Incident Overview.

## Overdue logic

Task được đánh dấu quá hạn khi deadline trước thời gian kịch bản và trạng thái không phải `Hoàn thành` hoặc `Đã hủy`. Overdue xuất hiện tại task list, task detail và Command Center Action Queue.

## MapLibre

Task detail lazy-load bản đồ thật với vị trí task, incident, team, điểm sơ tán gần nhất và tuyến tác nghiệp. Basemap, quy tắc nhãn tiếng Việt, Quần Đảo Hoàng Sa và Quần Đảo Trường Sa được kế thừa từ hệ thống.

## UX workflow

1. Tạo task từ `/tasks` hoặc Incident Detail.
2. Điều phối đội nếu task chưa giao.
3. Đội tiếp nhận.
4. Bắt đầu thực hiện.
5. Gửi field updates và cập nhật progress theo mốc 0/25/50/75/100.
6. Hoàn thành hoặc hủy theo transition hợp lệ.
7. Incident và Command Center cập nhật từ cùng state.

## Chưa triển khai

- API/database và đồng bộ đa người dùng.
- Upload ảnh/tệp hiện trường.
- GPS tracking thời gian thực.
- Notification service phía backend.
- Authorization phía server.
