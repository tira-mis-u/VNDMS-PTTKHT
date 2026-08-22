# VNDMS — Evacuation Operations Workspace: Completion Report

Ngày hoàn thành: 22/08/2026 · Phạm vi: mở module **Sơ tán** thành workspace truy cập được từ sidebar theo đúng phương án đã phê duyệt trong `module-completion-inventory.md`.

## 1. Tóm tắt

Trước thay đổi, nghiệp vụ sơ tán đã có đầy đủ domain rules, application use cases, canonical state (`evacuationOperations`, `evacuationEvents`), Provider commands và RBAC, nhưng không có route riêng — chỉ truy cập được ở dạng nhúng trong Shelter detail, còn menu "Sơ tán" dẫn tới placeholder.

Thay đổi này bổ sung đúng **lớp truy cập module**: worklist `/evacuations`, detail `/evacuations/:id`, navigation, query layer dùng chung và cross-link từ Alerts/Command Center/Shelter — tái sử dụng 100% canonical evacuation state/use cases/`OperationalMutationBoundary`/authorized operational view/permission matrix hiện hữu. Không tạo store, context, event bus, entity, permission matrix hay state song song mới; không refactor module ngoài phạm vi.

## 2. Files tạo mới

| File | Vai trò |
|---|---|
| `src/application/evacuations/evacuationQueries.ts` | Query layer: filters/sort/summary, `EvacuationView` read model, khuyến nghị suy ra, cross-link alerts, permission map, `evacuationDetailPath` |
| `src/features/evacuations/pages/EvacuationListPage.tsx` | Worklist: summary cards, search + 5 bộ lọc, hàng hoạt động với progress/entity links/alert chip |
| `src/features/evacuations/pages/EvacuationDetailPage.tsx` | Detail: action bar theo lifecycle + quyền, hero tiến độ, điểm cần xử lý, linked Incident/Shelter/Team, tuyến, cảnh báo liên quan, nhật ký |
| `src/features/evacuations/components/EvacuationActionDialogs.tsx` | Dialog phân công đội / cập nhật tiến độ / cập nhật tuyến / chuyển hướng — gọi đúng store commands hiện hữu |
| `src/features/evacuations/index.ts` | Barrel export cho lazy routes |
| `src/styles/evacuations.css` | Styles theo design system hiện hữu + dark mode + responsive |
| `tests/application/evacuation-workspace.test.ts` | 13 test query/permission/authorized-read/cross-link |
| `tests/integration/evacuation-cross-module.test.ts` | 4 test propagation: canonical change → alerts tự xuất hiện/hết hiệu lực, đồng bộ team, pruning theo phạm vi |

## 3. Files chỉnh sửa (tối thiểu, không thay đổi hành vi ngoài phạm vi)

| File | Thay đổi |
|---|---|
| `src/app/routes/router.ts` | Thêm `evacuation-list`/`evacuation-detail`, parse `/evacuations[/:id]`, active label "Sơ tán" |
| `src/app/App.tsx` | Lazy import 2 page, route guard `evacuation_view`, render routes |
| `src/components/navigation/navigationConfig.ts` | Menu "Sơ tán" gắn `path: "/evacuations"` (không còn placeholder) |
| `src/main.tsx` | Import `evacuations.css` |
| `src/domain/alerts/rules.ts` | Cross-link: evacuation alert `sourcePath` từ `/shelters/:id` → `/evacuations/:id` |
| `src/features/command-center/components/ResourceExceptions.tsx` | Exception "Sơ tán" điều hướng tới `/evacuations/:id` thay vì shelter |
| `src/features/shelters/pages/ShelterDetailPage.tsx` | Nút "Chi tiết" mở trang hoạt động sơ tán cạnh các dialog nhúng hiện hữu |
| `tests/README.md` | Bổ sung 2 dòng mô tả test mới |

Không đụng tới: domain/application use cases sơ tán (đã hoàn chỉnh), snapshot, repository, seed, permission matrix, mutation boundary, simulation engine, AI, analytics.

## 4. Kiến trúc dữ liệu (giữ nguyên ràng buộc)

- **Canonical State → Authorized View → Application Queries → Presentation**: pages đọc `store.evacuationOperations/evacuationEvents/incidents/shelters/teams/alerts` — tất cả đã qua `createAuthorizedOperationalView`. Scope địa bàn/ownership do view hiện hữu quyết định; module không tự lọc lại quyền.
- **Mutations**: mọi thao tác (chuyển trạng thái, phân công, tiến độ, tuyến, chuyển hướng) gọi store commands hiện hữu (`transitionEvacuation`, `assignEvacuationTeam`, `updateEvacuationProgress`, `updateEvacuationRoute`, `redirectEvacuation`) — vốn đã `enforcePermission` (evacuation_approve/assign/update/complete/cancel) + ghi `EvacuationEvent` qua mutation boundary. UI chỉ disable/tooltip; lỗi từ boundary hiển thị inline (`role="alert"`).
- **Lifecycle** theo đúng `evacuationTransitions` domain; tạo hoạt động mới vẫn ở Shelter detail (single entry point, không nhân đôi luồng tạo).
- Tạo/liên kết từ SOS hoặc Playbook step vào `/evacuations/:id` mới đã hoạt động tự nhiên vì cùng canonical ID.

## 5. Tích hợp

- **Alerts**: alert sơ tán trỏ về `/evacuations/:id`; detail page hiển thị "Cảnh báo liên quan" (read-only) link tới alert detail; worklist có chip số cảnh báo. Khi điều kiện nghiệp vụ được xử lý qua mutation boundary (ví dụ khôi phục tuyến + triển khai lại), cảnh báo tự hết hiệu lực — có test chứng minh.
- **Command Center**: mục ngoại lệ "Sơ tán … đang chậm/bị chặn" điều hướng tới detail route mới.
- **Shelter**: Shelter detail có nút mở detail hoạt động; các dialog nhúng cũ vẫn hoạt động nguyên trạng.
- **Simulation**: tick/reset thay đổi canonical state → worklist/detail/alerts propagate tự nhiên (không có state riêng để lệch).

## 6. UI/UX

- Design system hiện hữu: `Badge`, `Button`, `Progress`, `EmptyState`, class `content-section`, `incident-search`, `filter-select`, dialog `incident-form-dialog`; icon Lucide; toàn bộ nhãn tiếng Việt.
- Dark mode: override `html[data-theme="dark"]` trong `evacuations.css`.
- Responsive: breakpoint 900px (grid detail → 1 cột), 640px (row dọc, actions chuyển hàng, dt/dd xếp chồng).
- A11y: row mở detail bằng `role="button" tabIndex={0}` + Enter/Space + `focus-visible`; `aria-label` trên select/search/dialog; inline error `role="alert"`; ghi chú read-only `role="note"`; tất cả thao tác có `title` giải thích khi bị disable.

## 7. RBAC (xác minh bằng test)

- Route guard: `evacuation_view` cho cả 2 route; tài khoản không quyền nhận AccessDeniedPage.
- Commander/operator (quốc gia): thấy đủ 3 hoạt động seed; local officer/rescue leader/rescue member/warehouse staff: 0 hoạt động trong seed hiện tại — đây là hành vi đúng của authorized view hiện hữu (quan hệ incident→địa bàn, team→ownership), không phải module che dữ liệu; worklist hiển thị empty state trung thực.
- Permission map UI khớp ma trận: `evacuation_approve` chỉ commander/operator có; hoạt động đã kết thúc khóa mọi thao tác.

## 8. Quality gates (kết quả cuối)

| Gate | Kết quả |
|---|---|
| `npm test` | **245/245 pass** (227 hiện hữu + 18 mới) |
| `npm run test:focused` | **34/34 pass** |
| `oxlint` | 0 warnings / 0 errors |
| `tsc -b` + `vite build` | Pass (chỉ warning chunk-size MapLibre và dynamic-import đã tồn tại trước) |
| SSR smoke (renderToString) | 6 trường hợp: list, list rỗng (scoped role), detail, detail not-found, dialog progress, dialog redirect |
| Route smoke (dev server) | 200: `/evacuations`, `/evacuations/EVAC-002`, regression `/alerts`, `/shelters/TH-02`, `/` |

Static scan: không NotificationContext/AlertStore/Event Bus/permission matrix thứ hai; không emoji; một provider, một matrix, một auth engine — giữ nguyên từ module trước.

## 9. Known limitations (không che giấy)

- Dữ liệu demo chỉ có 3 hoạt động sơ tán thuộc kịch bản lũ sông Hồng; vai trò phạm vi hẹp thấy worklist rỗng (đúng RBAC, nhưng demo cho vai trò đó sẽ thiếu nội dung cho tới khi có seed phù hợp).
- Bản đồ tuyến không được vẽ lại ở workspace: route polyline vẫn chỉ hiển thị trong bản đồ nhúng của Shelter detail (Unified Operational Map là module P1 riêng; không kéo vào scope này để tránh duplicate GIS surface).
- `EvacuationEvent.timestamp` seed dùng định dạng giờ ("10:38"), event mới dùng datetime đầy đủ — nhật ký hiển thị theo thứ tự lưu trữ (mới nhất trước), không re-sort để tránh so sánh chuỗi sai.
- Khuyến nghị trong "Điểm cần xử lý" là quy tắc suy ra cố định (blocked/no-team/overdue/slow), không phải engine khuyến nghị tổng quát.
- Quick action "Sơ tán" của Command Center vẫn là dialog stub thuộc backlog P1 "Command Center operational actions" — ngoài phạm vi module này.

## 10. Cách kiểm chứng nhanh

1. `npm test && npm run test:focused` — 245 + 34 pass.
2. Đăng nhập commander → sidebar "Sơ tán" → `/evacuations`: EVAC-002 (tạm dừng/tuyến chặn) xếp đầu; chip cảnh báo vàng.
3. Mở `/evacuations/EVAC-002`: thử "Cập nhật tiến độ" vượt 180 → lỗi inline; "Phân công đội" → chọn đội sẵn sàng → timeline có sự kiện, alert chip cập nhật.
4. Từ `/alerts`, mở cảnh báo "Sơ tán EVAC-002 …" → "Mở Hoạt động sơ tán" → về đúng detail route.
5. Đổi tài khoản local officer → `/evacuations` hiển thị empty state (đúng phạm vi), sidebar vẫn truy cập được nhưng không rò dữ liệu.

Module inventory cập nhật: **Sơ tán = DONE**. Trạng thái này phản ánh source tại thờii điểm report; các hạng mục P1/P2 khác (Command Center actions, Unified Map, Hazard Situation, Tái thiết nav, History, Trends, Config) không thay đổi và nằm ngoài phạm vi lần này.
