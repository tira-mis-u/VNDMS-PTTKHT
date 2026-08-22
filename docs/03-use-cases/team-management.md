# Use cases — Quản lý Đội Cứu hộ

## Tác nhân và quyền

- Commander: xem, chỉnh sửa, điều phối, đổi trạng thái, cập nhật vị trí.
- Operator: xem, chỉnh sửa, điều phối và cập nhật vận hành.
- Local Officer: xem và cập nhật vị trí trong phạm vi demo.
- Rescue Leader: xem, đổi trạng thái, vị trí và quản lý nhân sự.
- Rescue Member: xem và gửi cập nhật vị trí.
- Citizen: không có quyền truy cập quản lý lực lượng.

Mọi mutation gọi `assertPermission` trong `OperationalContext`; việc ẩn nút chỉ là lớp UX.

## UC-TM-01 — Tìm và phân loại lực lượng

Từ `/teams`, người vận hành tìm theo mã/tên/đội trưởng/khu vực; lọc status, loại đội, năng lực, địa bàn, phân công; sắp xếp theo ưu tiên vận hành, cập nhật hoặc mã đội. Kết quả mở `/teams/:teamId`.

## UC-TM-02 — Điều phối đội vào nhiệm vụ

1. Chọn sự cố và một nhiệm vụ chưa kết thúc.
2. Application kiểm tra quyền và khả năng điều phối của đội.
3. Task use case `assignTaskToTeam` cập nhật assignment và giữ lifecycle hợp lệ.
4. Canonical state cập nhật `team.currentTask`, `team.currentIncident`, status/availability, Incident relationship và hai timeline.
5. Đội cũ được tính lại từ các nhiệm vụ còn mở nếu nhiệm vụ được tái gán.
6. Trạng thái thành viên được đồng bộ sang Đang nhiệm vụ; khi đội được giải phóng, thành viên trở về Sẵn sàng.

## UC-TM-03 — Gỡ phân công

Chỉ nhiệm vụ Chờ giao/Đã giao mới được gỡ. `releaseTaskAssignment` trả task về Chờ giao; `recalculateTeamAssignment` trả đội về nhiệm vụ mở khác hoặc Sẵn sàng. Incident timeline và Team timeline nhận event tương ứng.

## UC-TM-04 — Cập nhật trạng thái

Chỉ transition trong `teamStatusTransitions` được chấp nhận. Đội còn nhiệm vụ mở không được chuyển thủ công về Sẵn sàng. Mất liên lạc/Không khả dụng không được điều phối.

## UC-TM-05 — Cập nhật vị trí

Kiểm tra tọa độ và độ chính xác, áp dụng qua `applyTeamLocation`, cập nhật marker và timeline. Đây là dữ liệu demo nhập thủ công/deterministic, không phải GPS realtime.

## UC-TM-06 — Cập nhật hồ sơ và năng lực

Người có `team_edit` cập nhật nhận dạng, đội trưởng, liên hệ, địa bàn, phạm vi, ghi chú và tập năng lực. Ít nhất một năng lực là bắt buộc.

## Hoàn tất nhiệm vụ

Task lifecycle tiếp tục là nguồn quyết định. Khi task hoàn thành/hủy, Team được tính lại từ toàn bộ nhiệm vụ còn mở; không giữ trạng thái bận vĩnh viễn.
