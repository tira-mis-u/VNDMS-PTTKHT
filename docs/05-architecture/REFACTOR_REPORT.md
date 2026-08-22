# Architecture refactor and codebase organization of the existing VNDMS application

Ngày hoàn tất: 21/08/2026

## Phạm vi

Đây là refactor kiến trúc và tổ chức codebase của ứng dụng VNDMS hiện có, không phải rebuild, redesign, framework migration hay khởi tạo lại sản phẩm. React 19, TypeScript, Vite, custom History API, visual system, scenario và workflow hiện hữu được giữ nguyên.

## Vấn đề trước refactor

- `App.tsx` đồng thời sở hữu router, header, sidebar, navigation data, account/scope/theme state và page composition.
- Presentation của Command Center/Incident/Task/Team nằm chung dưới global components, quyền sở hữu feature không rõ.
- Entity, fixture, lifecycle rules và runtime mutation bị trộn trong data/context files.
- Incident Context có tên quá hẹp dù đang là store chung của Incident/Task/Team.
- Permission matrix/check nằm trong state implementation; map style, nhãn tiếng Việt và dữ liệu biển/đảo lặp ở feature maps.
- UI dùng nhiều đường dẫn tương đối xuyên tầng; tài liệu không phản ánh rõ ranh giới implemented/simulated/backend.

## Cấu trúc mới

- `src/app`: composition root và routing.
- `src/features`: presentation do Command Center, Incident, Task và Team sở hữu.
- `src/components`: layout, navigation, shared presentation và UI primitives.
- `src/application`: use cases thuần cho Incident/Task/Team.
- `src/domain`: entity, lifecycle rule, transition và calculation độc lập framework.
- `src/state/operations`: canonical React orchestration duy nhất.
- `src/infrastructure`: in-memory persistence adapter và shared GIS policy.
- `src/data/scenarios/red-river-flood`: deterministic scenario fixture.
- `src/lib/permissions`: role/permission matrix, check và mutation assertion.
- `src/styles`: stylesheet theo shell/feature.

Alias `@/*` được cấu hình đồng nhất trong TypeScript và Vite.

## Các move/split chính

- Tách `App.tsx` thành `app/App.tsx`, route parser, `AppHeader`, `AppSidebar`, navigation config và placeholder page.
- Di chuyển presentation sang `features/{command-center,incidents,tasks,teams}` và cung cấp barrel export cho mỗi feature.
- Di chuyển domain type/rule ra khỏi data và React; tách use-case operations khỏi button/page code.
- Đổi `IncidentContext` thành `OperationalContext`; tách context contract/hook khỏi Provider để ownership rõ và Fast Refresh ổn định.
- Di chuyển CSS vào `src/styles`, tài liệu module vào `docs/04-domain-model`.
- Loại bỏ map component cũ không còn tham chiếu, đường dẫn obsolete và toàn bộ thư mục rỗng tạo trong lúc tổ chức.

## Boundary và dependency direction

Presentation gọi application/state orchestration; application gọi domain; domain không import React, MapLibre hoặc browser API. Infrastructure được composition/state sử dụng như adapter. Không thêm DI framework, class hierarchy, CQRS/event sourcing, microservice hoặc database giả.

## State và workflow

`OperationalProvider` vẫn là canonical state duy nhất cho Incident/Task/Team. Initialization gọi `inMemoryOperationalRepository.load()`, trả structured clone để fixture không bị runtime mutation. Các lifecycle mutation gọi pure use cases/rules rồi đồng bộ Incident progress, Task status/update, Team readiness/current mission và timeline/field event. Không tạo competing Team store.

## Routing

Route definitions/parser/active navigation và placeholder path nằm trong `src/app/routes/router.ts`. `src/app/App.tsx` tập trung `pushState`, `popstate`, scroll reset và page composition. Custom History API/Vite được giữ nguyên; không đưa router framework khác vào.

## GIS

`src/infrastructure/gis/mapConfig.ts` tập trung OpenFreeMap style, minimum zoom, biểu thức nhãn ưu tiên tiếng Việt và GeoJSON Quần Đảo Hoàng Sa/Quần Đảo Trường Sa. Feature map chỉ sở hữu GeoJSON/layer tác nghiệp riêng. Không thay bằng SVG/mock map và không xóa toàn bộ surrounding labels.

## Permissions

`src/lib/permissions/permissions.ts` sở hữu `UserRole` mapping, permission matrix, `hasPermission` và `assertPermission`. UI có thể ẩn/disable action, nhưng canonical mutation boundary vẫn gọi assertion. Đây là client-side enforcement cho demo, không được mô tả như backend security.

## Dữ liệu và tài liệu

Scenario “Lũ Sông Hồng — Hà Nội” được tách khỏi domain và runtime state. README và architecture docs phân biệt:

- đã triển khai cục bộ: operational workflows, canonical state, rules, RBAC client, maps;
- mô phỏng: user/role, GPS và scenario deterministic, shell notification/scope;
- planned/backend: API, database, identity provider, realtime, server authorization và module placeholder.

## Test readiness

Domain rule và application use case là pure functions có thể unit test không cần DOM. `tests/README.md` ghi test matrix ưu tiên cho transition, progress, dispatch, permissions và integration của canonical provider. Không ép migrate test framework hoặc thêm abstraction rỗng.

## Nợ kỹ thuật cố ý hoãn

- Main bundle minified khoảng 1.296 MB; Vite cảnh báo chunk >500 kB. Detail maps đã lazy-load, nhưng shell/MapLibre có thể code-split thêm ở bước performance riêng.
- `OperationalContext` vẫn là orchestration point lớn để giữ mutation liên kết nguyên tử trong một store; chỉ nên chuyển sang reducer/slice thuần khi mutation tăng, không tách competing stores.
- Chưa có automated browser suite/test runner, backend persistence, multi-user sync hoặc server-side authorization.

## Kết quả kiểm tra cuối

- `npm run lint`: **0 warnings, 0 errors**.
- `npm run build`: **thành công**, 1 cảnh báo bundle-size không chặn build.
- Unicode scan: **không có emoji trong source TS/TSX/CSS**.
- Obsolete import/path scan: **0 kết quả**.
- Empty architecture directories: **0**.

Các route sau trả HTTP 200 từ Vite sau refactor và tất cả route component đã qua TypeScript/production build:

- `/`
- `/incidents`
- `/incidents/INC-0241`
- `/tasks`
- `/tasks/TSK-0241`
- `/tasks/TSK-0242`
- `/teams`
- `/teams/CH-01`

Browser back/forward vẫn được xử lý bằng listener `popstate`; navigation dùng `pushState`. Automated browser interaction suite chưa được thêm, vì vậy kiểm tra cuối này không được trình bày như một E2E test đầy đủ.
