# Module Quản lý Đội Cứu hộ

## Routes

- `/teams`: worklist lực lượng, tìm kiếm và lọc theo trạng thái, năng lực, khu vực và nhiệm vụ.
- `/teams/:id`: hồ sơ tác chiến của đội, nhiệm vụ, nhân sự, phương tiện, GPS, timeline và bản đồ.

## Team domain model

`RescueTeam` được định nghĩa tại domain độc lập framework và được lưu trong canonical operational state, không tạo team store song song:

- Nhận dạng: `id`, `code`, `name`, `type`, `region`.
- Vận hành: `status`, `availability`, `currentTask`, `currentIncident`.
- Nhân sự: `leader`, `members`, `personnel`, `contact`.
- Năng lực: `capabilities`, `capability` chính.
- Phương tiện: `vehicles` với mã, loại và trạng thái.
- Vị trí: `location`, `coordinates`, `lastLocationUpdate`, `communicationStatus`.
- Audit: `createdAt`, `updatedAt`.

`TeamEvent` là event stream dùng chung cho điều phối, task lifecycle, field update, GPS và thay đổi trạng thái.

## Team lifecycle và status transitions

| Hiện tại       | Có thể chuyển tới                                        |
| -------------- | -------------------------------------------------------- |
| Sẵn sàng       | Đang điều động, Tạm nghỉ, Không khả dụng                 |
| Đang điều động | Đang thực hiện, Sẵn sàng, Mất liên lạc                   |
| Đang thực hiện | Sẵn sàng, Mất liên lạc, Không khả dụng                   |
| Tạm nghỉ       | Sẵn sàng, Không khả dụng                                 |
| Mất liên lạc   | Đang điều động, Đang thực hiện, Sẵn sàng, Không khả dụng |
| Không khả dụng | Sẵn sàng, Tạm nghỉ                                       |

Transition được kiểm tra tại `updateTeamStatus()`. Đội còn task mở không thể bị chuyển thủ công về Sẵn sàng.

## Capability model

Capability là dữ liệu có cấu trúc dùng cho filter và điều phối: cứu hộ đường bộ, đường thủy, lặn, cứu nạn trên cao, y tế khẩn cấp, tìm kiếm người mất tích, sơ tán dân cư và ứng phó sạt lở.

## GPS model

`TeamLocation` gồm latitude, longitude, accuracy, timestamp, source và communicationStatus. Dữ liệu demo deterministic, không giả lập realtime. Khi communicationStatus là `Mất liên lạc`, team được chuyển sang trạng thái nghiệp vụ tương ứng. Bản cập nhật GPS hợp lệ có thể khôi phục đội về trạng thái phù hợp nếu không còn task.

## Assignment workflow

`dispatchTeamToTask()` được orchestration trong shared `OperationalContext` và gọi application use case:

1. Kiểm tra `team_assign` và khả dụng của đội.
2. Cập nhật Task: team, team leader, assignee, incident, priority, destination và trạng thái Đã giao.
3. Cập nhật Team: Đang điều động, currentTask, currentIncident, availability.
4. Giải phóng đội cũ của task nếu đội cũ không còn assignment khác.
5. Cập nhật Incident team nếu cần.
6. Thêm TeamEvent và IncidentEvent.

## Task integration

- Assign từ Task Detail và Team Detail đều cập nhật cùng `teams`/`tasks` state.
- Task Đã tiếp nhận giữ team ở Đang điều động.
- Task Đang thực hiện chuyển team sang Đang thực hiện.
- Task Hoàn thành hoặc hủy giải phóng team về Sẵn sàng nếu team không còn task mở khác.
- Field update của task được ghi đồng thời vào Team timeline và Incident timeline.

## Incident integration

Incident Detail hiển thị team từ shared state và liên kết tới `/teams/:id`. Điều phối đội ghi event vào incident timeline và cập nhật `assignedTeamId` nếu incident chưa có đội chính.

## Command Center integration

- Situation Summary đọc số đội sẵn sàng và mất liên lạc.
- Action Queue ưu tiên đội mất liên lạc.
- Coordination Timeline nhận TeamEvent mới.
- Operational Map đọc vị trí từ shared team state và cập nhật GeoJSON source khi state thay đổi.
- Marker đội trên map mở hồ sơ `/teams/:id`.

## Permission matrix

- `team_view`
- `team_create`
- `team_edit`
- `team_assign`
- `team_update_status`
- `team_update_location`
- `team_manage_members`

Mọi mutation gọi `assertPermission()` tại mutation boundary. UI permission chỉ là lớp bảo vệ thứ hai. Khi có backend, policy phải được enforce lại tại API.

## Demo scenario

- CH-01: Đang thực hiện TSK-0241 tại Phúc Tân.
- CH-02: Sẵn sàng tại Hoàn Kiếm.
- CH-03: Đang điều động tới Tây Hồ.
- CH-04: Mất liên lạc, vị trí cuối tại Ba Đình.
- CH-05: Tạm nghỉ tại Long Biên.

Tọa độ đều là vị trí deterministic, hợp lý trong khu vực Hà Nội.

## UX workflow

1. Quét worklist theo trạng thái và khả dụng.
2. Mở hồ sơ đội để xem assignment, nhân sự, năng lực và GPS.
3. Điều phối đội vào incident/task phù hợp.
4. Theo dõi task, field update và team timeline.
5. Khi task hoàn thành, shared service đánh giá assignment còn lại và trả đội về Sẵn sàng nếu phù hợp.

## Chưa triển khai

- GPS streaming hoặc tracking thời gian thực.
- Full HR/roster management.
- Full vehicle maintenance.
- API/database, realtime multi-user và authorization phía server.
