# Kiểm thử Team Management

## Automated pure tests

Hai test source dùng Node test/assert:

- `tests/domain/team-management.test.ts`
- `tests/application/team-management.test.ts`

Các case hiện có:

1. transition và availability theo status;
2. lọc open tasks của đội;
3. gán task dùng Task application use case;
4. gỡ assignment và trả đội về Sẵn sàng;
5. chặn điều phối đội Không khả dụng;
6. chặn chuyển Sẵn sàng khi còn task;
7. phục hồi sau cập nhật liên lạc/vị trí;
8. validation năng lực không rỗng;
9. kết hợp search/type/capability/area/assignment filter và operational sort;
10. Citizen không có quyền quản lý đội.

Các test được compile tạm sang CommonJS bằng TypeScript 6 `--ignoreConfig` và chạy bằng `node --test`; 8 test case đều pass tại lần xác minh ngày 21/08/2026.

## Manual/browser verification checklist

- `/teams`: search; status/type/capability/area/assignment filters; sorting; mobile representation.
- `/teams/CH-01`: identity, current Task/Incident links, members, equipment, map và events.
- Đổi status hợp lệ/bị chặn; cập nhật vị trí; sửa hồ sơ/năng lực.
- Điều phối một đội Sẵn sàng vào task; xác nhận Task, Team, Incident và timeline cùng đổi.
- Gỡ task Đã giao; xác nhận task Chờ giao và Team availability được tính lại.
- Hoàn thành task từ Task module; xác nhận Team không còn bận.
- Role matrix: Citizen không có team permissions; mutation vẫn assertion ở Provider.
- Back/forward và direct route trên History API.

## Giới hạn

Chưa có browser automation runner trong repository. MapLibre cần mạng để tải vector tile. Không test hay tuyên bố GPS realtime/multi-user synchronization vì các khả năng đó chưa tồn tại.
