# Ca sử dụng — Playbooks / SOP tác chiến

## Mục tiêu

Quản lý template quy trình và kích hoạt execution trong context của Incident. Luồng nghiệp vụ: Incident → Playbook → Steps → Task/Team/Evacuation/Shelter/SOS/Relief → Verification → Completion.

## Tác nhân

- Commander: tạo/sửa, xuất bản, kích hoạt, override, hủy và hoàn thành.
- Operator: kích hoạt và thực thi bước; tạo/liên kết hồ sơ nghiệp vụ theo quyền hiện có.
- Local Officer: xem và thực thi trong phạm vi địa lý được cấp.
- Rescue Leader: cập nhật bước tác nghiệp phù hợp với quyền hiện hữu.

## Luồng chính

1. Chọn playbook đã xuất bản và Incident hợp lệ.
2. Hệ thống kiểm tra permission, trạng thái template và geographic scope.
3. Tạo execution riêng với step executions ban đầu.
4. Đánh giá prerequisite để đánh dấu Sẵn sàng hoặc Bị chặn.
5. Bắt đầu bước; tạo hoặc liên kết entity canonical nếu cần.
6. Đánh giá completion criteria từ trạng thái thật của Task, Team, Evacuation, Shelter hoặc Relief.
7. Hoàn thành/bỏ qua bước hợp lệ; mở khóa bước tiếp theo.
8. Chỉ hoàn thành execution khi mọi bước bắt buộc đã hoàn thành.

Bước bắt buộc chỉ được bỏ qua bởi vai trò có `playbook_override`. Mọi mutation tạo timeline/audit và sự kiện Incident liên quan.
