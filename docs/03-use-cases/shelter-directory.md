# Use cases — Danh mục Điểm sơ tán (V2)

Ở V2, phân hệ **Lệnh sơ tán (Evacuation)** đã được xóa. Điểm sơ tán chỉ còn là **danh mục tra cứu** dùng chung cho cả 4 vai; cán bộ PCTT và quản trị cập nhật sức chứa/trạng thái.

| Actor | Quyền | Ghi chú |
| --- | --- | --- |
| `citizen` | `published_alert_view` (mục "Điểm sơ tán an toàn") | Chỉ tra cứu |
| `rescue_unit` | `shelter_view` | Tra cứu khi điều động |
| `disaster_officer`, `admin` | `shelter_view`, `shelter_create`, `shelter_update` | Cập nhật danh mục |

## UC-SE-01 Tra cứu điểm sơ tán

Tìm kiếm và lọc theo trạng thái, readiness, khu vực, accessibility, y tế và sức chứa; danh sách ưu tiên quá tải, gần đầy, không thể tiếp cận. Cổng công dân hiển thị điểm sơ tán trên bản đồ và đếm số điểm đang mở.

## UC-SE-02 Quản lý sức chứa

Người có `shelter_update` cập nhật sức chứa, chỗ dự phòng và số người đang tiếp nhận. Application tính available capacity và occupancy percentage; domain tự suy ra Đang tiếp nhận/Gần đầy/Quá tải, không để UI gán trạng thái mâu thuẫn.

## UC-SE-03 Mở/đóng điểm

Chỉ mở khi readiness và tuyến tiếp cận cho phép. Trường `activeOperations` không còn được ghi (không có lệnh sơ tán); đóng điểm chỉ bị chặn khi còn người đang tiếp nhận.

## Cảnh báo dẫn xuất

Điểm sơ tán quá tải/gần đầy vẫn sinh cảnh báo tác nghiệp (`shelter_overloaded`, `shelter_near_capacity`) cho Trung tâm điều hành.
