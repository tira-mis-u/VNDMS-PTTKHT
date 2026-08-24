# VNDMS — FULL UI SYSTEM REPAIR & CONSISTENCY PASS

**Ngày hoàn tất:** 22/08/2026  
**Phạm vi:** toàn bộ `src/`, 19 route thực tế từ thanh điều hướng và `/profile`  
**Trạng thái:** **HOÀN TẤT — đã qua kiểm tra route, trang chi tiết, trạng thái tương tác và cổng trực quan Chrome cuối cùng**

## 1. Kết luận điều hành

Đợt sửa đã xử lý nguyên nhân gốc ở hệ thống giao diện dùng chung thay vì vá theo từng ảnh hoặc từng route. Kết quả cuối:

- route chính: **20 trang × 6 viewport × 2 giao diện = 240/240 lượt Chrome đạt**;
- trang chi tiết: **15 route × 12 chế độ = 180/180 lượt đạt**;
- trạng thái tương tác: **66/66 lượt dialog, drawer, menu, trợ lý và sidebar đạt**;
- tổng ma trận máy: **486/486 lượt đạt**;
- Axe mức nghiêm trọng/rất nghiêm trọng: **0**;
- tràn ngang tài liệu, lỗi toolbar, dropdown bị cắt, chevron kép, lỗi căn hàng bản đồ: **0**;
- native `<select>` ngoài shared Select: **0**;
- font giao diện dưới 12,5px: **0**;
- chuỗi tên người trùng/hard-code ngoài nguồn danh tính chung: **0**;
- chuỗi tiếng Anh/hybrid bị cấm trong giao diện: **0**;
- tests: **286/286**; focused tests: **47/47**; TypeScript, lint, build và `git diff --check`: **đạt**.

Bằng chứng máy, ảnh từng route và 12 contact sheet nằm tại `docs/05-architecture/ui-system-full-repair-evidence/`; kết quả có cấu trúc nằm trong `verification-results.json`.

## 2. Phạm vi route và inventory điều hướng

Thanh điều hướng có **25 mục**, gồm **19 route thực tế** và **6 placeholder không có `path`**. Không tạo route giả cho các module ngoài phạm vi.

Route thực tế đã kiểm tra: `/`, bản đồ tác nghiệp, `/alerts`, `/incidents`, `/playbooks`, `/tasks`, `/teams`, `/evacuations`, `/sos`, `/shelters`, `/relief/warehouses`, `/relief`, `/recovery`, `/analytics`, `/analytics/reports`, `/simulation`, `/ai-assistant`, `/admin/users`, `/admin/audit`; bổ sung `/profile` để kiểm tra hồi quy tài khoản.

Placeholder được giữ trung thực: Tình hình thiên tai, Tái thiết, Lịch sử thiên tai, Xu hướng, Phân quyền và Cấu hình.

## 3. App shell, thanh điều hướng và app header

- Sidebar giữ độ rộng phù hợp; “Quản lý & điều hành” và “Trung tâm điều hành” không xuống dòng ở desktop.
- Icon, label và count dùng layout chung, không có kích thước vá riêng từng item.
- App header dùng một hàng căn giữa thực; logo, chuông, nút đổi giao diện và avatar không dùng offset thủ công.
- Đã xóa hoàn toàn trạng thái tài khoản “Đang hoạt động” trong popover và không khôi phục dòng “Dữ liệu nghiệp vụ đã đồng bộ · 09:03 Đang hoạt động”.
- Browser verifier xác nhận chuỗi trạng thái header bị cấm không xuất hiện trên **240/240** màn hình.

## 4. Shared section header

`src/components/ui/PageSectionHeader.tsx` là primitive header cấp trang duy nhất cho các route sidebar và `/profile`.

Primitive thống nhất:

- tên phân hệ, icon, tiêu đề, mô tả và vùng hành động;
- chiều cao tối thiểu, padding, typography, khoảng cách và responsive behavior;
- không dùng breadcrumb giả trên page cấp module;
- action tự wrap và giữ tương phản ở light/dark.

Đã áp dụng cho Trung tâm điều hành, Bản đồ tác nghiệp, Cảnh báo, Sự cố, Phương án ứng phó, Nhiệm vụ, Đội cứu hộ, Sơ tán, SOS, Điểm sơ tán, Kho vật tư, Phân phối cứu trợ, Đánh giá thiệt hại, Dự án khôi phục, toàn bộ nhóm Phân tích/Báo cáo, Mô phỏng, Trợ lý điều hành, Người dùng, Nhật ký bảo mật và Hồ sơ cá nhân. Verifier ghi nhận **0** màn hình thiếu/tràn section header.

## 5. Typography, density và control system

- Control height chuẩn: **42px**; control text: **14px**; metadata tối thiểu **13px**.
- Không có khai báo font giao diện dưới **12,5px**.
- Input, Search, Select, Textarea, filter và dialog dùng cùng token về chiều cao, radius, font, focus, disabled và dark mode.
- `src/components/ui/Select.tsx` là shared accessible Select duy nhất; popup qua portal, hỗ trợ bàn phím/focus và collision placement.
- Native TSX `<select>` ngoài shared component: **0**; native select hiển thị: **0**; double chevron: **0**.
- Filter toolbar dùng flex-wrap có chủ đích, không fixed-height, không che nội dung cha và không có page-specific layout hack.

## 6. Unified Operational Map

- Header bản đồ hiển thị đúng tên không gian tác nghiệp và dấu thời gian dữ liệu trong phạm vi được phân quyền.
- “Bộ lọc đối tượng” và “Lớp dữ liệu” nằm trong panel nghiệp vụ cùng hàng với bản đồ.
- Map và panel dùng chung một grid row co giãn; desktop có cùng top/bottom, tablet/mobile chuyển hàng có chủ đích.
- Khu kết quả trong panel tự cuộn; không dùng chiều cao cố định theo route làm vỡ responsive.
- Verifier đo trực tiếp hình học map/panel ở mọi viewport desktop và ghi nhận **0 lỗi căn hàng**.
- Không tạo GIS store/context/dataset mới, không đọc repository từ presentation và không bypass view đã phân quyền.
- Không thay đổi cấu hình địa lý nhạy cảm; không thêm hoặc suy diễn vùng Hoàng Sa/Trường Sa.

## 7. Báo cáo tác nghiệp

`/analytics/reports` trình bày như văn bản nghiệp vụ thay vì collection dashboard:

- quốc hiệu và tiêu ngữ;
- cơ quan, trạng thái tài liệu và metadata;
- tóm tắt, diễn biến, thiệt hại, ứng phó, nguồn lực, sơ tán, cứu trợ;
- vấn đề cần chỉ đạo, kiến nghị và footer nguồn lập báo cáo.

Báo cáo tiếp tục lấy từ dữ liệu vận hành hiện hữu, ghi rõ “Chưa cấp số · Chưa phê duyệt”, không tạo workflow ký/phê duyệt hoặc dữ liệu giả. Browser verifier chờ nội dung report render hoàn chỉnh trước khi đo và chụp ảnh.

## 8. Trợ lý điều hành

- Giao diện là conversation workspace có phân vai câu hỏi/phản hồi, prompt gợi ý, composer, nút gửi, evidence/source và action xác nhận.
- Empty state đã bỏ tên implementation nội bộ; nội dung hiện giải thích bằng tiếng Việt rằng dữ liệu chỉ nằm trong phạm vi được phân quyền.
- Không giả LLM, streaming, confidence hoặc realtime.
- Hành động vẫn đi qua use case, xác nhận và permission boundary hiện hữu.
- Light/dark, desktop/tablet/mobile đều được chụp và kiểm tra; Axe serious/critical bằng 0.

## 9. Hồ sơ cá nhân và danh tính

- Avatar/chữ viết tắt “QT” được căn giữa chính xác trong app header, account trigger, popover và hồ sơ.
- Hồ sơ trình bày rõ tên, vai trò, đơn vị/phạm vi, trạng thái phiên và metadata; vùng avatar/action tự wrap trên màn hình hẹp.
- `src/data/identity/personnel.ts` là nguồn duy nhất, có đủ `id`, `displayName`, `role`, `title`, `organization`, `contact` và `geographicScope`.
- Các seed/application module phân giải tên qua stable personnel ID; tham chiếu trực tiếp `.displayName` ngoài registry: **0**.
- Nguồn tương thích cũ `src/data/people.ts` đã được loại bỏ; không còn nguồn danh tính thứ hai.
- Hồ sơ hiển thị thêm chức danh, đơn vị và liên hệ từ registry; giá trị chưa có nguồn được ghi trung thực là “Chưa cập nhật”.
- Static audit xác nhận duplicate hard-coded personnel literal: **0**.

## 10. Bảng, danh sách, badge và responsive

- Wrapper bảng cần cuộn ngang có region focusable và nhãn truy cập.
- Grid/flex child quan trọng dùng `min-width: 0`, gap và wrapping phù hợp; badge không chồng text.
- Verifier đo cell nowrap overflow, row, document width và filter-child bounds trên từng route.
- Kết quả: table overlap **0**, document overflow **0**, toolbar child vượt cha **0**.
- Ảnh đại diện ở 1440×900 light, 820×1180 light và 390×844 dark đã được kiểm tra qua contact sheet toàn bộ 20 trang; không phát hiện crop/overlap hoặc nội dung mất khả dụng.

## 11. Việt hóa và nội dung giao diện

- Đồng bộ tên “Phương án ứng phó” giữa sidebar, route title và page header.
- Nhật ký bảo mật giữ nguyên value nghiệp vụ `SUCCESS`, `DENIED`, `FAILED` nhưng hiển thị “Thành công”, “Bị từ chối”, “Không thành công”.
- Action/resource/permission kỹ thuật trong bảng audit được chuyển thành nhãn tiếng Việt tự nhiên.
- Đã loại chuỗi hiển thị “canonical state”, `OperationalProvider`, “Seed” và “Tick”; thay bằng nhãn nghiệp vụ tiếng Việt.
- `node scripts/audit-ui-content.mjs` đạt; danh sách từ tiếng Anh/hybrid bị cấm không xuất hiện trong UI.

## 12. Static audits và quy tắc phòng hồi quy

Kết quả `node scripts/audit-system-ui.mjs`:

| Kiểm tra | Kết quả |
|---|---:|
| Native select ngoài shared | 0 |
| Native-select CSS selector | 0 |
| Nguồn `.ui-select*` | 1 (`compact-ui.css`) |
| Visual Input CSS ngoài shared source | 0 |
| Page-specific filter layout hack | 0 |
| Font-size dưới 12,5px | 0 |
| Tên người hard-code trùng ngoài registry | 0 |
| `!important` hiện hữu | 36, giảm so với baseline 38; unintentional mới = 0 |
| Negative margin dùng để căn UI | 0 |
| Personnel schema bắt buộc | Đủ 7 trường |
| Tham chiếu `.displayName` ngoài personnel registry | 0 |
| Nguồn personnel cũ/thứ hai | 0 |
| Sidebar inventory | 25 = 19 route + 6 placeholder |

Verifier được mở rộng lên đủ 6 viewport × 2 theme, kiểm tra thêm shared header, trạng thái app-header bị cấm, chevron kép và map alignment.

## 13. Browser matrix và kiểm tra trực quan

Chrome chạy thật với các viewport **1440×900, 1280×800, 1024×768, 820×1180, 390×844, 375×812**, mỗi viewport ở light và dark. Ma trận gồm 240 lượt route chính, 180 lượt route chi tiết và 66 lượt trạng thái tương tác.

| Chỉ số | Kết quả |
|---|---:|
| Route chính | 240/240 PASS |
| Route chi tiết | 180/180 PASS |
| Dialog/drawer/menu/sidebar/AI | 66/66 PASS |
| **Tổng** | **486/486 PASS** |
| Failures | 0 |
| Axe serious/critical | 0 |
| Document overflow | 0 |
| Native select hiển thị | 0 |
| Toolbar problem | 0 |
| Dropdown clipping/viewport | 0 |
| Shared-header problem | 0 |
| Trạng thái app-header bị cấm | 0 |
| Double chevron | 0 |
| Map alignment problem | 0 |

Lượt mở rộng đã phát hiện và sửa các lỗi mà ma trận route ban đầu chưa bắt được: composer Trợ lý bị co còn 22px trên mobile, action header trang chi tiết bị cắt ở 820px, nút bản đồ thiếu accessible name, tương phản ở trang chi tiết/drawer/popover, nút đóng dialog không có tên và chuỗi UI “Incident”, “tick”, “engine”, “ownership”.

Đã tạo 12 contact sheet route chính, 24 contact sheet cho detail/interaction và giữ 6 ảnh “before” đại diện. Lượt “after” cuối là nguồn bằng chứng chính và đã được kiểm tra trực quan sau khi cả hai verifier sạch.

## 14. Bảo toàn kiến trúc và final gates

Đợt sửa không tạo Store/Context/EventBus, không duplicate canonical state, không thay RBAC/permission matrix, không bypass mutation boundary, không đổi seed/business relationship và không triển khai module P2/P3 ngoài scope. Authorization địa lý vẫn xảy ra trước presentation.

| Gate | Kết quả |
|---|---|
| `npm test` | **286/286 PASS** |
| `npm run test:focused` | **47/47 PASS** |
| `tsc -b` | **PASS** |
| `oxlint --deny-warnings` | **0 warnings / 0 errors** |
| `vite build` | **PASS**, 1986 modules |
| `git diff --check` | **PASS** |
| UI content audit | **PASS** |
| System UI audit | **PASS** |
| Chrome route matrix | **240/240 PASS** |
| Chrome detail matrix | **180/180 PASS** |
| Chrome interaction matrix | **66/66 PASS** |
| **Tổng visual/a11y** | **486/486 PASS** |

Build còn hai cảnh báo không chặn đã có từ kiến trúc bundle: alerts vừa có import tĩnh/động và MapLibre chunk lớn hơn 500 kB. Không cảnh báo nào là lỗi build hoặc hồi quy giao diện.
