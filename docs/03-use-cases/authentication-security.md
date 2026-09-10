# Ca sử dụng — Xác thực, Phiên, RBAC & Audit

## Đăng nhập

Người dùng nhập tên đăng nhập và mật khẩu. Bảy tài khoản demo: `thuantq` (admin), `nguyentrung` (disaster_officer), `phamhieu` (rescue_unit), `phamdam`, `minhtri`, `namanh`, `trantuan` (citizen); mật khẩu dùng chung `VNDMS@2026`. Không có tài khoản seed nào khác. `loginUser` gọi `AuthenticationGateway`; local adapter băm SHA-256 mật khẩu để đối chiếu demo credential, kiểm tra active và tạo phiên 8 giờ. Thành công hoặc thất bại đều tạo security audit.

## Khôi phục và kết thúc phiên

Khi tải lại trang, adapter kiểm tra cấu trúc session, user tồn tại/active và expiresAt. Phiên hợp lệ được khôi phục; malformed, expired hoặc inactive bị xóa. Logout xóa session khỏi storage, ghi `LOGOUT` và protected application quay về login.

## Phân quyền

Mỗi route và mutation cần permission từ matrix hiện hữu. Quyết định gồm allowed, reason, permission, user scope và resource scope. Phạm vi địa lý áp cho mọi vai không phải national; quyền `*_own` (SOS, phản ánh) kiểm `ownerUserId`; `citizen` chỉ vào Cổng công dân. Admin không mặc định có quyền nghiệp vụ (xác minh/điều phối/xác nhận kết quả/công bố).

## Quản trị tối thiểu

`admin` tìm/lọc user, xem permission hiệu lực, audit gần đây, activate/deactivate, đổi role và geographic scope. Không thể tự vô hiệu hóa tài khoản đang đăng nhập.

## Audit

Login, failed login, logout, session expiration/restoration, permission denied/authorized và user-management mutations được ghi actor, role, action, resource, timestamp, scope, result và reason.
