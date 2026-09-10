# Use cases — SOS & Emergency Request Management (V2)

| Actor | Quyền |
| --- | --- |
| `citizen` | `sos_create`, `sos_view_own` — gửi SOS 1 chạm, theo dõi SOS của mình |
| `rescue_unit` | `sos_view`, `sos_create`, `sos_update_field` — cập nhật hiện trường, **không** đóng |
| `disaster_officer` | `sos_verify`, `sos_dispatch`, `sos_update`, `sos_close` |
| `admin` | `sos_view`, `sos_create`, `sos_view_own` — không mặc định xác minh/điều phối |

Mọi SOS gắn `ownerUserId` người gửi; cả 4 vai đều gửi được SOS từ thanh nhanh/Cổng công dân. Không dùng tọa độ mặc định để báo "đã lấy GPS": khi chưa có vị trí thiết bị, giao diện ghi rõ "chưa có vị trí".

## UC-SOS-01 Tiếp nhận và triage

SOS giữ nguyên nguồn/người báo/vị trí/dân số/`ownerUserId`. Pure triage xét đe dọa tính mạng, số người, thương tích/mất tích, nhóm dễ tổn thương, cô lập và liên lạc. Kết quả P1–P4 luôn kèm lý do.

## UC-SOS-02 Xác minh/từ chối

Mới tiếp nhận đi qua Đang xác minh trước Đã xác minh. Yêu cầu không hợp lệ chuyển Từ chối; mất liên lạc là ngoại lệ còn trong hàng đợi. Mutation enforce `sos_verify`/`sos_update`.

## UC-SOS-03 Liên kết hoặc tạo Incident

Có thể chọn Incident hiện hữu hoặc tạo Incident từ SOS. Incident mới nhận vị trí, severity, affected population và nguồn SOS; SOS gốc được giữ và hai timeline nhận event.

## UC-SOS-04 Tạo Task và điều phối Team

Chỉ SOS đã xác minh và đã gắn Incident mới tạo rescue Task. Task input dùng Task application contract; Team phải sẵn sàng, không có Task khác. SOS nhận linkedTask/team và chuyển Đã điều phối. Khi Task bắt đầu/hoàn thành/hủy, SOS và Team được đồng bộ.

## UC-SOS-05 Gợi ý điểm sơ tán

Chi tiết SOS hiển thị điểm sơ tán gần còn sức chứa từ danh mục; không còn tạo lệnh sơ tán.

## UC-SOS-06 Field operation và closure

Cập nhật location tái triage, thêm diễn biến, đánh dấu không liên lạc, kết quả xử lý. Đơn vị cứu hộ cập nhật hiện trường/kết quả (`sos_update_field`); chỉ cán bộ PCTT (`sos_close`) mới chuyển Đã xử lý → Đã đóng. SOS "Đã xử lý" chưa đóng vẫn chặn đóng sự cố và không tính là kết thúc trong báo cáo.
