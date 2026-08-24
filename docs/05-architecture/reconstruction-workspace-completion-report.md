# Reconstruction Workspace completion report

Ngày hoàn tất: 23/08/2026  
Route sản phẩm: `/workspace/Tái thiết`

## 1. Quyết định product

**Chọn route alias:** `/workspace/Tái thiết` → cùng canonical Recovery Projects experience đang được dùng bởi `/recovery/projects`.

Không tạo `ReconstructionWorkspacePage` vì audit xác nhận list/detail Recovery Project hiện hữu đã có đầy đủ capability cần cho menu Tái thiết. Một page composition mới sẽ lặp lại cùng query, trạng thái, bộ lọc và liên kết mà không tạo thêm giá trị nghiệp vụ.

Alias giữ nguyên URL `/workspace/Tái thiết` khi refresh/deep-link, nhưng parser trả cùng route identity `recovery-project-list`. Khi người dùng mở một dự án, URL chuyển về canonical detail `/recovery/projects/:id`.

## 2. Audit trước implementation

### 2.1 Capability tại `/recovery/projects`

List hiện hữu đã có:

- tổng số dự án quá hạn và rủi ro ngân sách;
- tìm theo mã, tên, khu vực hoặc đơn vị phụ trách;
- lọc trạng thái, ưu tiên, nhóm dự án, khu vực, sự cố, phụ trách và quá hạn;
- sắp xếp theo quá hạn → ưu tiên → rủi ro ngân sách → tiến độ;
- ngân sách phê duyệt/ước tính, chi phí, tỷ lệ sử dụng, tiến độ, hạn và phụ trách;
- điều hướng canonical tới `/recovery/projects/:id`.

Query source of truth là `filterRecoveryProjects` và `getRecoveryExceptions` trong `src/application/recovery/recoveryQueries.ts`. Dữ liệu lấy từ `authorizedOperationalView.recoveryProjects`, không đọc một collection Tái thiết riêng.

### 2.2 Capability của Recovery Project detail

`RecoveryProjectDetailPage` đã bao phủ:

- lifecycle Đề xuất → Đã phê duyệt → Đang thực hiện/Tạm dừng → Hoàn thành, Từ chối hoặc Đã hủy;
- phê duyệt/từ chối, khởi động, tạm dừng, tiếp tục và hoàn thành;
- ngân sách ước tính/phê duyệt/đã chi/còn lại và phê duyệt ngoại lệ;
- milestone bắt buộc/tùy chọn, bắt đầu, hoàn thành hoặc bỏ qua;
- completion verification và điều kiện hoàn thành dẫn xuất;
- liên kết nhiệm vụ, đội, cứu trợ, đánh giá thiệt hại, sự cố, timeline và bản đồ;
- tạo nhiệm vụ từ dự án bằng application contract hiện hữu.

Kết luận: detail hiện hữu đủ cho menu Tái thiết; không cần page nghiệp vụ thứ hai.

### 2.3 Navigation trước sửa

Mục `Tái thiết` trong `navigationConfig.ts` có permission `recovery_project_view` nhưng không có `path`. `App.tsx` vì vậy gọi `placeholderPath(label)` và generic workspace parser trả `placeholder`.

### 2.4 Cross-link hiện hữu

Các liên kết tới canonical Recovery Project được giữ nguyên:

- Damage Assessment detail → `/recovery/projects/:id`;
- Command Center `RecoveryExceptions` → `/recovery/projects/:id` cho ngoại lệ dự án;
- Analytics operational recovery rows → `/recovery/projects/:id`;
- Incident detail, Playbook execution, AI và Unified Map cũng dùng canonical detail path;
- Recovery Project detail liên kết ngược tới assessment, incident, task, team và relief canonical routes.

### 2.5 RBAC hiện hữu

Không thêm permission mới và không thay permission matrix:

| Vai trò | Quyền Recovery Project |
|---|---|
| Chỉ huy | xem, tạo, phê duyệt, thực hiện, hủy |
| Điều hành viên | xem, tạo, thực hiện, hủy |
| Cán bộ địa phương | xem, tạo, thực hiện trong phạm vi địa lý |
| Đội trưởng cứu hộ | xem, thực hiện theo ownership |
| Thành viên cứu hộ | xem theo ownership |
| Nhân viên cứu trợ | xem |
| Nhân viên kho | không có quyền |
| Công dân | không có quyền |

`createAuthorizedOperationalView` tiếp tục lọc dự án theo Incident, assessment visibility, geographic scope và assigned team ownership. Truy cập URL trực tiếp vẫn đi qua route guard `recovery_project_view`.

### 2.6 Canonical source of truth

- Entity duy nhất: `RecoveryProject` trong `src/domain/recovery/types.ts`.
- List canonical: `/recovery/projects`.
- Detail canonical: `/recovery/projects/:id`.
- Query: `src/application/recovery/recoveryQueries.ts`.
- Lifecycle/milestone/budget use cases: `src/application/recovery/recoveryUseCases.ts`.
- Authorized read model: `createAuthorizedOperationalView`.
- State: `recoveryProjects` trong `OperationalSnapshot`/`OperationalContext` hiện hữu.
- Mutation: mọi Recovery Project command vẫn được bọc bằng `atomic(...)` và `executeAtomic(...)` của `OperationalMutationBoundary`.

## 3. Implementation

- Thêm `RECONSTRUCTION_WORKSPACE_LABEL/PATH` tại route layer.
- Parser ánh xạ `/workspace/Tái thiết` thành `recovery-project-list`, không redirect và không tạo state.
- Sidebar `Tái thiết` có path thật và active state đúng cho cả alias/list/detail.
- Không tạo page, Store, Context, Repository, EventBus, entity, lifecycle, budget, milestone hoặc permission mới.
- Giữ mọi cross-link detail ở canonical `/recovery/projects/:id`.
- Chuẩn hóa responsive Recovery Project rows thành card hai cột ở tablet/mobile thay vì bảng ngang bị cắt.
- Dùng shared warning color token cho light/dark contrast.
- Bổ sung semantic dialog (`role=dialog`, `aria-modal`, accessible close button) cho dialog Recovery Project hiện hữu.
- Việt hóa fallback `Chưa có đơn vị phụ trách`; không render raw canonical key.

## 4. Tests và architecture proof

Test mới: `tests/application/reconstruction-workspace-alias.test.ts`.

Bao phủ:

- alias và canonical list có cùng route identity;
- deep-link/active navigation;
- sidebar path và permission theo từng vai trò;
- no-leak theo geographic scope/ownership và citizen;
- cross-link từ Damage Assessment, Command Center và Analytics;
- App dùng lại `RecoveryProjectListPage`;
- Recovery mutations vẫn qua `atomic(...)`;
- chỉ có một khai báo `interface RecoveryProject`;
- không có Reconstruction Store/Context/Repository/EventBus/WorkspacePage.

Kết quả toàn suite: **291/291 tests pass**.

## 5. Visual acceptance

Chrome thật tại desktop 1440×900, tablet 768×1024 và mobile 390×844, cả light/dark:

- alias list và refresh/deep-link;
- sidebar active `Tái thiết`;
- responsive list rows;
- canonical project detail;
- Recovery Project dialog;
- warehouse access-denied/no project data leak.

Kết quả: **21 checks, 21 screenshots, 0 failures, 0 axe serious/critical**, không horizontal overflow, không native select, không technical English.

Evidence:

- `docs/05-architecture/reconstruction-workspace-evidence/reconstruction-workspace-results.json`
- `docs/05-architecture/reconstruction-workspace-evidence/*.png`

## 6. Final gates

- Typography contract: **21 routes, 0 failures**; Be Vietnam Pro và semantic size hierarchy giữ nguyên.
- Rendered content corpus gồm route Tái thiết thật: **0 technical English, 0 raw identifier, 0 typo, 0 unexpected ASCII prose**.
- UI/system architecture audit: **20 routed sidebar items, 5 placeholders**, không raw Input/Select/Textarea ngoài shared layer, không duplicate personnel source.
- TypeScript: PASS.
- Production build: PASS.
- Lint `--deny-warnings`: PASS.
- `git diff --check`: PASS.

## 7. Phạm vi không thay đổi

Không sửa hoặc triển khai Hazard Situation, Disaster History, Trends hay System Configuration. Không thay business/domain architecture của Recovery Project.
