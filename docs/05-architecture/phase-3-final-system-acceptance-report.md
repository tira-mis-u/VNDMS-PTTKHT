# VNDMS — Phase 3 Final System Acceptance Report

**Ngày acceptance:** 24/08/2026  
**Phạm vi:** toàn bộ sidebar, route chính/detail, canonical read/mutation boundaries, RBAC, provenance, UI foundation, tiếng Việt, personnel, responsive, accessibility và interaction.  
**Nguồn trạng thái:** [`master-capability-matrix.md`](./master-capability-matrix.md) và [`module-completion-inventory.md`](./module-completion-inventory.md).

## 1. Kết luận phạm vi

Phase 3 hoàn tất các capability có đủ canonical data/contract và giữ trạng thái `BLOCKED` trung thực cho capability chưa có dependency. Không tạo Store, Context, Repository, EventBus, permission matrix, personnel registry, GIS dataset, history database, realtime, forecast hoặc settings persistence song song.

Kết quả:

- 25/25 mục sidebar có route contract rõ ràng; không còn navigation destination dùng generic placeholder.
- 24 capability sidebar có contract hiện hữu đạt acceptance trong phạm vi được mô tả ở master matrix.
- Cấu hình hệ thống tiếp tục `BLOCKED` với blocked state trung thực.
- Quan trắc/dự báo hiểm họa, archive dài hạn, forecast dài hạn và phát hành/phê duyệt báo cáo tiếp tục `BLOCKED`.

## 2. Kiến trúc và dữ liệu

Read flow được giữ nguyên:

```text
Presentation
→ Application Query / Use Case
→ Authorized Operational View
→ Canonical Operational Snapshot
```

Mutation flow được giữ nguyên:

```text
Plan / validation
→ OperationalMutationBoundary
→ permission + lifecycle re-check
→ atomic commit
→ audit / timeline
```

Các workspace Tình hình, Lịch sử và Xu hướng dùng query thuần tại `src/application/operations/operationalInsightsQueries.ts`; không đọc store trực tiếp trong query và không sở hữu dataset riêng.

Operational Snapshot chứa metadata provenance:

- scenario stable ID;
- scenario name;
- `asOf`;
- source.

Authorized Operational View bảo tồn metadata nhưng lọc toàn bộ entity/relationship theo permission, địa bàn và ownership trước khi dữ liệu tới UI.

## 3. Tình hình tác nghiệp thiên tai

Route: `/workspace/Tình hình thiên tai`.

Workspace tổng hợp từ authorized snapshot:

- sự cố đang xử lý;
- cảnh báo chờ xác nhận;
- SOS khẩn cấp;
- hoạt động sơ tán;
- đội đang điều động;
- điểm sơ tán quá tải;
- yêu cầu cứu trợ;
- tình hình theo địa bàn;
- diễn biến từ event có timestamp hợp lệ.

Mỗi KPI công bố cách tính, source, `asOf` và canonical destination. Dữ liệu simulation được gắn nhãn riêng; phần quan trắc/dự báo luôn nói rõ chưa có nguồn hiện tại và không thay bằng simulation.

## 4. Lịch sử và Xu hướng

### Lịch sử

Route `/workspace/Lịch sử thiên tai` có title nghiệp vụ trung thực: **“Lịch sử sự cố trong dữ liệu vận hành hiện tại”**.

Nguồn duy nhất: Incident đã đóng, `closedAt`, IncidentEvent và source/timestamp của hồ sơ. Có filter, empty state, invalid-time state và canonical detail link. Không tuyên bố archive nhiều năm.

### Xu hướng

Route `/workspace/Xu hướng` nhóm dữ liệu theo timestamp canonical. Mỗi point giữ source entity ID, timestamp và detail path. Khi có dưới hai kỳ, UI hiển thị **“Chưa đủ dữ liệu để xác định xu hướng”**; không tạo tỷ lệ, baseline, nội suy hoặc forecast giả.

## 5. Báo cáo và Phân tích

Report builder không còn actor hoặc timestamp mặc định. Contract nhận `ReportActor` từ authenticated stable ID, resolve display name qua personnel registry, và nhận `asOf` từ authorized snapshot metadata.

Báo cáo hiển thị:

- đơn vị lập;
- tên báo cáo;
- số/ký hiệu “Chưa cấp số”;
- người lập + stable ID;
- thời điểm lập;
- mốc dữ liệu;
- kỳ/phạm vi;
- tóm tắt, tình hình, số liệu, đánh giá;
- source và data policy;
- ghi chú đối soát;
- trạng thái “Chưa cấp số · Chưa phê duyệt”.

Timestamp record không hợp lệ bị loại khỏi kỳ và surfaced trong report audit; timestamp dạng giờ chỉ được resolve bằng ngày của canonical parent record.

Toàn bộ Analytics hiển thị mốc dữ liệu, nguồn và thông báo không phải dữ liệu thời gian thực. Recorded metrics và derived metrics tiếp tục được phân biệt bằng presentation mapping.

## 6. Route và RBAC

`/workspace/Phân quyền` là composition của User Administration hiện hữu, dùng cùng users, role/scope mutations, permission matrix, drawer và security audit. Route guard là `user_manage`; authorization chạy trước khi lazy page render.

Browser RBAC matrix kiểm tra 6 tài khoản demo × 25 route:

- Commander;
- Operator;
- Local Officer;
- Rescue Leader;
- Rescue Member;
- Warehouse Staff.

150/150 menu/direct-route checks không có mismatch. Citizen denial được bao phủ trong application authorization/no-leak tests vì demo credentials không có Citizen account đăng nhập.

`/admin/audit` đồng nhất tên **Nhật ký bảo mật**. Canonical action/resource/result/permission keys được giữ ở code và qua nhãn presentation tiếng Việt.

## 7. Shared UI foundation

System dùng Be Vietnam Pro được vendor local, một semantic token system và shared primitives cho Input, Textarea, Select, Button, PageSectionHeader, dialog backdrop và status components.

Static system audit xác nhận:

- native Select ngoài shared primitive: 0;
- raw Input/Textarea ngoài shared primitive: 0;
- Select CSS owner: đúng một shared source;
- page-specific visual Input CSS: 0;
- negative margins: 0;
- hard-coded font family ngoài token: 0;
- default black border/outline: 0;
- estimated island geometry references: 0;
- fake realtime UI references: 0;
- duplicate hard-coded personnel names: 0.

Shared Select được sửa placement theo kích thước menu và không gian thật phía trên/dưới; dropdown dài ở cuối trang mobile 430×932 không còn tràn viewport.

## 8. Tiếng Việt và personnel

Rendered-language audit thu toàn bộ innerText và CSS pseudo-content trên route/interaction corpus, kiểm tra technical English, raw identifier, lỗi chính tả và ASCII prose theo ngữ cảnh. Kết quả: 0 finding.

Mọi tên người runtime tiếp tục đi qua `src/data/identity/personnel.ts`. Report dùng `authenticated user ID → personnel registry → displayName`; không tạo registry thứ hai.

## 9. AI Assistant

`/ai-assistant` là conversation workspace deterministic grounded:

- conversation history trong session component;
- user question + assistant response;
- evidence/source links;
- recorded/derived/unknown distinction;
- suggested questions;
- composer và send action;
- confirmed action dialog;
- stale/denied/failure result;
- permission and canonical state re-check trước mutation.

UI không tuyên bố LLM, model name, streaming, confidence, realtime hoặc AI backend không tồn tại.

## 10. GIS và Hoàng Sa/Trường Sa

Không có polygon, ellipse, extent hoặc boundary suy diễn cho Hoàng Sa/Trường Sa. Runtime chỉ dùng verified point labels và provenance đã duyệt; unified map tiếp tục đọc authorized canonical entities, không có GIS state/dataset thứ hai.

## 11. Responsive, accessibility và browser evidence

### Route matrix mới

Artifact: `final-acceptance-evidence/routes/route-matrix-results.json`.

- 26 routes (25 sidebar + profile);
- 6 viewport: 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844;
- light + dark;
- 312 checks;
- 0 failure;
- 0 horizontal overflow;
- 0 toolbar overflow;
- 0 dropdown overflow;
- 0 visible native select;
- 0 header mismatch;
- 0 font family mismatch;
- 0 control measurement mismatch;
- Axe serious/critical: 0.

### Interaction/detail evidence mới

- `final-acceptance-evidence/interactions/interaction-results.json`: 32 focused normal/loading/empty/error/detail/dialog/drawer/popover/search/select/AI/report/map checks, 0 failure.
- `ui-system-full-repair-evidence/detail-and-interaction/verification-results.json`: 66 responsive overlay/interactions across 12 viewport-theme modes, 0 failure, Axe serious/critical 0.
- `final-acceptance-evidence/rbac/rbac-route-matrix.json`: 150 direct route/menu RBAC checks, 0 failure.

Keyboard Select Arrow/Home/End/Escape, dialog accessible names, drawer/dialog viewport containment, focus states and map loading state are included in interaction evidence.

## 12. Automated quality gates

- Full tests: **297/297 pass**.
- Focused tests: **53/53 pass**.
- `tsc -b`: pass.
- Lint deny-warnings: **0 warnings, 0 errors**.
- Production build: pass.
- `git diff --check`: pass.
- System UI audit: 0 failure.
- Typography audit: 0 failure across audited routes.
- Rendered language audit: 0 failure.

Build có advisory về ineffective dynamic import của Alerts và một số chunk trên 500 kB; đây không phải functional/accessibility failure và không làm thay đổi module contract.

## 13. Capability còn BLOCKED

1. **Cấu hình hệ thống có mutation** — thiếu settings schema, validation, version, concurrency, persistence và audit policy.
2. **Quan trắc/dự báo hiểm họa** — thiếu authoritative observation/forecast source.
3. **Kho lịch sử thiên tai dài hạn** — thiếu archive/import/retention/persistence contract.
4. **Dự báo xu hướng dài hạn** — thiếu longitudinal baseline và forecast source.
5. **Phát hành/phê duyệt báo cáo** — thiếu numbering, signature, approval lifecycle và audit workflow.

Các mục này không được thay bằng localStorage, constants, fake save, fake source, random data hoặc simulation.

## 14. Final status

Các capability có đủ dữ liệu và contract trong master matrix đạt `DONE` theo phạm vi thật. Các capability thiếu dependency giữ `BLOCKED`; không có module được nâng trạng thái chỉ vì route render.
