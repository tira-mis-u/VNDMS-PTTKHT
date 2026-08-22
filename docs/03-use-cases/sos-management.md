# Use cases — SOS & Emergency Request Management

## UC-SOS-01 Tiếp nhận và triage

SOS giữ nguyên nguồn/người báo/vị trí/dân số. Pure triage xét đe dọa tính mạng, số người, thương tích/mất tích, nhóm dễ tổn thương, cô lập và liên lạc. Kết quả P1–P4 luôn kèm lý do.

## UC-SOS-02 Xác minh/từ chối

Mới tiếp nhận đi qua Đang xác minh trước Đã xác minh. Yêu cầu không hợp lệ chuyển Từ chối; mất liên lạc là ngoại lệ còn trong hàng đợi. Mutation enforce `sos_verify`/`sos_update`.

## UC-SOS-03 Liên kết hoặc tạo Incident

Có thể chọn Incident hiện hữu hoặc tạo Incident từ SOS. Incident mới nhận vị trí, severity, affected population và nguồn SOS; SOS gốc được giữ và hai timeline nhận event.

## UC-SOS-04 Tạo Task và điều phối Team

Chỉ SOS đã xác minh và đã gắn Incident mới tạo rescue Task. Task input dùng Task application contract; Team phải sẵn sàng, không có Task/Evacuation khác. SOS nhận linkedTask/team và chuyển Đã điều phối. Khi Task bắt đầu/hoàn thành/hủy, SOS và Team được đồng bộ.

## UC-SOS-05 Chuyển tới Shelter

Chọn Shelter còn capacity/accessibility, tạo Evacuation bằng contract hiện hữu và link destination/operation vào SOS. Capacity/reservation tiếp tục do Shelter domain quản lý; redirect thực hiện từ Shelter/Evacuation module.

## UC-SOS-06 Field operation và closure

Cập nhật location tái triage, thêm diễn biến, đánh dấu không liên lạc, kết quả xử lý. Chỉ SOS có resolution summary mới chuyển Đã xử lý → Đã đóng.
