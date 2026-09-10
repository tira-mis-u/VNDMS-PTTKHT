# Chiến lược kiểm thử VNDMS (V2 — 4 vai)

Test suite dùng Node test runner thông qua `tsx`. Mục tiêu là chứng minh domain rules, application contracts, authorization và cross-module consistency; không chạy theo coverage phần trăm hình thức.

Mô hình vai trò V2 gồm `admin`, `disaster_officer`, `rescue_unit`, `citizen`. Test của các module đã xóa thật (Cứu trợ/Kho/Chuyến hàng, Phương án ứng phó, Phục hồi/thẩm định, Mô phỏng, Trợ lý AI, Sơ tán) đã được gỡ; phần contract còn giá trị được chuyển sang test của module thay thế (ghi lý do ở đầu mỗi file).

## Chạy test

```bash
npm test
npm run test:focused
```

- `npm test`: toàn bộ domain, application, infrastructure và integration regression.
- `npm run test:focused`: mutation boundary, authorization, migration vai trò, vòng đời nhiệm vụ (báo xong → xác nhận), phản ánh, cảnh báo công bố và cảnh báo liên module.

## Cấu trúc

### `tests/domain`

Kiểm tra lifecycle và calculation thuần cho Team, SOS và quy tắc cảnh báo tác nghiệp (5 nguồn canonical: incident/task/team/shelter/sos).

### `tests/application`

Kiểm tra:

- authentication/session (username thật `thuantq`, `nguyentrung`, …; 4 tài khoản công dân vẫn đăng nhập được);
- RBAC 4 vai, geographic scope và ownership `*_own` theo `ownerUserId` (không còn `teamId`/`warehouseId` trên tài khoản);
- authorized canonical read model: công dân chỉ thấy SOS/phản ánh của mình, điểm sơ tán là danh mục tra cứu chung, cảnh báo công bố chỉ hiện bản "Đã công bố";
- resource-aware multi-resource authorization (`enforcePermission` luôn có resource context);
- mutation draft, nested commit và rollback qua `OperationalMutationBoundary` (không còn control state mô phỏng);
- Incident closure invariants: nhiệm vụ "Chờ xác nhận" và SOS "Đã xử lý" (chưa được cán bộ đóng) vẫn chặn đóng sự cố;
- vòng đời nhiệm vụ V2: đơn vị báo xong → cán bộ chấp nhận/từ chối; phân công lại bắt buộc lý do + lịch sử;
- Phản ánh của người dân và Cảnh báo công bố (Nháp → Đã công bố → Đã thu hồi);
- analytics/reporting từ canonical records (SOS chờ duyệt, nhiệm vụ chờ xác nhận không tính kết thúc);
- alert derivation, authorized alert view, read/ack qua mutation boundary;
- Command Center quick action plans, boundary enforcement, rollback và projection refresh (actor là cán bộ PCTT; admin bị từ chối quyền nghiệp vụ);
- navigation access: route↔label highlight parity, sidebar theo 4 vai, landing path;
- danh tính 7 tài khoản (ID/username giữ nguyên, tên từ `PERSONNEL`), branding.

### `tests/infrastructure`

- weather pipeline;
- migration mô hình vai trò V2: version, idempotent, backup/rollback, ngoại lệ tài khoản ngoài bảng, không tạo tài khoản mới.

### `tests/integration`

- Alerts → authorized view/mutation boundary/Command Center/Analytics;
- authentication và security audit attribution; route của module đã xóa trả `not-found`.

## Static architecture assertions

Một số test đọc source để bảo vệ các invariant không cần DOM:

- operational commands (kể cả 9 command V2) được publish qua `atomic(command)`, không còn command của module đã xóa;
- chỉ có một permission matrix;
- authorization invocation có resource context;
- Command Center không có operational dataset thứ hai;
- tên nhân sự chỉ khai báo tại `src/data/identity/personnel.ts`.

## Browser regression thủ công

Trước demo/release cần kiểm tra:

1. login và route guard theo 4 vai (thuantq/nguyentrung/phamhieu + 4 công dân);
2. direct detail URL, back/forward và 404 cho route đã xóa (`/relief`, `/recovery`, `/simulation`, `/evacuations`, `/ai`);
3. desktop/tablet/mobile shell;
4. dialog validation, disabled action và failure feedback (báo xong, xác nhận kết quả, phân công lại, đánh giá phản ánh, công bố/thu hồi cảnh báo);
5. MapLibre loading với/không có mạng; công cụ/lớp/thời gian/panel bản đồ, thời tiết, lấy vị trí, chạm SOS cho cả 4 vai;
6. end-to-end Incident → SOS → Task → Team → báo xong → cán bộ xác nhận;
7. Cổng công dân: gửi SOS/phản ánh, theo dõi SOS của mình, xem cảnh báo công bố;
8. Admin users, migration log và audit trail.

Project chưa thêm browser E2E runner hoặc CI; đây là production roadmap thay vì được mô phỏng bằng test giả.
