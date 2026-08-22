# Completed Shelter & Evacuation Management on the existing VNDMS architecture

Ngày hoàn tất: 21/08/2026. Đây là một feature implementation tăng dần, không rebuild, redesign shell hoặc thay kiến trúc/state hiện hữu.

## 1. Files created

### Domain/application/data

- `src/domain/shelters/types.ts`, `rules.ts`
- `src/domain/evacuations/types.ts`, `rules.ts`
- `src/application/shelters/shelterUseCases.ts`, `shelterQueries.ts`
- `src/application/evacuations/evacuationUseCases.ts`
- `src/data/scenarios/red-river-flood/shelterEvacuationSeed.ts`

### Presentation

- `src/features/shelters/index.ts`
- `src/features/shelters/pages/ShelterListPage.tsx`
- `src/features/shelters/pages/ShelterDetailPage.tsx`
- `src/features/shelters/components/ShelterActionDialogs.tsx`
- `src/features/shelters/components/ShelterOperationalMap.tsx`
- `src/styles/shelters.css`

### Tests/docs

- `tests/domain/shelter-evacuation-management.test.ts`
- `tests/application/shelter-evacuation-management.test.ts`
- Bốn tài liệu module được yêu cầu và báo cáo này.

## 2. Files modified

- Routing/composition/navigation: `src/app/App.tsx`, `src/app/routes/router.ts`, `src/components/navigation/navigationConfig.ts`, `src/main.tsx`.
- Canonical state/repository/RBAC: `OperationalStateContext.ts`, `OperationalContext.tsx`, `inMemoryOperationalRepository.ts`, `permissions.ts`.
- Integration tối thiểu: Incident Detail, Team Detail/List/query, Team domain/use cases, Command Center Operational Map/Resource Exceptions.
- Scenario Team seed, README và Team tests/docs để phản ánh Evacuation assignment.

## 3. Domain/application changes

- Shelter capacity là derived state: available capacity, occupancy percentage, near-capacity và overload.
- Status không mâu thuẫn với occupancy/accessibility; điểm đóng/không thể tiếp cận/không đủ chỗ bị chặn tiếp nhận.
- Evacuation lifecycle được enforce: Dự kiến → Đã phê duyệt → Đang triển khai ↔ Tạm dừng → Hoàn thành; cancellation theo transition matrix.
- Route status hỗ trợ Thông suốt/Hạn chế/Bị chặn/Tuyến thay thế; blocked route tự tạm dừng operation.
- Các mutation mở/đóng, capacity, occupancy, resources, create/approve/assign/progress/redirect/complete/cancel đều đi qua application/domain logic và Provider RBAC assertion.

## 4. UI/routes implemented

- `/shelters`: compact list với search, status/readiness/area/capacity/occupancy/accessibility/medical/active-operation/availability filters và operational sort.
- `/shelters/:shelterId`: capacity, receiving condition, resources, officer, population/operations, Incident/Team links, route state, MapLibre và timeline.
- Actions là mutation thật: mở/đóng, capacity, occupancy, resources, tạo operation, gán Team, progress, lifecycle, route update và redirect.
- Mobile có layout riêng cho operational problems, status, active operation, action và map.

## 5. Integration changes

- **Shelter ↔ Evacuation:** reservation/occupancy/active operation/timeline đồng bộ; redirect chuyển phần reservation còn lại.
- **Evacuation ↔ Team:** dùng Team application contracts và `currentEvacuationOperation`; start đổi Team sang đang thực hiện; complete/cancel giải phóng Team.
- **Evacuation ↔ Incident:** Incident Detail hiển thị đã sơ tán/còn lại, operations và destination Shelter; Incident timeline nhận operation events.
- **Command Center:** canonical Shelter markers mở route thật; exceptions gồm quá tải, gần đầy, không tiếp cận, operation tạm dừng/route blocked.
- Không tạo ShelterContext, EvacuationContext, store, permission system hoặc GIS abstraction mới.

## 6. GIS

MapLibre dùng shared OpenFreeMap style/minimum zoom/Vietnamese labels và Quần Đảo Hoàng Sa/Quần Đảo Trường Sa. Hiển thị Shelter, source area, Incident, Team, route đang dùng, blocked route và alternative route. Geometry tuyến là deterministic demo, không phải routing/traffic backend realtime.

## 7. Permissions

Bổ sung các quyền `shelter_*` và `evacuation_*` vào RBAC hiện hữu theo Commander/Operator/Local Officer/Rescue Leader/Rescue Member/Citizen. Citizen không có operational permission. Enforcement nằm trong Provider mutation boundary.

## 8. Demo data

5 điểm quanh Tây Hồ, Hoàn Kiếm/Phúc Tân, Ba Đình và Long Biên: điểm còn chỗ, gần đầy, quá tải, không thể tiếp cận và cơ sở có năng lực y tế. 3 operations thể hiện đang triển khai, route blocked/tạm dừng và phương án dự kiến.

## 9. Tests

- Shelter/Evacuation: **13 tests pass** cho calculation, overload, readiness, transitions, assignment, Team sync, route changes, progress/release, query và RBAC.
- Toàn bộ pure regression suite Team + Shelter/Evacuation: **21 pass, 0 fail**.
- HTTP 200: `/`, `/shelters`, `/shelters/TH-01`, `/shelters/TH-03`, `/incidents`, `/incidents/INC-0241`, `/tasks`, `/tasks/TSK-0241`, `/teams`, `/teams/CH-02`.

## 10. Lint/build

- `npm run lint`: **PASS — 0 warnings, 0 errors** trên 69 files.
- `npm run build`: **PASS**; Shelter map có lazy chunk riêng.
- Cảnh báo main chunk >500 kB vẫn là known non-blocking debt.

## 11. Known limitations

- State reset khi reload; chưa có database/API/multi-user synchronization/server authorization.
- GPS, occupancy, blocked roads và route geometry là deterministic/local demo, không phải realtime feeds.
- Không có routing engine tự tính đường theo mạng giao thông; alternative route là scenario data.
- Chưa có browser automation runner; responsive/MapLibre cần visual regression trong browser có network tile access.
