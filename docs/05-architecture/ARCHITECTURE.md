# Kiến trúc ứng dụng VNDMS

## Mục tiêu

VNDMS là modular monolith phía frontend. Việc tổ chức mã tuân theo hướng phụ thuộc:

`Presentation (app, features, components) → Application use cases → Domain`

Infrastructure cung cấp adapter cho dữ liệu và GIS; lớp presentation/state sử dụng adapter, trong khi domain không phụ thuộc React, MapLibre hoặc browser API.

## Cấu trúc và quyền sở hữu

- `src/app`: composition root, phân tích route và History API.
- `src/components/layout`: header/sidebar; `navigation`: cấu hình menu; `shared`: presentation dùng chung; `ui`: primitive.
- `src/features/*`: page/component do từng feature sở hữu; barrel `index.ts` là public presentation API cho route lazy loading.
- `src/application`: use case, query và orchestration contract thuần cho toàn bộ module tác nghiệp.
- `src/domain`: entity, value type, quy tắc chuyển trạng thái và tính toán, không phụ thuộc framework.
- `src/state/operations`: orchestration React duy nhất của trạng thái Incident/Task/Team liên kết.
- `src/infrastructure/persistence`: adapter in-memory clone dữ liệu khởi tạo.
- `src/infrastructure/gis`: chính sách bản đồ, nhãn tiếng Việt và dữ liệu biển/đảo dùng chung.
- `src/data/scenarios/red-river-flood`: fixture xác định của kịch bản “Lũ Sông Hồng — Hà Nội”.
- `src/lib/permissions`: vai trò, ma trận quyền, kiểm tra và assertion tại mutation boundary.

## Trạng thái liên kết

`OperationalProvider` là canonical store duy nhất cho Incident, Task, Team, Shelter/Evacuation, SOS, Relief, Playbook, Recovery và Simulation. Provider công bố command đã được phân quyền, phối hợp use case và publish authorized canonical view. Cơ chế React aggregate state nằm trong `useAtomicOperationalState`; resource graph phân quyền, timeline writer và security/session mechanics được tách theo trách nhiệm nhưng không tạo Context hoặc state owner thứ hai. Repository chỉ chịu trách nhiệm cấp bản sao trạng thái khởi tạo, tránh mutation ngược vào fixture.

Mọi operational command được công bố đều đi qua `OperationalMutationBoundary`. Boundary clone snapshot và Simulation control vào draft, cho nested command dùng chung draft, commit đúng một lần khi thành công, hoặc bỏ toàn bộ draft rồi ném lại lỗi khi bất kỳ bước nào thất bại. Đây là atomicity cục bộ, xác định cho in-memory application state; không tương đương transaction của cơ sở dữ liệu production.

Command Center không còn operational seed/read model riêng. Các presentation components gọi pure queries tại `src/application/command-center/commandCenterQueries.ts`; mọi metric, action queue, timeline, drawer, map và exception đều đọc canonical collections đã được provider cấp. Metadata tên/phạm vi kịch bản có thể tĩnh, nhưng operational entities không được sao chép.

Raw operational state chỉ tồn tại bên trong provider. Trước khi publish qua `OperationalStateContext`, provider gọi `createAuthorizedOperationalView()` tại application query boundary. Do đó toàn bộ presentation, Analytics và AI grounding chỉ nhìn thấy collection đã được lọc theo authenticated user.

## Routing

`src/app/routes/router.ts` sở hữu route parser, active navigation label, placeholder path và 404 contract. `src/app/App.tsx` sở hữu `pushState`, `popstate`, route-level lazy loading và composition. `ApplicationErrorBoundary` cung cấp fallback cho lỗi presentation ngoài dự kiến. Không dùng router framework; custom History API hiện hữu được giữ nguyên.

## GIS

`mapConfig.ts` tập trung OpenFreeMap style, mức zoom tối thiểu, biểu thức ưu tiên nhãn tiếng Việt và GeoJSON Quần Đảo Hoàng Sa/Quần Đảo Trường Sa. Feature map vẫn sở hữu layer tác nghiệp riêng. Vector tile là dịch vụ công khai bên ngoài và cần mạng.

## Phân quyền

Read boundary dùng một authorized operational view tại application layer; collection và entity detail ngoài scope không được trả về presentation. Mutation boundary dùng cùng permission matrix và `authorizeResources()` để kiểm tra permission, geographic scope, team/warehouse ownership và toàn bộ resource liên quan trước khi thay đổi state. Security audit nhận resource type/ID thay vì generic permission boundary.

Đây vẫn là enforcement frontend/local-demo, không phải security boundary chống malicious browser client. Authentication, authorization và audit phía server, HttpOnly session, persistence và tamper-proof audit vẫn bắt buộc trước production.

## Trạng thái chức năng

### Đã triển khai cục bộ

- Workflow liên kết Incident, Task, Team, Shelter/Evacuation, SOS, Relief, Playbook và Recovery trên canonical state.
- Lifecycle rules, validation use cases, Incident closure invariant, permission assertion và timeline/field updates.
- Scenario deterministic, adapter in-memory, bản đồ MapLibre và History API.

### Mô phỏng có chủ đích

- Người dùng/role của ca trực, GPS và dữ liệu tình huống là dữ liệu local deterministic.
- Thông báo, scope selector và một số command shell không kết nối backend.

### Placeholder / kế hoạch

- Một số navigation capability phụ như Cảnh báo, Lịch sử thiên tai, Xu hướng và Cấu hình.
- Tích hợp API, cơ sở dữ liệu, identity provider, telemetry thời gian thực và persistence đa phiên.

## Nợ kỹ thuật chủ đích

- Feature routes đã lazy-load; MapLibre vẫn là dependency chunk lớn và chỉ được tải khi route có bản đồ cần dùng.
- `OperationalProvider` vẫn là orchestration point lớn vì phải giữ một canonical owner và external command contract; business rules/calculations tiếp tục thuộc domain/application modules, không được chuyển vào generic God service.
- Atomic boundary hiện chỉ bảo đảm rollback cho deterministic in-memory state trong một browser runtime; backend persistence và database transaction vẫn chưa có.
- Test suite hiện chạy bằng Node test runner qua `tsx`; chưa bổ sung CI hoặc thay đổi test framework.
