# Ca sử dụng — Xác thực, Phiên, RBAC & Audit

## Đăng nhập

Người dùng nhập họ tên đầy đủ làm username và mật khẩu. Sáu tài khoản demo là Trần Quốc Thuận, Nguyễn Quốc Trung, Phạm Văn Đam, Phạm Trung Hiếu, Lê Nguyễn Minh Trí và Nguyễn Nam Anh; mật khẩu dùng chung `VNDMS@2026`. `loginUser` gọi `AuthenticationGateway`; local adapter băm SHA-256 mật khẩu để đối chiếu demo credential, kiểm tra active và tạo phiên 8 giờ. Thành công hoặc thất bại đều tạo security audit.

## Khôi phục và kết thúc phiên

Khi tải lại trang, adapter kiểm tra cấu trúc session, user tồn tại/active và expiresAt. Phiên hợp lệ được khôi phục; malformed, expired hoặc inactive bị xóa. Logout xóa session khỏi storage, ghi `LOGOUT` và protected application quay về login.

## Phân quyền

Mỗi route và mutation cần permission từ matrix hiện hữu. Quyết định gồm allowed, reason, permission, user scope và resource scope. Local Officer bị giới hạn địa bàn; Rescue Leader/Member theo team; Warehouse Staff theo kho; Citizen không vào ứng dụng tác nghiệp.

## Quản trị tối thiểu

Commander tìm/lọc user, xem permission hiệu lực, audit gần đây, activate/deactivate, đổi role và geographic scope. Không thể tự vô hiệu hóa tài khoản đang đăng nhập.

## Audit

Login, failed login, logout, session expiration/restoration, permission denied/authorized và user-management mutations được ghi actor, role, action, resource, timestamp, scope, result và reason.
