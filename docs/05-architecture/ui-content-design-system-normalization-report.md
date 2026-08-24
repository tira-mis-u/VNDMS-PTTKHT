# Báo cáo chuẩn hóa giao diện, nội dung và hệ thống thiết kế

**Hệ thống:** VNDMS  
**Ngày hoàn tất:** 22/08/2026  
**Phạm vi:** Chuẩn hóa toàn hệ thống hiện hữu; không bổ sung mô-đun nghiệp vụ mới  
**Trạng thái:** Hoàn tất và đã kiểm chứng bằng kiểm tra tĩnh, bộ kiểm thử, bản dựng production và trình duyệt thực tế

## 1. Tóm tắt điều hành

Đợt chuẩn hóa đã thống nhất ngôn ngữ giao diện tiếng Việt, nguồn danh tính nhân sự, control biểu mẫu, typography, spacing và trải nghiệm Trợ lý AI trên toàn bộ các bề mặt đang có. Các thay đổi giữ nguyên biên kiến trúc vận hành, RBAC, permission matrix, authorized view, entity contract và mutation boundary.

Kết quả chấp nhận cuối cùng:

| Chỉ số | Kết quả |
|---|---:|
| Chuỗi giao diện tiếng Anh/hỗn hợp thuộc danh sách cấm | **0** |
| Bản ghi trong nguồn danh tính chung | **67** |
| ID danh tính trùng | **0** |
| Tên hiển thị danh tính trùng | **0** |
| Tên nhân sự bị khai báo lặp ngoài nguồn chung | **0** |
| `UiSelect` trong runtime source | **78** |
| Native `<select>` trong TSX | **0** |
| Input / textarea trong TSX | **76 / 20** |
| Khai báo cỡ chữ 8–12px | **0** |
| Route được kiểm tra trình duyệt | **14** |
| Lượt kiểm tra route–chế độ | **56** |
| Ảnh bằng chứng | **58** |
| Vi phạm accessibility mức nghiêm trọng/rất nghiêm trọng | **0** |
| Màn hình có tràn ngang toàn trang | **0** |
| Màn hình có chữ hiển thị dưới 12,5px | **0** |
| Native select nhìn thấy trong trình duyệt | **0** |
| Full test | **285/285 đạt** |
| Lint | **0 cảnh báo, 0 lỗi** |
| TypeScript + production build | **Thành công** |

## 2. Chuẩn hóa thuật ngữ và nội dung

### 2.1. Quy ước thuật ngữ

Các thuật ngữ nghiệp vụ hiển thị đã được thay bằng tiếng Việt tự nhiên và nhất quán, tiêu biểu:

| Thuật ngữ cũ | Thuật ngữ giao diện chuẩn |
|---|---|
| Dashboard / Command Center | Trung tâm điều hành |
| Incident | Sự cố |
| Playbook | Kế hoạch ứng phó |
| Task | Nhiệm vụ |
| Team | Đội cứu hộ |
| Alert | Cảnh báo |
| Search / Filter | Tìm kiếm / Bộ lọc hoặc động từ lọc theo ngữ cảnh |
| Status | Trạng thái |
| canonical trong nội dung người dùng | Diễn đạt theo nghiệp vụ như dữ liệu chính thức, nguồn dữ liệu vận hành hoặc bỏ khỏi câu nếu không cần thiết |

Phạm vi rà soát bao gồm forms, bảng, dialog, tooltip, placeholder, ARIA label, title, empty/error state, thông báo nghiệp vụ, seed, mô phỏng, phân tích, bản đồ, cảnh báo, sơ tán, phục hồi, quản trị, hồ sơ và Trợ lý AI. Technical identifier, route, API/protocol, package/file name và comment kỹ thuật cần thiết vẫn được giữ bằng tiếng Anh.

`node scripts/audit-ui-content.mjs` dùng kiểm tra AST cho các chuỗi giao diện bị cấm và kết quả cuối là **0 findings**.

## 3. Nguồn danh tính duy nhất

Nguồn chính được đặt tại `src/data/identity/personnel.ts` với cấu trúc tách biệt:

- `id`: mã ổn định;
- `displayName`: tên hiển thị;
- `roleLabel`: vai trò nghiệp vụ;
- `kind`: tài khoản, nhân sự hoặc công dân.

Nguồn có **67 bản ghi**, bao phủ sáu tài khoản đăng nhập, đội trưởng/thành viên, cán bộ, chỉ huy, nạn nhân, người báo/liên hệ và các tham chiếu nhân sự trong seed, AI evidence, mô phỏng, cảnh báo, báo cáo và timeline attribution. `src/data/people.ts` chỉ đóng vai trò compatibility export.

Kiểm tra uniqueness ghi nhận **0 ID trùng**, **0 tên hiển thị trùng** và **0 literal tên nhân sự bị khai báo lặp trong runtime source ngoài file danh tính**. RBAC, stable ID, ownership và quan hệ nghiệp vụ không thay đổi.

## 4. Input, Select và control biểu mẫu

### 4.1. Primitive dùng chung

`src/components/ui/Select.tsx` là Select tùy biến duy nhất toàn hệ thống. Component giữ native select ở trạng thái visually hidden để bảo toàn name/value và form semantics, đồng thời dùng trigger/popup tùy biến cho giao diện.

Hợp đồng accessibility đã triển khai:

- combobox/listbox/option ARIA;
- `aria-expanded`, `aria-controls`, `aria-activedescendant`;
- ArrowUp, ArrowDown, Home, End, Enter, Space và Escape;
- focus trả về trigger sau khi chọn;
- đóng khi click bên ngoài;
- mở lên trên khi thiếu khoảng trống phía dưới;
- trạng thái disabled, dark mode và mobile thống nhất.

### 4.2. Số lượng và kích thước

Kiểm tra runtime source ghi nhận **78 `UiSelect`**, **76 input**, **20 textarea**, và **0 native `<select>` trong TSX**. Browser verification đo **180 control instance nhìn thấy** trong ma trận; input và Select thông thường cao **42px**, textarea hội thoại cao **104px**. Checkbox quản trị là control vuông **24px**, không áp dụng chiều cao trường nhập văn bản.

Custom Select xuất hiện trên **32 lượt route–chế độ**, tối đa **8 Select trên một màn hình**. Popup và thao tác bàn phím được chụp riêng tại `select-tuy-bien-ban-phim.jpg`. Không có native select nhìn thấy trong cả 56 lượt kiểm tra.

## 5. Typography, spacing và thành phần dùng chung

Hệ thống token và override chuẩn hóa tập trung tại `src/styles/compact-ui.css`, sau đó được áp dụng cho shared primitives và feature styles:

- metadata: tối thiểu 13px theo semantic role; badge ngoại lệ cho phép 12,5px;
- body: 14–15px;
- table: 13,5–14px;
- button/form control: 14px;
- control nhập liệu: 42px;
- spacing theo nhịp 4/8/12/16/20/24/32px;
- button variant, icon alignment, focus, disabled và dark mode dùng chung.

Static audit không còn khai báo `font-size` từ 8px đến 12px. Browser audit không phát hiện text hiển thị dưới 12,5px. Giao diện ở mức zoom 100% được thu gọn vừa phải, đồng thời sidebar được nới để “Quản lý & điều hành” không xuống dòng và header được tăng chiều cao theo yêu cầu.

Các shared surface đã được rà gồm Input, Select, Textarea, Button, Badge, Card, Dialog, Table, Tabs, Dropdown, Popover, Tooltip, Breadcrumb, Sidebar, Header, empty state, timeline và bề mặt AI. Không áp dụng chiến lược thêm hàng loạt `!important`; style lặp được gom về primitive/token chung.

## 6. Trợ lý AI

Trợ lý AI được tổ chức lại thành trải nghiệm hội thoại gồm vùng chào, câu hỏi gợi ý, luồng câu hỏi–trả lời, nguồn căn cứ, hành động liên quan và composer. Nội dung trả lời tiếp tục lấy từ authorized operational view và các application contract hiện hữu.

Giới hạn sản phẩm được thể hiện trung thực:

- read-only đối với truy vấn;
- hành động vẫn đi qua luồng xác nhận và permission hiện hữu;
- không giả streaming;
- không hiển thị confidence giả;
- không tuyên bố realtime hoặc backend/LLM khi hệ thống không có;
- trường hợp không có dữ liệu trả về trạng thái không xác định thay vì bịa evidence.

Các test AI hiện hữu kiểm tra grounding, evidence ID, authorized view, unknown entity, simulation state, sức chứa, đội sẵn sàng, nhiệm vụ quá hạn, thiếu hàng và permission của recommendation action đều đạt.

## 7. Bản đồ và yếu tố địa lý

Map/panel được căn chiều cao và baseline; trạng thái đồng bộ dữ liệu đã được loại khỏi header bản đồ. Phần thể hiện Hoàng Sa và Trường Sa chỉ giữ hai nhãn quần đảo đã được xác nhận trong cấu hình; không tự tạo polygon hoặc vùng địa lý tùy tiện. Collection kỹ thuật cần cho contract/test được giữ nguyên nhưng không dùng để vẽ vùng chủ quyền suy diễn.

## 8. Kiểm chứng trình duyệt

### 8.1. Ma trận

Mỗi route được kiểm tra ở bốn chế độ:

1. sáng desktop — 1440×900;
2. tối desktop — 1440×900;
3. sáng tablet — 820×1180;
4. sáng mobile — 390×844.

Danh sách 14 route:

1. Trung tâm điều hành;
2. Sự cố — danh sách;
3. Sự cố — chi tiết;
4. SOS — danh sách;
5. SOS — chi tiết;
6. Đội cứu hộ — danh sách;
7. Đội cứu hộ — chi tiết;
8. Cảnh báo;
9. Sơ tán;
10. Phục hồi;
11. Mô phỏng;
12. Trợ lý AI;
13. Quản trị người dùng;
14. Hồ sơ cá nhân.

Trang đăng nhập được chụp riêng. Tổng cộng có **56 route checks** và **58 ảnh** gồm 56 ảnh ma trận, một ảnh đăng nhập và một ảnh popup Select bằng bàn phím.

### 8.2. Kết quả

- Axe serious/critical: **0**;
- màn hình tràn ngang toàn trang: **0**;
- màn hình có text dưới 12,5px: **0**;
- native select nhìn thấy: **0**;
- route không tải xong trước khi chụp: **0**;
- custom Select đã được mở bằng ArrowDown và đóng bằng Escape trong phiên trình duyệt.

Bằng chứng nằm tại `docs/05-architecture/ui-normalization-screenshots/`; dữ liệu máy đọc nằm trong `verification-results.json`.

## 9. Kiểm thử và chất lượng bản dựng

| Lệnh | Kết quả |
|---|---|
| `node scripts/audit-ui-content.mjs` | Đạt, 0 findings |
| `npm test` | Đạt, 285/285 |
| `npm run lint` | Đạt, 0 warnings, 0 errors trên 221 files |
| `npm run build` | Đạt, 1985 modules transformed |
| `node scripts/verify-ui.mjs` | Đạt, 56 checks; 0 serious/critical |
| `git diff --check` | Đạt |

Regression coverage mới tại `tests/application/ui-content-normalization.test.ts` kiểm tra Select dùng chung, keyboard/ARIA contract, uniqueness của personnel literal, content audit và typography floor. Các test identity và recovery được cập nhật để phản ánh nguồn danh tính chung và thông báo nghiệp vụ tiếng Việt.

## 10. Nhóm tệp thay đổi chính

- **Design system:** `src/components/ui/Select.tsx`, `src/styles/compact-ui.css`, các stylesheet feature;
- **Identity:** `src/data/identity/personnel.ts`, `src/data/people.ts`, `src/infrastructure/auth/demoUsers.ts`, scenario seed;
- **Content:** các page/component thuộc command center, incidents, SOS, teams, alerts, evacuations, recovery, relief, shelters, playbooks, tasks, simulation, analytics, auth và AI;
- **Application/domain messages:** AI, analytics, command center, incidents, playbooks, recovery, relief, simulation và timeline;
- **GIS:** `src/infrastructure/gis/mapConfig.ts` và map surfaces;
- **Verification:** `scripts/audit-ui-content.mjs`, `scripts/verify-ui.mjs`, `tests/application/ui-content-normalization.test.ts`;
- **Browser tooling:** `playwright` và `@axe-core/playwright` trong devDependencies.

## 11. Giới hạn còn lại

1. Production build vẫn có cảnh báo kỹ thuật đã biết: alerts module vừa được import tĩnh vừa import động, và một số chunk lớn hơn 500kB. Đây không phải lỗi build và không thuộc phạm vi chuẩn hóa nội dung/giao diện.
2. Ma trận dark mode tập trung ở desktop; tablet và mobile được kiểm chứng ở light mode. Responsive behavior vẫn được kiểm tra đầy đủ trên hai kích thước này.
3. Kiểm tra ngôn ngữ tự động tập trung vào các thuật ngữ giao diện bị cấm và các vị trí user-facing có thể nhận diện bằng AST; identifier/protocol/comment kỹ thuật được chủ động loại trừ.
4. Không triển khai Hazard, History, Trends, Configuration hoặc mô-đun nghiệp vụ mới trong đợt này.

## 12. Kết luận

Đợt SYSTEM-WIDE UI / CONTENT / TYPOGRAPHY NORMALIZATION đạt các tiêu chí nghiệm thu: giao diện tiếng Việt nhất quán, danh tính tập trung, Select dùng chung có accessibility, typography/control đồng bộ, AI grounded trung thực, responsive không tràn ngang, không có lỗi accessibility nghiêm trọng và toàn bộ test/lint/build đều đạt. Kiến trúc nghiệp vụ và các boundary bảo mật hiện hữu được giữ nguyên.
