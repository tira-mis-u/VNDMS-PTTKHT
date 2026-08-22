# Unified Operational Map — Completion Report

## 1. Tổng quan kiến trúc

Module mới **Bản đồ tác nghiệp** (`/workspace/Bản đồ tác nghiệp`) là góc nhìn không gian
read-only của toàn bộ hoạt động response/evacuation/relief/recovery. Module tuân đúng
chuỗi phân lớp đã chốt:

```
Presentation (features/operational-map)
        ↓ props thuần, không đọc repository
Application (src/application/map/unifiedMapQueries.ts — pure functions)
        ↓ đọc từ
Authorized Operational View (createAuthorizedOperationalView trong OperationalContext)
        ↓ đọc từ
OperationalProvider — canonical state owner duy nhất
```

- Không có store/context/GIS abstraction mới; page dùng `useOperationalState()` —
  chính là authorized snapshot đã được lọc theo quyền + phạm vi địa lý.
- Không dataset song song: mọi map point dẫn 1-1 tới entity canonical qua `id`,
  resolve chi tiết bằng `findUnifiedMapDetail` trên cùng snapshot.
- Read-only: không mutation nào phát sinh từ bản đồ, nên không cần confirmation/
  resource auth/rollback mới; simulation vẫn chạy qua canonical mutation boundary
  hiện hữu và map query tự phản ánh (verified by test 10).

## 2. Query tầng application (authorized geospatial query)

`src/application/map/unifiedMapQueries.ts` — pure functions trên `OperationalSnapshot`:

- `getUnifiedMapPoints(snapshot)`: 9 loại entity có tọa độ → UnifiedMapPoint
  (`id`, `kind`, `title`, `area`, `coordinates`, `severity`, `status`, `statusTone`,
  `detailPath`). Closed entities (incident "Đã cóng…"/"Đã kiểm soát", SOS đã xử lý/
  đã đóng/từ chối/hủy, task hoàn thành/hủy, evacuation/relief đã đóng) không
  còn xuất hiện trên bản đồ bận nghiệp nghiệp vụ.
- `getUnifiedMapRoutes(snapshot)`: polyline từ `evacuationOperations.route.coordinates`,
  cờ `blocked` khi route status "Bị chặn"/"Hạn chế" → render dashed đỏ.
- `defaultUnifiedMapLayers`, `countByLayer`, `filterUnifiedMapPoints`
  (search id/title/area + severity + layer map), `visibleUnifiedMapRoutes` (routes
  chỉ hiển thị cùng evacuation points đang hiển thị), `getUnifiedMapDataStamp`
  (canonical event timestamp mới nhất → header "Dữ liệu nghiệp vụ đồng bộ").
- Severity hợp nhất P1–P4 → "Khẩn cấp / Cao / Trung bình / Thấp" (`sosSev`) dùng
  cho cả SOS lẫn Relief priority.

Authorization **không nằm trong query** — query nhận đúng snapshot đã qua
`createAuthorizedOperationalView`, nên out-of-scope entities không thể xuất hiện
trong kết quả (tests 3, 5, 6, 12 assert chủ động).

## 3. Layers & UI contract

Layer panel (có thể toggle từng lớp, hiển thị số lượng từng lớp trong phạm vi quyền):

| Layer | Màu | Bán kính | Lọc status |
|---|---|---|---|
| Sự cố | amber `#f79009` | 7.5 | Đang xử lý/Đang điều tra; skip đã đóng |
| SOS | đỏ `#d92d20` | 8 | Đang hoạt động; skip xử lý xong |
| Nhiệm vụ | tím `#7a5af8` | 6.5 | Skip Hoàn thành/Hủy |
| Đội cứu hộ | xanh dương `#2c72e4` | 6 | Theo operational status |
| Điểm sơ tán | xanh lá `#12b76a` | 6 | Theo capacity |
| Hoạt động sơ tán | teal `#0e7490` | 6 | Skip đã đóng |
| Yêu cầu cứu trợ | cam `#f04438`/amber | 6 | Skip closed |
| Kho vật tư | tím `#6941c6` | 6 | Hạn chế/Tạm đóng theo WarehouseStatus |
| Dự án phục hồi | xám `#475467` | 6 | Theo lifecycle |

- Routes: line layer `#0e7490` (solid) và `#d92d20` (dashed) cho tuyến bị chặn/hạn chế.
- Circle layer + white stroke 2px + symbol label (id) từ minzoom 11.2 — tránh clutter.
- Zoom toolbar (+/−/Scan-fitBounds), flyTo theo `?focus=` deep-link.
- Click circle/line → `EntityDetailDrawer` (role=dialog, Esc đóng, auto-focus nút đóng):
  loại, mã, trạng thái Badge, meta đặc thù từng kind, nút **Mở trang chi tiết** điều hướng
  sang canonical detail page (`/incidents/:id`, `/sos/:id`, `/tasks/:id`, `/teams/:id`,
  `/shelters/:id`, `/evacuations/:id`, `/relief/requests/:id`, `/relief/warehouses/:id`,
  `/recovery/projects/:id`).
- Search theo mã/tên/khu vực + lọc mức ưu tiên; kết quả render trong panel và nhảy
  tới đối tượng khi bấm.
- Header có badge "Dữ liệu nghiệp vụ đã đồng bộ · HH:mm" từ canonical timestamp.
- Empty states: từng layer rỗng → "Không có dữ liệu trong phạm vi quyền";
  toàn bộ map rỗng → overlay trên map.
- Legend tự thu theo các lớp đang bật; ký hiệu tuyến sơ tán / tuyến bị chặn riêng.
- Route sidebar hoạt + breadcrumb "Quản lý & điều hành › Bản đồ tác nghiệp" vì
  nav item có `path` trỏ thẳng route (encodeURIComponent).
- Command Center map có text-action **"Mở bản đồ tác nghiệp"** dẫn thẳng route.

GIS: reuse đúng MapLibre + `mapConfig` + OpenFreeMap + `addVietnamSeaLabels(map, "om")`
(island labels vẫn chính xác `Quần Đảo Hoàng Sa` / `Quần Đảo Trường Sa`, không nhãn biển lệch chuẩn nào khác),
`ResizeObserver` giữ canvas khớp kích thước (fix cho layout lưới 2-cột).

## 4. RBAC behavior map

| Vai trò | Kết quả query |
|---|---|
| Chỉ huy / Điều hành viên | Toàn bộ 9 lớp Hà Nội (33 đối tượng ở kịch bản Red River) |
| Cán bộ địa phương (Phạm Văn Đam — Tây Hồ) | Chỉ entity thuộc scope (Sự cố 2, SOS 1, Nhiệm vụ 2, Đội 1, Điểm sơ tán 2, Kho 1, Dự án 2; Sơ tán 0, Cứu trợ 0 và báo "Không có dữ liệu trong phạm vi quyền") |
| Đội trưởng/phó cứu hộ | Team/task/sos theo ownership từ authorized view |
| Nhân viên kho | Chỉ kho được phân; incident/SOS/sơ tán/cứu trợ rỗng |
| Công dân | Không operational layer nào |

`operational-map` map tới quyền `"view"` trong `requiredPermission` — route không từ chối
citizen (spec là về dữ liệu: citizen vào được page nhưng mọi lớp operational trả về 0).

## 5. Tích hợp & cross-links

- Router: union member `{ name: "operational-map"; focus: string | null }`,
  `parseRoute(pathname, search)` đọc `?focus=` bằng `URLSearchParams`; App.tsx giữ
  cả pathname+search trong state nên popstate/refresh/deep-link giữ nguyên focus.
- `OPERATIONAL_MAP_WORKSPACE_PATH` export để Command Center cross-link.
- Detail navigation reuse `navigate` của App shell → canonical pages, không copy UI.

## 6. Tests (12 focused — `tests/application/unified-operational-map.test.ts`)

1. Query đọc đúng canonical entities có tọa độ, mọi point resolve detail.
2. Commander đủ layer.
3. Local Officer geo-filter (không thấy INC-0234 Long Biên).
4. Rescue ownership bảo toàn sau authorized view.
5. Warehouse role chỉ thấy kho được phân; incident/sos rỗng.
6. Citizen bị từ chối toàn bộ operational layers.
7. Click map → detailPath canonical cho cả 9 kinds.
8. Layer toggle + search + severity filter trong tập authorized.
9. Không duplicate id/kind; không dataset phụ.
10. 13 simulation ticks → canonical mutation thay đổi points/routes.
11. Tuyến bị chặn → `blocked`, ẩn cùng lớp evacuation khi tắt.
12. `findUnifiedMapDetail` không resolve được entity ngoài scope (no-leak).

Toàn bộ chạy trong context composer (`inMemoryOperationalRepository.load()` +
`createAuthorizedOperationalView`), không chạm presentation.

## 7. Validation gates

| Gate | Kết quả |
|---|---|
| `npm test` | 281 pass / 0 fail |
| `npm run test:focused` | 46 pass / 0 fail (đã thêm file mới vào script) |
| `npm run typecheck` (tsc -b) | 0 lỗi |
| `npm run lint` (oxlint) | 0 warning, 0 error |
| `npm run build` | ✓ built (không đổi bundler) |
| Route smoke + deep-link refresh (`vite preview` 4180) | 200 cho root và `/workspace/Bản đồ tác nghiệp?focus=SOS-0241` (SPA fallback) |
| Browser verification (Puppeteer) | Light + dark render, click marker → drawer → canonical detail route (`/recovery/projects/RP-0242`), deep-link focus mở drawer đúng SOS-0241, layer toggle cập nhật counts, officer scope + empty states đúng, mobile 480px collapse sidebar + panel |

## 8. Giới hạn còn lại / hàm ý sang scope khác

- Damage Assessment có tọa độ nội bộ nhưng chưa được kéo vào map vì thuộc trục
  Recovery/six operational layers đã chốt trong spec — có thể bổ sung sau này mà
  không đổi query contract.
- Không clustering: số point nhỏ, label-id chỉ bật từ mức zoom 11.2 nên chưa
  cần (spec yêu cầu "chỉ khi thật sự cần").
- Không có mutation từ map; khi cần (ví dụ vẽ tuyến, gán đội trên bản đồ) phải
  đi qua mutation boundary: confirmation → re-read authorized state → resource/
  lifecycle auth → rollback + audit.
- Pre-existing UI typo "ngườii dùng" trong `alertUseCases` và comment file khác
  nằm ngoài scope task này — đã ghi nhận, chưa sửa để không lấn scope.
- MapLibre preview trong sandbox có flake về composite trong screenshot fullscreen
  nhưng DOM/canvas đều xác nhận đúng kích thước và nội dung.

## 9. Ngoài scope — các module khác

Hazard Situation (`/workspace/Tình hình thiên tai`), History, Trends, Configuration,
các module placeholder khác và các P2/P3 đã liệt kê vẫn giữ nguyên — không động tới
trong task này.
