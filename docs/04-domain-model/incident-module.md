# Module Quản lý Sự cố

## Route

- `/incidents`: danh sách tác nghiệp, tab trạng thái, tìm kiếm và bộ lọc.
- `/incidents/:id`: hồ sơ sự cố, timeline, nhiệm vụ, đội cứu hộ, đánh giá ảnh hưởng, báo cáo và bản đồ.

## Data/state layer

`OperationalProvider` là nguồn trạng thái canonical dùng chung của module và Trung tâm điều hành. Các thao tác đều đi qua application operation và mutation orchestration có kiểm tra quyền:

- `createIncident`
- `updateStatus`
- `updateSeverity`
- `dispatchTeam`
- `createTask`
- `addEvent`
- `closeIncident`

Vai trò demo hiện tại là `commander`. Permission matrix đã chuẩn bị cho commander, operator, local officer, rescue leader và citizen. Đây là kiểm tra tại data/service layer phía client; khi có API thật, cùng policy phải được thực thi lại ở server.

## State consistency

- Tạo sự cố: thêm incident, thêm timeline event và xuất hiện trong Action Queue của Trung tâm điều hành.
- Tạo nhiệm vụ: thêm task vào hồ sơ, cập nhật đội nếu được giao và thêm timeline event.
- Điều phối đội: cập nhật `assignedTeamId`, trạng thái incident, trạng thái/currentTask của team và timeline.
- Đóng sự cố: đặt trạng thái `Đã đóng`, tiến độ 100%, ghi `closedAt`, thêm timeline và giảm số sự cố đang xử lý ở Trung tâm điều hành.
- Map Trung tâm điều hành nhận incident từ cùng store và cập nhật GeoJSON source khi state thay đổi.

## Bản đồ

Incident detail lazy-load MapLibre để UI chính xuất hiện trước. Các lớp gồm vị trí sự cố, vùng ảnh hưởng, đội, điểm sơ tán, SOS, tuyến sơ tán và đường hạn chế. Basemap tiếp tục dùng OpenFreeMap/OpenStreetMap; expression nhãn ưu tiên tiếng Việt và không inject nhãn biển tùy chỉnh. Quần Đảo Hoàng Sa và Quần Đảo Trường Sa được giữ bằng lớp dữ liệu địa lý riêng.

## Chưa triển khai

- API/database và lưu trạng thái qua phiên đăng nhập.
- Authorization phía server.
- Upload tệp/ảnh hiện trường.
- Incident API phía backend.
- Đồng bộ thời gian thực nhiều người dùng.
