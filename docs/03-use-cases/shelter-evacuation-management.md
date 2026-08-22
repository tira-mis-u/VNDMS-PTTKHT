# Use cases — Quản lý Điểm sơ tán và Sơ tán

## UC-SE-01 Tra cứu điểm sơ tán

Người vận hành tìm kiếm và lọc theo trạng thái, readiness, khu vực, accessibility, y tế, hoạt động và sức chứa; danh sách ưu tiên quá tải, gần đầy, không thể tiếp cận và hoạt động đang mở.

## UC-SE-02 Quản lý sức chứa

Người có quyền cập nhật sức chứa, chỗ dự phòng và số người đang tiếp nhận. Application tính available capacity và occupancy percentage; domain tự suy ra Đang tiếp nhận/Gần đầy/Quá tải, không để UI gán trạng thái mâu thuẫn.

## UC-SE-03 Mở/đóng điểm

Chỉ mở khi readiness và tuyến tiếp cận cho phép. Không đóng khi còn hoạt động sơ tán đang mở.

## UC-SE-04 Tạo hoạt động sơ tán

Chọn Incident, khu vực nguồn, dân số, ưu tiên, điểm đích và thời gian dự kiến. Domain kiểm tra sức chứa/khả năng tiếp cận; hệ thống giữ chỗ, liên kết Incident và ghi timeline.

## UC-SE-05 Phê duyệt, phân công và triển khai

Operation đi Dự kiến → Đã phê duyệt → Đang triển khai. Phải có Rescue Team và tuyến khả dụng trước khi triển khai. Team canonical state nhận `currentEvacuationOperation`, đổi readiness và ghi TeamEvent.

## UC-SE-06 Cập nhật tiếp nhận

Số người đã sơ tán làm tăng occupancy của Shelter và giảm reserved capacity tương ứng; progress được tính từ population thực tế.

## UC-SE-07 Xử lý tuyến bị chặn

Route chuyển Bị chặn sẽ tạm dừng operation. Người vận hành có thể kích hoạt tuyến thay thế hoặc chuyển hướng tới Shelter khác còn sức chứa.

## UC-SE-08 Hoàn thành/hủy

Operation hoàn thành/cancel giải phóng chỗ dự phòng còn lại, xóa active operation khỏi Shelter và trả Team về trạng thái phù hợp. Mọi mutation enforce RBAC tại OperationalProvider.
