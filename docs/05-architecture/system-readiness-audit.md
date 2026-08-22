# VNDMS — Kiểm toán kiến trúc và mức độ sẵn sàng sản xuất

**Ngày kiểm toán:** 21/08/2026  
**Phạm vi:** toàn bộ `src/`, `tests/`, `docs/`, cấu hình TypeScript/Vite và package manifest sau khi hoàn thành các phân hệ tác nghiệp, bảo mật, mô phỏng và Trợ lý AI.  
**Tính chất:** kiểm toán tĩnh dựa trên mã nguồn hiện hữu; không sửa mã nghiệp vụ trong nhiệm vụ này.

## 1. Kết luận điều hành

VNDMS là một **frontend modular monolith có nền tảng domain/application đáng kể**, bộ quy tắc nghiệp vụ thuần tương đối tốt, một nguồn state React chính, test domain/application rộng và UI chuyên ngành nhất quán. Quét dependency graph trên 144 tệp TypeScript/TSX, 493 cạnh import không phát hiện vòng phụ thuộc.

Tuy nhiên, hệ thống **chưa sẵn sàng production**. Ba blocker quan trọng nhất là:

1. Command Center vẫn trộn dữ liệu canonical với một operational dataset tĩnh thứ hai.
2. Geographic authorization chưa bảo vệ read model của các module chính; người dùng có quyền module có thể đọc toàn bộ collection từ Context.
3. Mutation boundary có chữ ký nhận scope/owner nhưng cả 103 lời gọi thực tế chỉ truyền permission, nên scope và ownership không được thực thi tập trung.

Ngoài ra, toàn bộ operational state chỉ tồn tại trong bộ nhớ, thời gian nghiệp vụ bị cố định, reset Simulation có thể ghi đè mọi thay đổi hiện hành, multi-entity mutations nằm trong một provider rất lớn, và security/audit vẫn là demo phía client.

### Đánh giá tổng quát

| Lĩnh vực            | Đánh giá                                    | Nhận xét ngắn                                                                                |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Hướng phụ thuộc     | Khá                                         | Không có cycle; có 3 vi phạm direction cụ thể                                                |
| Domain rules        | Khá                                         | Task/Team/Evacuation/Relief/Recovery có invariant tốt; Incident và orchestration còn lỗ hổng |
| Application layer   | Trung bình                                  | Pure use cases tốt nhưng provider giữ quá nhiều transaction logic                            |
| State consistency   | Trung bình–thấp                             | Một owner nhưng nhiều `useState`, không atomic, không persistence                            |
| Security production | Thấp                                        | Client-only demo; read/scope/ownership enforcement chưa đầy đủ                               |
| Testing             | Khá ở pure logic, yếu ở runtime integration | 151 test được báo cáo, nhưng không mount provider/browser                                    |
| Performance         | Trung bình–thấp                             | Main chunk 1,782.93 kB; one-context fan-out và eager routes                                  |
| Maintainability     | Trung bình                                  | Module organization rõ, nhưng một số tệp rất lớn và CSS/global patterns trùng                |
| UX consistency      | Khá về hình thức, trung bình về hành vi     | Shell nhất quán; placeholder actions, error/accessibility gaps                               |
| Documentation       | Nhiều nhưng lỗi thời ở tài liệu gốc         | Thiếu system-wide source of truth và deployment/threat diagrams                              |

## 2. Điểm mạnh được xác nhận

- `OperationalProvider` là React state owner duy nhất; không tìm thấy Context/store/event bus thứ hai.
- Chỉ có một `permissionMatrix` tại `src/lib/permissions/permissions.ts`.
- Không phát hiện circular dependency trong graph import hiện tại.
- Domain/application rules cho Task, Team, Shelter/Evacuation, SOS, Relief, Playbook, Recovery, Simulation và AI có test trực tiếp.
- MapLibre policy chung nằm ở `src/infrastructure/gis/mapConfig.ts`; detail maps được lazy-load.
- Auth và audit có gateway replaceable; mã nguồn và tài liệu đều công bố đây là local demo.
- Simulation dùng seed và engine deterministic, không có Simulation-only entity store.
- Lucide là icon system duy nhất trong các feature đã kiểm tra.
- Tài liệu theo module đã bao phủ use case, domain, architecture, testing và completion report.

---

# 3. Phát hiện theo mức độ

## 3.1 Critical issues

### C-01 — Command Center vẫn có nguồn dữ liệu tác nghiệp thứ hai

- **Đường dẫn:**
  - `src/data/scenarios/red-river-flood/commandCenterSeed.ts:1-63`
  - `src/features/command-center/components/CommandCenter.tsx:2,22-55`
  - `src/features/command-center/components/SituationSummary.tsx:2-13`
  - `src/features/command-center/components/ActionQueue.tsx:2,8-16`
  - `src/features/command-center/components/CoordinationTimeline.tsx:1-5`
  - `src/features/command-center/components/DetailDrawer.tsx:2-29`
  - `src/features/command-center/components/ResourceExceptions.tsx:2-10`
- **Vấn đề:** Command Center vừa đọc `OperationalProvider`, vừa ghép `scenario`, `situation`, `actionQueue`, `coordinationEvents`, `resourceExceptions`, Incident/SOS/Team/Shelter tĩnh từ `commandCenterSeed.ts`. Drawer đọc hoàn toàn từ các mảng tĩnh. Queue và timeline trộn dynamic rows với seed rows. Seed dùng cả mã như `SHEL-012`, `TASK-084`, trong khi canonical module dùng `TH-*`, `TSK-*`.
- **Vì sao quan trọng:** Cùng một màn hình có thể hiển thị state cũ sau mutation/Simulation, mở drawer cho entity không thuộc canonical state, lộ khu vực ngoài scope và làm sai tuyên bố “một nguồn sự thật”. Đây là rủi ro trực tiếp cho demo luận văn và phỏng vấn kiến trúc.
- **Khuyến nghị:** Giữ `commandCenterSeed.ts` chỉ cho metadata scenario không nghiệp vụ hoặc loại bỏ khỏi runtime; chuyển toàn bộ summary/queue/timeline/drawer/exceptions sang application queries trên canonical collections. Dùng canonical entity IDs và paths.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** **Có điều kiện** — layout có thể giữ nguyên, nhưng dữ liệu hiển thị sẽ thay đổi về đúng canonical state.

### C-02 — Geographic authorization không bảo vệ dữ liệu đọc của các module chính

- **Đường dẫn:**
  - `src/app/App.tsx:48-72,92-185`
  - `src/state/operations/OperationalStateContext.ts:24-62`
  - `src/features/incidents/pages/IncidentListPage.tsx:11-42`
  - Các list/detail/analytics/Command Center pages dùng `useOperationalState()` trực tiếp
- **Vấn đề:** Route guard chỉ gọi `store.can(requiredPermission(route))` mà không truyền resource scope. Context công khai toàn bộ arrays. Ví dụ Incident list lọc trực tiếp `incidents` nhưng không lọc theo `currentUser.geographicScope`; detail route chỉ tìm ID trong array. Analytics cũng cast toàn store và cho chọn phạm vi rộng.
- **Vì sao quan trọng:** Local Officer có `view` có thể mở URL hoặc list để đọc Incident ngoài Tây Hồ. Header nói “Phạm vi được phân quyền” nhưng read path không thực thi phạm vi đó. Command Center seed còn hiển thị Hoàn Kiếm/Long Biên bất kể scope.
- **Khuyến nghị:** Tạo authorized application query facade/selectors theo collection và entity ID, dùng cùng `authorize()`/scope policy; route detail phải nhận decision theo resource trước khi render. Không lọc riêng lẻ trong từng component và không tạo store mới.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** **Không hoàn toàn** — visibility của role hạn chế sẽ thay đổi đúng theo yêu cầu bảo mật; Commander/Operator không đổi.

### C-03 — Mutation boundary không dùng geographic scope hoặc ownership dù API đã hỗ trợ

- **Đường dẫn:**
  - `src/state/operations/OperationalContext.tsx:58-59,72-205`
  - `src/lib/security/authorization.ts:1-8`
- **Vấn đề:** `enforcePermission(permission, resourceScope?, ownerId?)` hỗ trợ scope/owner, nhưng quét 103 lời gọi cho thấy **103/103 chỉ truyền một đối số permission**. Task, Team, Incident, Shelter, Evacuation, Playbook và nhiều Recovery mutations không truyền scope/team/warehouse owner. Một số module dùng các assertion riêng lẻ, nhưng không đồng nhất.
- **Vì sao quan trọng:** Role có permission có thể mutate resource ngoài địa bàn hoặc ngoài team/kho được giao. Ownership checks trong `authorize()` gần như là dead path tại canonical provider boundary.
- **Khuyến nghị:** Mỗi mutation phải resolve target trước, sau đó gọi một authorization decision với permission + canonical resource scope + owner/team/warehouse ID. Bổ sung helpers typed theo entity để tránh bỏ sót; giữ `OperationalProvider` làm boundary duy nhất.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** **Không hoàn toàn** — các thao tác trước đây được cho qua sai sẽ bị từ chối; lifecycle hợp lệ không đổi.

## 3.2 High-priority issues

### H-01 — Security audit của mutation không chỉ ra resource thực tế

- **Đường dẫn:** `src/state/operations/OperationalContext.tsx:57-59,72-205`
- **Vấn đề:** Audit dùng `resourceType: 'PermissionBoundary'`, `resourceId: ownerId ?? null`. Vì không lời gọi nào truyền ownerId, hầu hết 103 mutation authorization events có `resourceId = null`; action/resource ID chỉ còn trong business timeline, không ở security audit.
- **Vì sao quan trọng:** Không thể trả lời chắc chắn ai đã được phép/từ chối thao tác trên Incident/Task/Team nào; audit không đạt mục tiêu truy vết sensitive operation.
- **Khuyến nghị:** Truyền typed `AuthorizationContext` gồm resourceType/resourceId/scope/owner và ghi một event cho mỗi top-level command. Giảm audit trùng do nested provider commands.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có — chỉ cải thiện metadata/audit count nếu thiết kế cẩn thận.

### H-02 — `OperationalProvider` là God object và multi-entity mutations không có transaction abstraction

- **Đường dẫn:**
  - `src/state/operations/OperationalContext.tsx` — 83,955 byte, hơn 100 command
  - `src/state/operations/OperationalStateContext.ts` — interface rất rộng
- **Vấn đề:** Provider giữ hơn 20 `useState`, auth, audit, session timer, Simulation timer, ID generation, route-adjacent policy, event factories và transaction orchestration. Một command thường gọi nhiều setters cho Task/Team/Incident/SOS/timeline.
- **Vì sao quan trọng:** React batching không phải transaction model. Việc validate hoặc throw sau một setter, stale closures, nested command calls và thay đổi thứ tự setter có thể tạo partial state. Tệp khó review, merge và test độc lập.
- **Khuyến nghị:** Không thay provider; chuyển command orchestration thành pure application command functions nhận `OperationalSnapshot` và trả `{snapshot, events, result}` atomically. Provider chỉ authorize, invoke, apply một reducer/snapshot update và publish value.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** Có điều kiện — cần characterization tests trước.

### H-03 — Đồng hồ nghiệp vụ bị cố định tại 21/08/2026 10:45

- **Đường dẫn:**
  - `src/state/operations/OperationalContext.tsx:34-35`
  - `src/domain/tasks/rules.ts:12-24`
  - `src/domain/recovery/rules.ts:11-14`
  - `src/domain/relief/rules.ts:12-14`
  - `src/application/sos/sosUseCases.ts:17-18`
  - `src/application/relief/reliefQueries.ts:5`
- **Vấn đề:** Runtime mutations dùng `now() => '21/08/2026 10:45'`, timeline dùng `'10:45'`; overdue và “hôm nay” dùng reference constants. Một số generated ETA/due date cũng cố định.
- **Vì sao quan trọng:** Mọi thay đổi production có timestamp sai; overdue, SLA, analytics và ordering sai ngay sau ngày demo. Logic thời gian khó test và không nhất quán với auth audit dùng ISO `new Date()`.
- **Khuyến nghị:** Inject một `Clock` ở composition/provider boundary; canonical internal timestamp dùng ISO hoặc epoch, định dạng tiếng Việt chỉ ở presentation. Simulation giữ simulation clock riêng có nhãn source.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có điều kiện — dùng fixed test clock để giữ deterministic tests; runtime timestamp sẽ đổi đúng.

### H-04 — Operational repository không persistence; refresh làm mất toàn bộ nghiệp vụ

- **Đường dẫn:** `src/infrastructure/persistence/inMemoryOperationalRepository.ts:22-31`, `src/state/operations/OperationalContext.tsx:43-52`
- **Vấn đề:** Repository chỉ có `load()` clone seed, không có save/transaction/version. Auth/users/audit bền qua localStorage nhưng Incident/Task/Team/... không bền qua refresh.
- **Vì sao quan trọng:** Trạng thái auth và audit có thể nói mutation thành công trong khi canonical operation biến mất sau reload. Đây là production blocker và cũng tạo demo inconsistency.
- **Khuyến nghị:** Định nghĩa repository port ở application boundary với load/save transaction snapshot hoặc API backend; version schema và migration. Giữ in-memory adapter cho demo/test.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** Không — bổ sung persistence là thay đổi runtime có chủ đích.

### H-05 — Reset Simulation ghi đè toàn bộ canonical state, kể cả thay đổi không do Simulation tạo

- **Đường dẫn:** `src/state/operations/OperationalContext.tsx:196-203`
- **Vấn đề:** `resetSimulation()` gọi `applyOperationalSnapshot(inMemoryOperationalRepository.load())`, thay toàn bộ Incident/Task/Team/Shelter/SOS/Relief/Playbook/Recovery và timelines bằng seed.
- **Vì sao quan trọng:** Một thao tác reset scenario có thể xóa mọi thao tác người dùng trong phiên, không chỉ rollback event do Simulation tạo. Auth audit không phản ánh chi tiết dữ liệu bị mất.
- **Khuyến nghị:** Chốt rõ semantic: sandbox reset phải có confirmation và tách session snapshot; nếu Simulation chạy trên operational state dùng event provenance/rollback hoặc lưu baseline khi bắt đầu. Không reset production canonical state ngầm.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** Không — cần quyết định sản phẩm và migration behavior.

### H-06 — Incident lifecycle và một số cross-entity invariants chưa được domain hóa

- **Đường dẫn:**
  - `src/application/incidents/incidentUseCases.ts:3-6`
  - `src/state/operations/OperationalContext.tsx:72-78,97,204-205`
  - `src/features/incidents/pages/IncidentListPage.tsx:43-45`
- **Vấn đề:** `changeIncidentStatus` cho phép mọi trạng thái sang mọi trạng thái; `closeIncident` đặt 100% không kiểm tra Task/SOS/Evacuation mở. `dispatchTeam` sửa object trực tiếp, không gọi `assertTeamDispatchable` và không kiểm tra entity tồn tại. `createTask` không từ chối Incident không tồn tại mà fallback tọa độ `[105.85, 21.05]`. Form tạo Incident cho phép nhập tên khu vực nhưng luôn gửi tọa độ `[105.825, 21.071]`.
- **Vì sao quan trọng:** Có thể tạo orphan Task, double-book Team, đóng Incident còn công việc, hoặc lưu địa danh/tọa độ mâu thuẫn.
- **Khuyến nghị:** Thêm Incident transition matrix và closure policy; dùng application command cho dispatch; create Task bắt buộc Incident canonical; location phải là typed input/selection có tọa độ nhất quán.
- **Độ phức tạp:** M–L
- **An toàn không đổi hành vi:** Có điều kiện — invalid paths sẽ bị chặn.

### H-07 — Geographic policy bị nhân bản và dựa trên substring tên địa bàn

- **Đường dẫn:**
  - `src/lib/security/authorization.ts:1-8`
  - `src/application/sos/sosUseCases.ts:9`
  - `src/application/relief/reliefUseCases.ts:4`
  - `src/application/playbooks/playbookUseCases.ts:5`
  - `src/application/recovery/recoveryUseCases.ts:6`
- **Vấn đề:** Có centralized `isWithinGeographicScope`, đồng thời bốn `assert*Scope` riêng. Tất cả chủ yếu dùng `includes()` trên display name; không dùng `GeographicScope.code` hoặc parent hierarchy.
- **Vì sao quan trọng:** Dấu tiếng Việt, tên trùng/đổi tên, thứ tự “Tây Hồ, Hà Nội” và scope cấp kho có thể cho kết quả khác nhau giữa module; policy dễ drift.
- **Khuyến nghị:** Một policy duy nhất dựa trên code và ancestor relationship; module truyền typed resource scope vào policy, không tự so chuỗi.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có điều kiện — cần mapping seed name → code và regression matrix.

### H-08 — Error handling mutation không nhất quán và UI thường không hiển thị lỗi

- **Đường dẫn:**
  - `src/state/operations/OperationalContext.tsx:72-205`
  - `src/features/incidents/components/IncidentActionDialogs.tsx:10-22`
  - Các `*ActionDialogs.tsx`
  - `src/main.tsx:20-24`
- **Vấn đề:** Nhiều command `return` im lặng khi không tìm thấy entity; command khác throw. Event handlers gọi command trực tiếp nhưng không có error result/toast/form error. Không có React Error Boundary toàn ứng dụng.
- **Vì sao quan trọng:** UI có thể đóng dialog dù mutation không làm gì, hoặc exception làm hỏng subtree mà không có recovery. Người vận hành không biết state thực tế.
- **Khuyến nghị:** Chuẩn hóa `Result<T, OperationalError>` hoặc typed exceptions tại application boundary; dialog giữ mở và render lỗi; thêm Error Boundary ở shell/workspace với retry/logging.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có — thành công giữ nguyên; lỗi trở nên rõ ràng.

### H-09 — Auth/session/audit chỉ là demo và có thể bị sửa hoàn toàn từ client

- **Đường dẫn:**
  - `src/infrastructure/auth/localAuthenticationAdapter.ts:1-13`
  - `src/infrastructure/auth/demoUsers.ts`
  - `src/infrastructure/auth/localAuditAdapter.ts:1-7`
  - `src/lib/security/authorization.ts`
- **Vấn đề:** User/session/audit nằm trong localStorage; `safeUsers()` chỉ cast JSON array không validate schema; session không có chữ ký và chỉ cần userId tồn tại + future expiresAt; hash demo nằm trong bundle; audit có thể sửa/xóa; không rate limit/MFA/server revocation.
- **Vì sao quan trọng:** Người dùng browser có thể tự nâng role/scope, tạo session hoặc xóa audit. Đây không phải security boundary production.
- **Khuyến nghị:** Giữ adapter demo nhưng gắn banner/README rõ; production adapter phải dùng backend IdP/session HttpOnly, server authorization, server-side immutable audit, rate limiting và schema validation.
- **Độ phức tạp:** L
- **An toàn không đổi hành vi:** Không cho production; có thể giữ demo adapter song song.

### H-10 — Test suite không kiểm tra canonical runtime boundary

- **Đường dẫn:**
  - `tests/**/*`
  - `tests/README.md:13-18`
  - `src/state/operations/OperationalContext.tsx`
- **Vấn đề:** Không test nào mount `OperationalProvider`; không có Testing Library/Playwright. Các integration tests chủ yếu phối hợp pure functions/snapshot; AI action test dùng mock executor và tự push audit/timeline. Vì vậy các lỗi C-01/C-03, stale closure, multi-setter consistency, route data disclosure, dialog confirmation và Simulation reset không được bắt.
- **Vì sao quan trọng:** 151/151 test pass không chứng minh integration behavior quan trọng nhất của ứng dụng.
- **Khuyến nghị:** Ưu tiên provider characterization tests và browser tests theo role/scope; kiểm tra một command cập nhật đồng thời entities + timeline + security audit; test reset/refresh/router/back-forward.
- **Độ phức tạp:** M–L
- **An toàn không đổi hành vi:** Có.

### H-11 — Main bundle lớn và toàn bộ route được import eager

- **Đường dẫn:**
  - `src/app/App.tsx:1-43`
  - `src/main.tsx:4-19`
  - `src/features/command-center/components/OperationalMap.tsx:1-89`
  - production artifact hiện tại: main JS 1,782.93 kB minified / 448.49 kB gzip
- **Vấn đề:** App import mọi page ngay từ startup; Command Center import MapLibre trực tiếp nên map dependency vào main chunk. Chỉ một số detail maps lazy. Mọi global CSS cũng tải upfront.
- **Vì sao quan trọng:** Tăng time-to-interactive trên mạng/thiết bị hiện trường và làm bundle warning kéo dài.
- **Khuyến nghị:** Route-level `React.lazy`/dynamic import theo feature; lazy Command Center map; prefetch sau login; cấu hình chunking và budget trong CI.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có.

### H-12 — Một Context value không memo hóa làm 47 consumer files rerender theo mọi mutation

- **Đường dẫn:** `src/state/operations/OperationalContext.tsx:206-208`, tất cả consumer của `useOperationalState()`
- **Vấn đề:** `value` và hơn 100 function được tạo lại mỗi render. Một audit append, session tick, map update hoặc form mutation làm tất cả context consumers nhận identity mới. Analytics/AI còn tạo snapshot/derived calculations lớn từ store.
- **Vì sao quan trọng:** Chi phí tăng theo số module và có thể làm MapLibre/list/report rerender không liên quan.
- **Khuyến nghị:** Trước mắt memoize command facade/value và selectors; dài hạn dùng reducer + split read selectors **trong cùng OperationalProvider**, không tạo store cạnh tranh. Profile trước/sau.
- **Độ phức tạp:** M–L
- **An toàn không đổi hành vi:** Có điều kiện — cần tránh stale callbacks.

### H-13 — Command Center “thao tác nhanh” vẫn là placeholder công khai

- **Đường dẫn:**
  - `src/features/command-center/components/QuickActions.tsx:3-11`
  - `src/features/command-center/components/ActionDialog.tsx:4-8`
  - `src/features/command-center/components/CommandCenter.tsx:21-54`
- **Vấn đề:** Mọi quick action mở dialog ghi rõ “Biểu mẫu nghiệp vụ ... sẽ được hoàn thiện”, nút “Tiếp tục” chỉ đóng dialog. Không route đến module/hợp đồng đã hoàn thành.
- **Vì sao quan trọng:** Trực tiếp làm giảm độ tin cậy của “hệ thống tác nghiệp đã hoàn thành” trong demo/phỏng vấn và tạo affordance giả.
- **Khuyến nghị:** Không thêm feature mới; map action hiện có đến route/dialog nghiệp vụ đã ổn định hoặc ẩn action chưa có contract.
- **Độ phức tạp:** S–M
- **An toàn không đổi hành vi:** Có — thay placeholder bằng entry point hiện hữu.

## 3.3 Medium-priority issues

### M-01 — Có ba vi phạm dependency direction cụ thể

- **Đường dẫn:**
  - `src/application/simulation/simulationUseCases.ts:1`
  - `src/domain/auth/types.ts:2`
  - `src/domain/ai/types.ts` import `Permission`
- **Vấn đề:** Application Simulation import `OperationalSnapshot` từ infrastructure repository. Domain Auth/AI import `Permission` từ `src/lib/permissions`.
- **Vì sao quan trọng:** Contract lõi phụ thuộc adapter/utility ở lớp ngoài; làm khó thay repository và làm kiến trúc không đúng sơ đồ công bố.
- **Khuyến nghị:** Chuyển `OperationalSnapshot` port sang application/shared contract; chuyển Permission type/policy contract vào domain auth/authorization, để lib triển khai matrix.
- **Độ phức tạp:** S–M
- **An toàn không đổi hành vi:** Có.

### M-02 — Business query/derived logic còn nằm trong React và bị lặp

- **Đường dẫn:**
  - `src/features/command-center/components/ActionQueue.tsx:8-16`
  - `src/features/command-center/components/SituationSummary.tsx:5-13`
  - `src/features/command-center/components/ResourceExceptions.tsx:8-10`
  - list/detail pages của Relief, Recovery, Shelter
- **Vấn đề:** Prioritization, exception composition, team/shelter counts và mapping trạng thái được tính trực tiếp trong components, trong khi Analytics và AI có query/rule riêng cho cùng khái niệm.
- **Vì sao quan trọng:** Command Center, Analytics và AI có thể cho số liệu khác nhau; logic khó test mà không render.
- **Khuyến nghị:** Đặt operational summary/exception selectors ở application query layer và dùng lại; component chỉ format/render.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có với snapshot tests.

### M-03 — Test command không tái lập từ package manifest

- **Đường dẫn:** `package.json:6-11`, `tests/README.md:1-20`
- **Vấn đề:** Không có `npm test`; `tsx` không nằm trong devDependencies. Quy trình hiện dựa vào `npx --yes tsx`, có thể cần mạng và lấy version ngoài lockfile. `tests/README.md` còn nói chưa có test runner.
- **Vì sao quan trọng:** Reviewer/CI không có một lệnh chuẩn, reproducibility kém.
- **Khuyến nghị:** Pin test runner, thêm `test`, `test:focused`, `test:coverage`; cập nhật README và CI.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có.

### M-04 — Kiểu thời gian là string định dạng hiển thị; Relief so sánh lexicographic

- **Đường dẫn:** `src/domain/relief/rules.ts:12-14`, các entity types dùng `string`
- **Vấn đề:** `isReliefOverdue` dùng `request.requiredBy < '21/08/2026 10:45'`, sai khi qua ngày/tháng/năm. Các module có parser riêng khác nhau.
- **Vì sao quan trọng:** SLA/overdue sai ở dữ liệu ngoài ngày demo; không thể sort an toàn.
- **Khuyến nghị:** Canonical ISO timestamp/value object và một operational date parser; display formatting ở UI.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có điều kiện — migrate seed/tests.

### M-05 — Router không có Not Found rõ ràng và `/login` khi authenticated giữ URL không đúng

- **Đường dẫn:** `src/app/routes/router.ts:1-125`, `src/app/App.tsx:75-96`
- **Vấn đề:** URL không nhận diện trở thành generic placeholder; authenticated user tại `/login` thấy Command Center nhưng URL vẫn `/login`. Route authorization chỉ map permission tổng quát.
- **Vì sao quan trọng:** Deep-link/debug khó, browser semantics và analytics sai.
- **Khuyến nghị:** Thêm route `not-found`; redirect/replace authenticated `/login` về `/`; giữ custom History API.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có.

### M-06 — Navigation chứa badge và quyền hiển thị tĩnh

- **Đường dẫn:** `src/components/navigation/navigationConfig.ts:1-15`, `src/components/layout/AppSidebar.tsx:1-5`
- **Vấn đề:** Badge Sự cố/Nhiệm vụ/Cảnh báo là literal; sidebar hiển thị toàn bộ Admin và placeholder items cho mọi role. Citizen có `sos_create` nhưng không có citizen-facing route để dùng quyền này và landing `/` bị Access Denied.
- **Vì sao quan trọng:** Số liệu lệch canonical state, UX quyền gây nhiễu, Citizen flow bế tắc.
- **Khuyến nghị:** Derive badge bằng selectors; filter navigation bằng canonical permissions; xác định route được phép đầu tiên sau login; không thay security boundary.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có điều kiện — navigation theo role sẽ thay đổi đúng chủ đích.

### M-07 — Dialog accessibility không nhất quán

- **Đường dẫn:**
  - `src/features/incidents/components/IncidentActionDialogs.tsx:10-22`
  - các `*ActionDialogs.tsx`
  - `src/features/ai-assistant/pages/AiAssistantPage.tsx`
- **Vấn đề:** Chỉ 2 chỗ trong toàn TSX có `role="dialog"`/`aria-modal`; nhiều dialog không có labelledby, focus trap, Escape handling hoặc restore focus. Có 224 raw `<button>` với mức độ accessible name không đồng đều.
- **Vì sao quan trọng:** Keyboard/screen-reader workflow không đáng tin cậy; focus có thể đi ra sau backdrop.
- **Khuyến nghị:** Chuẩn hóa một presentation dialog primitive có ARIA, focus management, Escape/backdrop policy; migrate dần không đổi layout.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có.

### M-08 — Map error/loading path và setup bị lặp

- **Đường dẫn:**
  - `src/infrastructure/gis/mapConfig.ts:1-11`
  - `src/features/command-center/components/OperationalMap.tsx:22-89`
  - các `*OperationalMap.tsx`/`*DetailMap.tsx`
- **Vấn đề:** Map chủ yếu chỉ nghe `load`, không có UI `error`/timeout/retry; tile source là external. Mỗi feature lặp init/map cleanup/sea labels/toolbar/attribution.
- **Vì sao quan trọng:** Mất mạng có thể để spinner vô hạn; duplication làm policy/lifecycle drift.
- **Khuyến nghị:** Shared MapLibre lifecycle utility/component trong GIS infrastructure hiện hữu, không tạo GIS system mới; render explicit offline/error state và retry.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có.

### M-09 — TypeScript strictness và type escape hatches còn yếu

- **Đường dẫn:**
  - `tsconfig.app.json:2-25`
  - Analytics pages dùng `store as AnalyticsData`
  - `src/domain/ai/types.ts` dùng `payload: Record<string,string>`; `aiActions.ts` cast priority
  - localStorage adapters cast parsed JSON
- **Vấn đề:** Không bật `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; runtime JSON và action payload không dùng discriminated union/schema.
- **Vì sao quan trọng:** Undefined index, malformed storage và sai payload chỉ lộ ở runtime.
- **Khuyến nghị:** Bật strict theo pha; typed selectors thay cast; action proposal dùng discriminated union; runtime schema validation tại adapters.
- **Độ phức tạp:** M–L
- **An toàn không đổi hành vi:** Có điều kiện — compile fixes có thể rộng nhưng behavior không cần đổi.

### M-10 — AI grounding/use page quá lớn

- **Đường dẫn:**
  - `src/application/ai/aiGrounding.ts` — 802 dòng
  - `src/features/ai-assistant/pages/AiAssistantPage.tsx` — 494 dòng
- **Vấn đề:** Một use case dispatch hầu hết intent và tạo evidence/text trong chuỗi branch dài; page giữ conversation, evidence, action confirmation và render cards trong một file.
- **Vì sao quan trọng:** Khó thêm intent/locale/test isolated; dễ làm evidence policy không đồng nhất.
- **Khuyến nghị:** Registry typed `intent -> handler`, evidence factory dùng chung; tách presentation components nhưng giữ state cục bộ và provider boundary hiện tại.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có với golden tests hiện hữu.

### M-11 — ID generation dựa trên snapshot closure

- **Đường dẫn:** nhiều create commands trong `src/state/operations/OperationalContext.tsx:72-187`
- **Vấn đề:** ID được tính bằng `Math.max(...current closure) + 1`; hai create calls trước rerender có thể sinh cùng ID. Reservation ID dựa trên count tương tự.
- **Vì sao quan trọng:** Duplicate canonical key làm list/render/reference sai; backend migration càng khó.
- **Khuyến nghị:** ID service/UUID hoặc repository sequence; test concurrent/batched commands.
- **Độ phức tạp:** S–M
- **An toàn không đổi hành vi:** Có điều kiện — ID format có thể giữ bằng sequence adapter.

### M-12 — CSS global có selector ownership chồng lấn

- **Đường dẫn:** `src/main.tsx:5-19`, toàn bộ `src/styles/*.css`
- **Vấn đề:** Tất cả CSS tải global; cùng selector như `.progress-track` xuất hiện ở 10 files, `.incident-search` 7, `.badge`/`.btn` 5. Nhiều module CSS được lưu một dòng rất dài.
- **Vì sao quan trọng:** Thứ tự import quyết định style, thay một module có thể regress module khác; review diff khó.
- **Khuyến nghị:** Giữ design system nhưng xác lập primitive selector tại một file, feature selectors có namespace; format source CSS; thêm visual regression cho shell/list/detail/dialog.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có điều kiện — cần screenshot comparison.

### M-13 — Simulation timer effect không có dependency array

- **Đường dẫn:** `src/state/operations/OperationalContext.tsx:198-203`
- **Vấn đề:** Effect chạy sau mọi render, cleanup và tạo lại timeout khi Simulation đang chạy. Audit/session/UI state update không liên quan cũng reset countdown tick.
- **Vì sao quan trọng:** Wall-clock cadence không ổn định theo mức độ render, dù thứ tự deterministic vẫn giữ.
- **Khuyến nghị:** Dependency rõ (`status`, `speed`, stable step callback) hoặc scheduler application service; test unrelated rerender không đổi tick cadence.
- **Độ phức tạp:** S–M
- **An toàn không đổi hành vi:** Có.

### M-14 — Security audit không bao phủ route/read denials

- **Đường dẫn:** `src/app/App.tsx:92-101`, `src/application/ai/aiGrounding.ts`, `src/state/operations/OperationalContext.tsx:59`
- **Vấn đề:** `PERMISSION_DENIED` chỉ được ghi trong `enforcePermission` mutation. Route guard dùng `can()` và AI read denial trả UNKNOWN nhưng không append audit.
- **Vì sao quan trọng:** Không thấy reconnaissance/unauthorized read attempts trong audit trail.
- **Khuyến nghị:** Một application-level access decision recorder có dedup/rate control cho route/read denial; không audit mọi render.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có.

## 3.4 Low-priority issues

### L-01 — Tài liệu và tên hồ sơ bị trùng/không nhất quán

- **Đường dẫn:** `docs/04-domain-model/team.md`, `docs/04-domain-model/team-module.md`, các completion reports
- **Vấn đề:** Có hai tài liệu Team domain và nhiều tài liệu module không có index/canonical status.
- **Vì sao quan trọng:** Reviewer không biết tài liệu nào authoritative.
- **Khuyến nghị:** Tạo docs index và đánh dấu superseded/authoritative.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có.

### L-02 — Một số ID presentation có thể collision

- **Đường dẫn:** `src/application/ai/aiGrounding.ts` dùng `AIR-${now.getTime()}`; event factories trong provider dùng `Date.now()` + length.
- **Vấn đề:** Hai request cùng millisecond hoặc stale length có thể trùng key/event ID.
- **Vì sao quan trọng:** React key/audit/reference ambiguity trong trường hợp hiếm.
- **Khuyến nghị:** Inject ID generator duy nhất; UUID cho audit/presentation, deterministic generator riêng cho Simulation tests.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có.

### L-03 — Dev server cho phép mọi host

- **Đường dẫn:** `vite.config.ts:6`
- **Vấn đề:** `allowedHosts: true` phù hợp preview sandbox nhưng rộng nếu dùng dev server trên mạng nội bộ.
- **Vì sao quan trọng:** Tăng dev-server exposure; không phải production artifact issue.
- **Khuyến nghị:** Điều khiển bằng environment, mặc định allowlist localhost/preview host.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có điều kiện theo môi trường.

### L-04 — Không có CI/deployment manifest hoặc quality budget

- **Đường dẫn:** project root; không có workflow YAML/container/deploy docs
- **Vấn đề:** Build/lint/test hiện là thao tác thủ công; không khóa bundle budget hoặc route smoke test.
- **Vì sao quan trọng:** Regression dễ lọt khi bàn giao.
- **Khuyến nghị:** CI tối thiểu: install lockfile, lint, type/build, full tests, static architecture scan, artifact size budget.
- **Độ phức tạp:** S–M
- **An toàn không đổi hành vi:** Có.

---

# 4. Technical debt tổng hợp

1. **Provider concentration debt:** state đúng là một owner nhưng orchestration chưa được modular hóa thành command reducers.
2. **Demo-time debt:** thời gian, ETA, report period và overdue policy gắn ngày scenario.
3. **Parallel read-model debt:** Command Center seed còn sống cạnh canonical state.
4. **Authorization drift debt:** centralized authorization tồn tại song song với 4 scope assertions và UI-level filtering.
5. **Presentation debt:** raw dialog/list patterns và status-tone helpers lặp theo feature.
6. **CSS debt:** selector global trùng và source CSS một dòng.
7. **Repository naming debt:** `inMemoryOperationalRepository` là seed loader, chưa phải repository read/write.
8. **Documentation debt:** nhiều completion report nhưng system overview gốc lỗi thời.

# 5. Architectural risks

- **Single source of truth risk:** C-01 làm Command Center không phản ánh mutation canonical.
- **Authorization bypass risk:** C-02/C-03 cho phép read/mutate ngoài scope qua URL hoặc direct store command.
- **Partial transaction risk:** H-02 khiến liên kết Task–Team–Incident–SOS–timeline có thể lệch nếu một bước thất bại.
- **State loss risk:** H-04/H-05 làm refresh/reset xóa dữ liệu nhưng auth/audit còn tồn tại.
- **Policy divergence risk:** AI/Analytics/Command Center có derived queries khác nhau.
- **Migration risk:** localized date strings, generated IDs và broad Context contract gây khó chuyển backend.

# 6. Security limitations

## Demo security được triển khai đúng phạm vi

- Username/password demo, session TTL, inactive rejection, logout, RBAC matrix, local audit và adapter boundaries có thật.
- Mutation permission checks có thật và không chỉ ẩn nút.
- UI công bố local/demo limitations.

## Không phải production security

- localStorage là trust boundary không an toàn; user/session/audit có thể sửa.
- Không có server-side authentication/authorization, HttpOnly cookie, CSRF/session binding, rate limit, MFA hoặc revocation.
- Geographic read authorization chưa được thực thi trên core module queries.
- Ownership/scope không được truyền vào provider mutation checks.
- Session hết hạn có cửa sổ tối đa khoảng 60 giây trước timer validation; `can()` không tự kiểm expiresAt.
- Audit không bất biến và phần lớn mutation event không có resource ID.
- Không có CSP/deployment headers được cấu hình trong repository.

# 7. Testing gaps ưu tiên

1. **Provider integration:** mount provider và xác nhận atomic updates cho dispatch, SOS→Task→Team, evacuation redirect, reservation dispatch, playbook/recovery task creation.
2. **Read authorization:** mỗi list/detail/analytics/Command Center theo Commander, Local Officer, rescue role, warehouse role, Citizen.
3. **Mutation scope/ownership:** test mọi family command với in-scope/out-of-scope và correct/wrong owner.
4. **Simulation reset:** xác nhận rõ dữ liệu nào được rollback/giữ lại.
5. **Session runtime:** expiry trong khi đang ở app, localStorage tampering/schema invalid, user role/scope đổi giữa phiên.
6. **Browser router:** login/logout/back/forward/direct URL/not found/query context.
7. **Accessibility:** focus trap, Escape, labelled dialog, keyboard action queue.
8. **Map failure:** external style lỗi, offline state, cleanup/remount.
9. **Concurrent commands:** duplicate IDs, stale closure, rapid double submit.
10. **Visual regression:** shell, list/detail, dark mode, responsive, access denied, evidence drawer, confirmation dialog.

### Brittle test patterns quan sát được

- Nhiều test phụ thuộc literal ngày 21/08/2026 và ID seed.
- “Integration” AI executor tự mô phỏng timeline/audit thay vì chạy provider thật.
- Router test hiện chỉ kiểm một số route và chưa có `/ai-assistant`/not-found/authenticated redirect.
- Không có coverage report để biết branch/negative path thực tế.

# 8. Performance issues

- Main JS hiện khoảng **1.78 MB minified / 448 KB gzip**; Vite cảnh báo chunk trên 500 KB.
- MapLibre vào main chunk qua Command Center.
- Tất cả route pages và CSS được eager import.
- Một Context value mới ở mọi render fan-out tới ít nhất 47 consumer files.
- Analytics và AI dựng/duyệt nhiều arrays khi store object đổi; dữ liệu seed nhỏ nên chưa thấy rõ, nhưng scale tuyến tính theo toàn state.
- Nhiều map source `setData()` chạy khi bất kỳ collection liên quan đổi; chưa debounce/batch.
- Simulation tick apply toàn snapshot qua hàng loạt setters, tạo render/audit churn.

# 9. UX consistency findings

## Tốt

- Shell, Lucide, badge/button primitives, list/detail hierarchy và Vietnamese labels khá nhất quán.
- AccessDenied, empty rows và map loading có mặt ở nhiều module.
- AI evidence/confirmation thể hiện giới hạn rõ.

## Cần cải thiện

- Command Center quick actions là placeholder.
- Navigation badge và một số status/scenario text là static.
- Admin/placeholder navigation không theo quyền.
- Citizen không có usable landing cho `sos_create`.
- Dialog/error/loading semantics không đồng nhất; lỗi mutation không được trình bày.
- Không có app-level error boundary, route-level suspense hoặc 404.
- Dialog accessibility/focus management chưa đủ.
- Map network failure không có error state rõ.

# 10. Documentation gaps

### D-01 — README lỗi thời

- **Đường dẫn:** `README.md:5-49`
- **Vấn đề:** Chỉ liệt kê các module ban đầu, nói “các module khác ... placeholder”, route list thiếu Relief/Playbook/Recovery/Analytics/Simulation/Auth/AI/Admin, không có demo accounts/password, test command hoặc localStorage reset.
- **Vì sao quan trọng:** Người chấm/reviewer làm theo README sẽ hiểu sai phạm vi, không biết cách chạy test hoặc đăng nhập demo.
- **Khuyến nghị:** Viết lại system README làm entry point duy nhất: scope hiện tại, route, demo credential, run/test/build, limitations, map network, reset behavior.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có.

### D-02 — Architecture overview lỗi thời

- **Đường dẫn:** `docs/05-architecture/ARCHITECTURE.md:1-60`
- **Vấn đề:** Nói auth/token/audit chưa triển khai, module ngoài Incident/Task/Team là placeholder và chưa có test runner.
- **Vì sao quan trọng:** Tài liệu kiến trúc chính mâu thuẫn với mã nguồn, làm sai phần bảo vệ quyết định kiến trúc và onboarding.
- **Khuyến nghị:** Cập nhật C4/deployment view, state/auth/AI/Simulation flows, và liên kết audit này.
- **Độ phức tạp:** S–M
- **An toàn không đổi hành vi:** Có.

### D-03 — Testing README lỗi thời

- **Đường dẫn:** `tests/README.md:1-20`
- **Vấn đề:** Mô tả test là tương lai dù 25 test files đã tồn tại; không ghi lệnh thực tế.
- **Vì sao quan trọng:** Không có hướng dẫn tái lập làm giảm độ tin cậy của số liệu test và tăng nguy cơ chạy thiếu suite.
- **Khuyến nghị:** Ghi test pyramid hiện hữu, scripts, fixture/clock policy, integration limitations và browser test roadmap.
- **Độ phức tạp:** S
- **An toàn không đổi hành vi:** Có.

### D-04 — Thiếu setup/deployment/operations guide

- **Đường dẫn:** không có tài liệu tương ứng
- **Vấn đề:** Không có Node/npm version, clean install, environment, SPA fallback hosting, cache headers, tile dependency, security headers, data reset, backup/audit export hoặc troubleshooting.
- **Vì sao quan trọng:** Bản build có thể chạy ở máy phát triển nhưng thất bại khi host SPA, mất tile network hoặc cần khôi phục dữ liệu/audit.
- **Khuyến nghị:** Thêm deployment/runbook nhưng phân biệt rõ local demo và production target architecture.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có.

### D-05 — Thiếu diagram phục vụ bảo vệ luận văn/phỏng vấn

- **Đường dẫn:** chưa có; vị trí đề xuất `docs/05-architecture/diagrams/` và index trong `docs/05-architecture/ARCHITECTURE.md`.
- **Vấn đề:** Tài liệu hiện chủ yếu là mô tả chữ theo module, chưa có system-wide context, dependency, data-flow và security sequence diagrams.
- **Vì sao quan trọng:** Reviewer khó kiểm chứng một nguồn sự thật, boundary và flow cross-module; phần giải thích trade-off trong bảo vệ/phỏng vấn yếu hơn mã nguồn thực tế.
- **Khuyến nghị diagram:**
  1. C4 Context/Container/Component cho frontend modular monolith và future backend boundary.
  2. Dependency diagram Presentation → Application → Domain, Infrastructure adapters.
  3. OperationalProvider canonical state + command transaction sequence.
  4. Auth/session/RBAC/geographic/audit sequence.
  5. Simulation propagation sequence và reset boundary.
  6. Grounded AI evidence/action-confirmation sequence.
  7. Entity relationship diagram Incident–Task–Team–SOS–Evacuation–Shelter–Relief–Playbook–Recovery.
- **Độ phức tạp:** M
- **An toàn không đổi hành vi:** Có.

# 11. Prioritized implementation order

## P0 — Khóa correctness và access control trước mọi feature mới

1. **Loại bỏ runtime operational data thứ hai ở Command Center (C-01).**
2. **Xây authorized read selectors/facade cho list/detail/analytics/Command Center (C-02).**
3. **Truyền scope/owner/resource context vào toàn bộ mutation boundary (C-03).**
4. **Sửa security audit resource attribution và nested audit semantics (H-01).**
5. **Thêm characterization tests cho provider, read scope và mutation ownership (H-10).**

## P1 — Bảo toàn canonical state

6. Domain hóa Incident lifecycle/dispatch/orphan checks (H-06).
7. Chuẩn hóa error result và Error Boundary (H-08).
8. Quyết định/khóa semantic Simulation reset (H-05).
9. Chuyển multi-entity commands thành pure snapshot transactions nhưng giữ OperationalProvider (H-02).
10. Thay fixed clock/date model bằng injected clock + ISO canonical time (H-03, M-04).
11. Chọn production repository port/persistence strategy (H-04).

## P2 — Làm kiến trúc có thể scale và review được

12. Hợp nhất geographic policy theo code hierarchy (H-07).
13. Sửa dependency-direction violations (M-01).
14. Đưa Command Center/feature derived logic vào application queries (M-02).
15. Ổn định ID generation (M-11).
16. Bật TypeScript strict theo pha và typed action/storage schemas (M-09).
17. Tách AI intent handlers/presentation components (M-10).

## P3 — Performance, UX và delivery

18. Route-level code splitting + lazy Command Center map (H-11).
19. Giảm Context fan-out trong cùng provider và profile rerenders (H-12).
20. Thay quick-action placeholders bằng entry points hiện hữu (H-13).
21. Chuẩn hóa dialog accessibility và map error state (M-07, M-08).
22. Sửa router/not-found/navigation/badges/Citizen landing (M-05, M-06).
23. Chuẩn hóa CSS ownership (M-12).
24. Pin test runner, thêm CI và bundle budget (M-03, L-04).
25. Cập nhật README/Architecture/Testing và bổ sung diagrams/runbook (D-01…D-05).

# 12. Production readiness gate đề xuất

Chỉ nên gọi bản build “production candidate” khi tối thiểu:

- Không còn operational dataset thứ hai trong runtime UI.
- Mọi read và mutation đều có permission + geographic scope + ownership tests.
- Provider commands có atomic snapshot semantics và resource-attributed audit.
- Có persistence/backend adapter rõ; refresh/reset không làm mất dữ liệu ngoài contract.
- Runtime clock/date đúng và không còn SLA comparison bằng display string.
- Full provider/browser security regression pass.
- Main bundle nằm trong budget được chấp thuận và route splitting hoạt động.
- Có Error Boundary, map offline state, accessible dialogs và no-op placeholder được loại bỏ.
- README, architecture, security limitations, deployment guide và diagrams phản ánh đúng mã nguồn.

---

## Phụ lục A — Số liệu kiểm toán

- 163 source files; 144 TypeScript/TSX files trong dependency graph.
- 493 internal import edges; **0 circular dependency** phát hiện.
- 3 dependency-direction violations cụ thể.
- 26 files dưới `tests/` tính cả README; 25 test source files.
- 55 documentation files trước audit.
- 47 feature/component files gọi `useOperationalState()`.
- 103/103 `enforcePermission(...)` call sites không truyền scope/owner.
- Một canonical `permissionMatrix`.
- Main build artifact gần nhất: 1,782.93 kB minified / 448.49 kB gzip.
- Tệp lớn nhất theo dòng: `aiGrounding.ts` 802, `AiAssistantPage.tsx` 494; tệp provider 83,955 byte dù chỉ 208 physical lines do formatting dày.

## Phụ lục B — Phân biệt demo và production

Bản hiện tại phù hợp để trình diễn **kiến trúc frontend, deterministic domain rules, canonical-state propagation và replaceable adapter boundaries**. Không nên mô tả là hệ thống production an toàn hoặc bền dữ liệu. Cách mô tả chính xác:

> VNDMS hiện là frontend modular monolith phục vụ graduation demo, với deterministic operational domain, local authentication/audit adapters và các boundary có thể thay thế. Production cần backend persistence, server authorization/audit, realtime integrations và hardening theo các gate trong báo cáo này.
