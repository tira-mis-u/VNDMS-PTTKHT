# Báo cáo hoàn tất Unified Operational Map

**Module:** Bản đồ tác nghiệp thống nhất

**Route:** `/workspace/Bản đồ tác nghiệp`

**Ngày hoàn tất:** 22/08/2026

**Trạng thái:** **DONE** — toàn bộ quality gate trong phạm vi đã đạt

## 1. Kết quả thực hiện

Workspace bản đồ tác nghiệp đã được hoàn thiện trên MapLibre/OpenFreeMap hiện hữu. Bản đồ đọc từ authorized canonical operational view và biểu diễn 33 đối tượng đang hoạt động trong kịch bản mặc định, không tạo operational GIS dataset, store, context, repository hoặc seed bản đồ thứ hai.

Các khả năng đã có:

- bản đồ chiếm vùng chính, panel lớp dữ liệu, chú giải và trạng thái dữ liệu ở header;
- tìm theo mã, tên hoặc khu vực;
- lọc mức ưu tiên và bật/tắt từng layer;
- số lượng theo layer và empty state khi không có dữ liệu trong phạm vi quyền;
- điểm tác nghiệp và tuyến sơ tán; tuyến bị chặn/hạn chế dùng nét đứt đỏ;
- click điểm hoặc tuyến để mở drawer;
- drawer có loại entity, ID, trạng thái, metadata và link tới trang canonical detail;
- deep-link `?focus=ENTITY_ID`, hỗ trợ refresh mà vẫn giữ context;
- light/dark mode và responsive desktop/tablet/mobile;
- keyboard-accessible filter, result list, drawer close/Escape và toolbar.

## 2. Kiến trúc

Luồng dữ liệu được giữ đúng boundary hiện hữu:

```text
Presentation
src/features/operational-map
        ↓
Pure geospatial application queries
src/application/map/unifiedMapQueries.ts
        ↓
Authorized Operational View
createAuthorizedOperationalView(...)
        ↓
OperationalProvider canonical state
```

`OperationalMapWorkspacePage` chỉ dùng `useOperationalState()`. Giá trị context này là authorized snapshot do `OperationalContext` tạo từ canonical state trước khi truyền vào presentation.

Các giới hạn kiến trúc đã được kiểm tra tĩnh:

- feature không import repository hoặc persistence adapter;
- feature không tự gọi authorization để lấy raw data;
- application query không import React context;
- không có file GIS Store, Context hoặc Repository trong feature;
- không có operational entity hoặc mutation mới;
- không bypass `OperationalProvider` hay `OperationalMutationBoundary`.

Bản đồ hiện là read-only. Vì không có mutation trên map nên không phát sinh confirmation/rollback contract mới. Simulation tiếp tục mutate canonical snapshot qua boundary hiện hữu; query bản đồ tự phản ánh snapshot mới.

## 3. Authorized geospatial query

`src/application/map/unifiedMapQueries.ts` cung cấp các hàm thuần:

- `getUnifiedMapPoints` — chuyển authorized canonical entities có tọa độ thành map points;
- `getUnifiedMapRoutes` — đọc polyline từ canonical evacuation route;
- `filterUnifiedMapPoints` — layer/search/severity filter trên tập đã phân quyền;
- `visibleUnifiedMapRoutes` — tuyến chỉ hiện khi operation tương ứng còn nhìn thấy;
- `countByLayer` — số lượng theo layer;
- `findUnifiedMapDetail` — resolve drawer từ authorized snapshot, trả `undefined` nếu entity không còn trong scope;
- `getUnifiedMapDataStamp` — lấy mốc sự kiện canonical mới nhất trong phạm vi quyền.

Authorization xảy ra trước presentation. Search, filter, layer toggle và drawer không thể khôi phục entity đã bị authorized view loại bỏ.

Không có map-specific source trong AI grounding và không có simulation map state riêng.

## 4. Layers và GIS

| Layer | Nguồn canonical | Detail route |
|---|---|---|
| Sự cố | `incidents` | `/incidents/:id` |
| SOS | `sosRequests` | `/sos/:id` |
| Nhiệm vụ | `tasks` | `/tasks/:id` |
| Đội cứu hộ | `teams` | `/teams/:id` |
| Điểm sơ tán | `shelters` | `/shelters/:id` |
| Hoạt động sơ tán | `evacuationOperations` | `/evacuations/:id` |
| Yêu cầu cứu trợ | `reliefRequests` | `/relief/requests/:id` |
| Kho vật tư | `warehouses` | `/relief/warehouses/:id` |
| Dự án phục hồi | `recoveryProjects` | `/recovery/projects/:id` |

Tuyến sơ tán lấy trực tiếp từ `evacuationOperations.route.coordinates`. Trạng thái `Bị chặn` hoặc `Hạn chế` được render bằng line layer nét đứt; không tạo route seed phụ.

Hạ tầng được tái sử dụng:

- `maplibre-gl` hiện hữu;
- `MAP_BASE_STYLE` của OpenFreeMap;
- `applyVietnameseMapLabels` và geographic conventions trong `mapConfig`;
- chỉ bổ sung hai nhãn `Quần Đảo Hoàng Sa` và `Quần Đảo Trường Sa` qua `addVietnamSeaLabels`;
- không thêm nhãn vùng biển ngoài hai nhãn quần đảo được yêu cầu và không vẽ polygon/vùng chủ quyền suy diễn.

Số điểm hiện tại là 33 nên chưa cần clustering. Label ID chỉ hiện từ zoom 11.2 để giảm nhiễu.

## 5. RBAC và chống rò dữ liệu

| Vai trò | Kết quả đã kiểm thử |
|---|---|
| Chỉ huy | Global visibility, đủ cả 9 layer |
| Điều hành viên | Global visibility bằng Chỉ huy trong kịch bản hiện tại |
| Cán bộ địa phương | Chỉ nhận entity thuộc scope Tây Hồ; `INC-0234` Long Biên không xuất hiện |
| Vai trò cứu hộ | Layer đội bị giới hạn theo ownership; tài khoản test chỉ thấy `CH-05` |
| Nhân viên kho | Chỉ thấy kho sở hữu `KHO-01`; không nhận Incident/SOS |
| Công dân | Query trả mảng rỗng cho toàn bộ operational layers |

No-leak test xây tập ID từ từng collection trong authorized view và xác nhận mọi map point đều thuộc đúng tập đó. Drawer cũng không resolve được entity ngoài scope.

## 6. Tích hợp và điều hướng

- Sidebar trỏ trực tiếp tới `/workspace/Bản đồ tác nghiệp`.
- Command Center có link mở workspace.
- `operationalMapFocusPath(entityId)` tạo deep-link thống nhất.
- Incident Detail, Task Detail, Team Detail, Shelter Detail, SOS Detail và Evacuation Detail có nút **Xem trên bản đồ** với đúng entity focus.
- Alert Detail có **Xem nguồn trên bản đồ** khi cảnh báo có geographic scope; focus dùng source entity và vẫn chịu authorized query.
- Click map/result/tuyến mở drawer; **Mở trang chi tiết** dẫn về canonical detail route.
- Browser test xác nhận focus `SOS-0241`, refresh giữ drawer và link mở đúng `/sos/SOS-0241`.

## 7. Focused tests

`tests/application/unified-operational-map.test.ts` có 13 nhóm kiểm tra:

1. unified query đọc đúng canonical entities có tọa độ;
2. Commander và Operator global visibility;
3. Local Officer geographic filtering;
4. rescue ownership filtering;
5. warehouse ownership filtering;
6. Citizen denial toàn bộ layer;
7. entity/detail/deep-link mapping;
8. layer, search và severity filters;
9. không duplicate map entity/dataset;
10. simulation canonical state propagation;
11. route line và blocked-route behavior;
12. data stamp, drawer no-leak và kiểm tra mọi point thuộc authorized collection;
13. static architecture scan chống Provider/repository/GIS store bypass.

Không có mutation trên map, vì vậy các test confirmation, lifecycle re-check, rollback và audit mới không áp dụng. Mutation/simulation liên quan vẫn được bao phủ bởi focused boundary tests hiện hữu.

## 8. Browser và responsive verification

Bằng chứng nằm tại `docs/05-architecture/unified-operational-map-evidence/`.

| Chế độ | Viewport | Map | Panel | Tràn ngang | Axe serious/critical |
|---|---:|---:|---:|---:|---:|
| Sáng desktop | 1440×900 | 754×648 | 650px | 0 | 0 |
| Tối desktop | 1440×900 | 754×648 | 650px | 0 | 0 |
| Sáng tablet | 820×1180 | 756×558 | 680px, nội dung cuộn | 0 | 0 |
| Sáng mobile | 390×844 | 326×558 | 680px, nội dung cuộn | 0 | 0 |

Các kiểm tra tương tác trình duyệt:

- 9 layer controls và 33 result rows được render;
- tắt layer SOS làm số kết quả giảm từ 33 xuống 30;
- deep-link `?focus=SOS-0241` mở đúng drawer;
- refresh deep-link vẫn mở đúng drawer;
- canonical detail path là `/sos/SOS-0241`;
- trạng thái header lấy từ canonical event và hiển thị “Dữ liệu vận hành được phân quyền”;
- 0 horizontal overflow;
- 0 Axe serious/critical.

## 9. Quality gates

| Gate | Kết quả cuối |
|---|---|
| `npm test` | **286/286 pass** |
| `npm run test:focused` | **47/47 pass** |
| `npm run lint` | **0 warning, 0 error trên 222 files** |
| TypeScript (`tsc -b` trong build) | **Pass** |
| `npm run build` | **Pass, 1985 modules transformed** |
| `git diff --check` | **Pass** |
| Static architecture scan | **Pass** |
| Dev browser smoke | **Pass** |
| Production preview `/` | **HTTP 200** |
| Production preview workspace route | **HTTP 200** |
| Production preview deep-link refresh | **HTTP 200** |
| Light/dark/responsive browser verification | **Pass** |

Build vẫn phát cảnh báo đã biết về alerts import tĩnh/động và chunk MapLibre lớn. Theo phạm vi yêu cầu, bundler và MapLibre infrastructure không được refactor chỉ để loại cảnh báo này.

Ứng dụng là Vite SPA, không có SSR runtime riêng; vì vậy gate tương ứng được thực hiện bằng production SPA preview, route fallback và deep-link refresh.

## 10. Limitations

- Không clustering vì 33 điểm hiện tại chưa gây quá tải; có thể bổ sung khi dữ liệu thực tế vượt ngưỡng phù hợp.
- Basemap OpenFreeMap cần kết nối mạng; canonical point/filter/drawer vẫn thuộc ứng dụng, không phụ thuộc một map dataset giả.
- Workspace read-only; thao tác trực tiếp như vẽ tuyến hoặc điều phối trên map không nằm trong phạm vi.
- Damage Assessment chưa là layer riêng; Recovery Project đã được biểu diễn khi có geographic representation.

## 11. Ngoài phạm vi

Không triển khai hoặc thay đổi nghiệp vụ cho:

- Hazard Situation;
- Disaster History;
- Trends;
- Configuration;
- các module P2/P3 khác;
- Provider, repository, event bus hoặc audit architecture mới;
- bundle architecture ngoài việc giữ lazy loading hiện hữu.

## 12. Kết luận

Unified Operational Map được đánh dấu **DONE** vì authorized query, 9 layer, RBAC/no-leak, canonical links, deep-link refresh, dark/light responsive UX, focused/full tests, lint, TypeScript, production build, production route smoke và static architecture scan đều đạt.
