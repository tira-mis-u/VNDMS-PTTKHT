# Domain model — Playbook

## Template

`Playbook` chứa mã, tên, loại thiên tai, điều kiện kích hoạt, ngưỡng mức độ, phạm vi, phiên bản, owner, thời lượng và chuỗi `PlaybookStep`. Template có lifecycle `Nháp → Đã xuất bản → Lưu trữ`.

`PlaybookStep` mô tả order, objective, type, required, responsible role/team type, prerequisites và completion criteria. Template không sở hữu Task/Team/Incident hoặc inventory.

## Execution

`PlaybookExecution` là một lần chạy độc lập, tham chiếu `playbookId` và `incidentId`. Nó lưu step executions và ID liên kết tới entity canonical. Lifecycle: `Nháp → Đang hoạt động → Tạm dừng → Đang hoạt động → Hoàn thành`; từ Nháp/Đang hoạt động/Tạm dừng có thể sang Đã hủy theo rule.

`PlaybookStepExecution`: `Chờ → Sẵn sàng → Đang thực hiện → Hoàn thành`; Chờ có thể Bỏ qua nếu optional/override hoặc Bị chặn khi thiếu prerequisite.

## Completion criteria

- Nhiệm vụ: Task liên kết phải `Hoàn thành`.
- Điều động: Team liên kết phải đang điều động/thực hiện Incident.
- Sơ tán: Evacuation liên kết đang triển khai hoặc hoàn thành.
- Điểm sơ tán: Shelter liên kết đang vận hành.
- Cứu trợ: Relief Request đã duyệt hoặc đi xa hơn trong lifecycle.
- Xác minh: phải có verification note.
- Đánh giá/Thông báo/Quyết định: phải có ghi chú nghiệp vụ.

Không cho `Chờ → Hoàn thành`; không hoàn thành execution nếu required step chưa hoàn thành.
