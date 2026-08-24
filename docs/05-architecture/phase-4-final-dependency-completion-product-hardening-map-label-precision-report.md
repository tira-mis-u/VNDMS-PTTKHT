# Phase 4 — Dependency Completion, Product Hardening & Map Label Precision

**Ngày acceptance:** 24/08/2026  
**Trạng thái Phase 4:** **COMPLETED WITH DECLARED BLOCKERS**  
**Dependency audit:** [`phase-4-dependency-audit.md`](./phase-4-dependency-audit.md)  
**Master matrix:** [`master-capability-matrix.md`](./master-capability-matrix.md)  
**Inventory:** [`module-completion-inventory.md`](./module-completion-inventory.md)

## 1. Kết luận

Phase 4 hoàn tất workstream được phép triển khai và không giả lập dependency còn thiếu:

- harden runtime MapLibre dùng chung để GeoJSON/vector source tải được ổn định trong dev, production và browser automation;
- giữ đúng hai geometry `Point` có provenance cho Đảo Hoàng Sa và Đảo Trường Sa;
- neo nhãn vào Point bằng circle anchor + `text-anchor: top` + `text-radial-offset` thay đổi theo zoom, không dùng `text-offset` cố định;
- loại nhãn nền Hoàng Sa/Trường Sa có thể trùng hoặc dùng anchor khác; chỉ ưu tiên `name:vi` cho nhãn địa lý nền;
- tạo evidence Phase 4 mới cho symbol layer runtime ở zoom thấp/trung/cao trên desktop/tablet/mobile, không dùng HTML Marker thay thế;
- regression toàn bộ product hardening, route/detail/overlay/interactions, light/dark, RBAC, accessibility, tiếng Việt, typography, form controls, personnel registry và kiến trúc canonical;
- giữ nguyên năm capability nghiệp vụ `BLOCKED` vì dependency thật chưa tồn tại.

Không có capability blocked nào được nâng trạng thái bằng seed, localStorage, chart ngẫu nhiên, workflow giả, forecast hard-code hoặc geometry ước lượng.

## 2. Dependency completion status

| Capability | Trạng thái cuối | Dependency còn thiếu | Quyết định |
|---|---|---|---|
| Cấu hình hệ thống | **BLOCKED — thiếu backend/persistence và product contract** | Schema/default/validation đầy đủ; persistence; version/concurrency; audit; conflict/rollback | Giữ blocked state; không thêm form lưu giả |
| Quan trắc/dự báo hiểm họa | **BLOCKED — thiếu dữ liệu và product contract** | Authoritative observation/forecast source; freshness/unit/failure contract | Không tạo dữ liệu hoặc realtime giả |
| Kho lịch sử thiên tai dài hạn | **BLOCKED — thiếu backend/persistence** | Archive/import/retention và historical canonical persistence | Không tạo history store song song |
| Xu hướng/dự báo dài hạn | **BLOCKED — thiếu dữ liệu** | Longitudinal baseline, phương pháp, provenance và uncertainty | Chỉ giữ xu hướng tác nghiệp từ timestamp canonical hiện hữu |
| Phát hành/phê duyệt báo cáo | **BLOCKED — thiếu product contract** | Numbering, approval, signature, authorization, lifecycle, concurrency, audit | Giữ “Chưa cấp số · Chưa phê duyệt”; không thêm nút/workflow giả |
| Nhãn Point Hoàng Sa/Trường Sa | **DONE — phạm vi Point-label** | Đủ source, CRS, conversion, Point geometry và runtime evidence | Harden shared layer + verification mới |
| Geometry chính xác của hai quần đảo | **BLOCKED — thiếu dữ liệu GIS có thẩm quyền** | Geometry được phê duyệt và tải được | Không dựng polygon/ellipse/extent/bbox/centroid |
| Product hardening Phase 3 | **DONE — regression đạt** | Không có dependency mới | Không tái triển khai hoặc phá Reconstruction Workspace |

`PARTIAL`: không có capability nào được dùng trạng thái này để che dependency thiếu. Phạm vi Point-label đã hoàn tất; geometry quần đảo được tách thành blocker độc lập.

## 3. Map label precision

### 3.1 Provenance và geometry

| Nhãn runtime | Point EPSG:4326 | Tọa độ nguồn | Chuyển đổi | Ý nghĩa |
|---|---:|---|---|---|
| Quần đảo Hoàng Sa | `[111.601944, 16.533333]` | `16°32′00″B, 111°36′07″Đ` | DMS → decimal | Tọa độ Đảo Hoàng Sa được nguồn nêu tên; không phải centroid quần đảo |
| Quần đảo Trường Sa | `[111.931944, 8.641667]` | `8°38′30″B, 111°55′55″Đ` | DMS → decimal | Tọa độ Đảo Trường Sa được nguồn nêu tên; không phải centroid quần đảo |

- Metadata runtime ghi ngày truy cập nguồn: `23/08/2026`; nguồn được kiểm tra truy cập lại trong audit Phase 4 ngày `24/08/2026`.
- Nguồn Hoàng Sa: cổng thông tin chính thức thành phố Đà Nẵng.
- Nguồn Trường Sa: Công an Hà Tĩnh, danh sách đảo Việt Nam kiểm soát.
- Catalog MONRE cho dữ liệu VN-2000 tỷ lệ 1/50.000 đã được ghi nhận nhưng endpoint không trả geometry khả dụng trong Phase 4.
- `VIETNAM_SEA_LABELS` chỉ có 2 feature và geometry type duy nhất là `Point`.

### 3.2 Rendering contract

Implementation dùng chung tại `src/infrastructure/gis/mapConfig.ts`:

- symbol label bám source Point với `text-anchor: top`;
- `text-radial-offset` giảm dần theo zoom `3 → 12`, nên nhãn tiến sát Point ở zoom cao thay vì drift do offset màn hình cố định;
- không có `text-offset` trên sea-label layer;
- circle anchor thể hiện chính Point có nguồn và không mang nghĩa tâm/extent/đường biên;
- custom label luôn được render; alias nhãn nền Hoàng Sa/Trường Sa bị loại khỏi base symbol expression để tránh duplicate anchor;
- nhãn nền chỉ dùng `name:vi`, không fallback sang `name:en`, `name:latin` hoặc local multilingual label;
- custom glyph stack dùng `Noto Sans Bold`, đúng glyph endpoint của base style, không còn request font 404;
- MapLibre worker được vendor từ dependency `maplibre-gl@6.4.1` tại `public/maplibre/` để source thực sự tải ở dev/build/browser.

### 3.3 Evidence

`phase-4-evidence/map-label-precision/phase-4-map-label-precision.json`:

- **18/18 PASS** = 2 địa danh × 3 zoom × 3 viewport;
- viewport: 1440×900, 768×1024, 390×844;
- mỗi check xác nhận source có 2 Point, target circle anchor và target symbol label đều được render, projected Point nằm đúng tâm view, không có fixed `text-offset`, duplicate base alias bị suppress;
- `runtimeEvidenceUsesHtmlMarker: false`;
- có 18 screenshot riêng theo địa danh/zoom/viewport.

`phase-4-evidence/operational-map-runtime/phase-4-operational-map-runtime.json`:

- **3/3 PASS** trên product workspace thật;
- desktop light, tablet dark, mobile light;
- 0 browser error, 0 failed resource, 0 horizontal overflow;
- worker asset contract được tải; desktop map/panel cùng top/bottom và cùng chiều cao;
- screenshot cho thấy cả hai Point-label trong base map thực tế sau khi thu nhỏ tới `MAP_MIN_ZOOM`.

### 3.4 Limitation bắt buộc

Dự án **không có geometry GIS Hoàng Sa/Trường Sa có thẩm quyền đã tải và phê duyệt để tích hợp**. Sản phẩm chỉ hiển thị nhãn địa danh tại Point của Đảo Hoàng Sa và Đảo Trường Sa theo nguồn. Phase 4 **không biểu diễn và không tuyên bố chính xác** hình dạng, tâm, extent, bounding box, polygon, đường biên hoặc phạm vi chủ quyền của hai quần đảo.

## 4. Product hardening regression

### 4.1 Route, theme và viewport

`phase-4-evidence/routes/route-matrix-results.json`:

- 26 routes;
- 6 viewport: 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844;
- light + dark;
- **312/312 checks PASS**;
- 0 Axe serious/critical;
- 0 horizontal overflow;
- 0 native select;
- 0 toolbar, dropdown, section-header, double-chevron, map-alignment, font-family, control measurement hoặc select text/icon failure;
- 0 rendered forbidden technical-English finding trong matrix.

### 4.2 Details, dialogs, drawers và interaction states

- `phase-4-evidence/interactions/interaction-results.json`: **32/32 PASS**, 32 screenshot, Axe serious/critical = 0.
- `phase-4-evidence/detail-and-interaction/verification-results.json`: **72/72 detail + 34/34 interaction PASS** trên desktop/tablet/mobile, light/dark; Axe serious/critical = 0.
- Bao phủ canonical detail routes, alert detail, dialogs, user drawer, AI conversation, loading state và report product structure.

### 4.3 RBAC

`phase-4-evidence/rbac/rbac-route-matrix.json`:

- 6 authenticated roles × 25 direct routes;
- **150/150 PASS**;
- 0 menu/direct-route authorization mismatch.

### 4.4 Language, typography, forms, personnel và architecture

- Rendered corpus: 26 route entries + 32 interaction entries, 175.426 ký tự; 0 technical English, raw identifier, typo hoặc unexpected ASCII prose finding.
- Typography audit: 21 routes, 0 failure; contract giữ Be Vietnam Pro và semantic sizes 30/18/16/14/13.5/13/12.5 px.
- Static UI audit: 0 native select ngoài shared control, 0 raw input/textarea ngoài shared primitives, 0 page-specific filter hack, 0 negative margin, 0 hard-coded font family, 0 estimated island geometry, 0 fake realtime claim, 0 duplicate personnel name.
- Architecture audit: **11/11 PASS**; một Operational Context canonical, không `Math.random`, WebSocket/EventSource giả, geometry ước lượng, persistence localStorage ngoài allowlist hoặc personnel source song song.
- Báo cáo tác nghiệp tiếp tục có cấu trúc tài liệu và công bố đúng trạng thái chưa phát hành/phê duyệt.

## 5. Quality gates

| Gate | Kết quả |
|---|---:|
| Full tests | **297/297 PASS** |
| Focused tests | **53/53 PASS** |
| TypeScript `tsc -b` | **PASS** |
| Lint `--deny-warnings` | **0 warning, 0 error** |
| Production build | **PASS** |
| Browser route matrix | **312/312 PASS** |
| Detail/interaction matrix | **72/72 + 34/34 PASS** |
| Focused product interactions | **32/32 PASS** |
| RBAC route matrix | **150/150 PASS** |
| Map Point-label matrix | **18/18 PASS** |
| Product runtime map | **3/3 PASS** |
| Axe serious/critical | **0** |
| Static architecture/UI/language/typography/personnel/form/map/provenance | **PASS** |
| `git diff --check` trước report | **PASS** |

Build còn advisory không chặn về một dynamic import đã có static consumer và chunk lớn hơn 500 kB; build exit code 0. Không thay test để làm xanh.

## 6. Evidence index

- `docs/05-architecture/phase-4-evidence/routes/`
- `docs/05-architecture/phase-4-evidence/interactions/`
- `docs/05-architecture/phase-4-evidence/detail-and-interaction/`
- `docs/05-architecture/phase-4-evidence/rbac/`
- `docs/05-architecture/phase-4-evidence/map-label-precision/`
- `docs/05-architecture/phase-4-evidence/operational-map-runtime/`
- `docs/05-architecture/phase-4-evidence/static/`
- `docs/05-architecture/phase-4-evidence/rendered-text-corpus.json`
- `docs/05-architecture/phase-4-evidence/rendered-language-review.json`
- `docs/05-architecture/phase-4-evidence/typography-contract.json`

## 7. Final acceptance statement

Phase 4 được chấp nhận cho phạm vi dependency thực sự tồn tại. Product hardening và Point-label precision đã đạt toàn bộ gate mới. Năm capability nghiệp vụ cùng authoritative archipelago geometry vẫn được công bố `BLOCKED` đúng nguyên nhân; không có claim hoàn tất vượt quá dữ liệu, persistence hoặc product contract hiện hữu.
