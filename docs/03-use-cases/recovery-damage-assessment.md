# Ca sử dụng — Recovery & Damage Assessment

## Workflow

Incident → Damage Assessment → Verification → Recovery Project → Resource Allocation → Progress → Completion → Lessons/Closure.

## Assessment

Cán bộ tạo assessment trong phạm vi địa lý, bổ sung DamageItem và evidence, sau đó gửi thẩm định. Người có quyền verification đưa hồ sơ sang Đang thẩm định rồi xác minh hoặc từ chối có lý do. Assessment đã xác minh không được sửa trực tiếp; correction phải tạo revision mới giữ `revisionOf`.

## Recovery Project

Dự án đề xuất phải tham chiếu assessment đã xác minh, có owner, scope và ngân sách hợp lệ trước khi phê duyệt. Sau phê duyệt có thể khởi động, tạm dừng, tiếp tục, hoàn thành hoặc hủy. Milestone bắt buộc không thể bỏ qua.

Progress được dẫn xuất 60% từ milestone và 40% từ Task canonical. Hoàn thành yêu cầu mọi milestone/task bắt buộc hoàn thành, assessment còn verified và có completion verification.

## Nguồn lực

Dự án chỉ giữ ID Task, Team và Relief Request hiện hữu. Tạo Task từ dự án dùng Task application contract và canonical Task state. Playbook execution có thể tạo dự án khi chuyển từ ứng phó sang khôi phục.
