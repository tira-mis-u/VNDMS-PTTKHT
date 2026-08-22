# Completed Rescue Team Management module on the existing VNDMS architecture.

Ngày hoàn tất: 21/08/2026

Đây là phần hoàn thiện module trên application hiện hữu, không phải rebuild, redesign shell hay refactor kiến trúc lần nữa.

## 1. Team domain changes

- Mở rộng `RescueTeam` thành operational resource: identity/type/leader/personnel, status/availability, assignment, capabilities, phương tiện-thiết bị, contact, vị trí, GPS/operational update, operating scope và notes.
- Bổ sung responsibility cho thành viên và type rõ cho availability.
- Tập trung transition, status-to-availability, operational priority, open-task calculation và trạng thái thành viên trong `domain/teams/rules.ts`/Team use cases.
- Invariant: đội mất liên lạc/không khả dụng/tạm nghỉ hoặc đang có task khác không thể điều phối; đội còn task không thể tự về Sẵn sàng.

## 2. Team application/use cases

- Bổ sung profile update, capability validation, location application, assignment recalculation và `assignTeamToOperation` để trạng thái đội/nhân sự không bị cập nhật rời rạc.
- Bổ sung Task application operations `assignTaskToTeam` và `releaseTaskAssignment`; Team UI không tự viết assignment lifecycle.
- Thêm pure query `filterAndSortTeams` cho search/filter/sort có thể test trực tiếp.

## 3. Team UI components

- `/teams`: compact operational list, search theo mã/tên/đội trưởng/khu vực; filter status/type/capability/area/assignment; sort operational priority/update/code; empty state và deliberate mobile rows.
- `/teams/:teamId`: overview/readiness, assignment với link Task/Incident, personnel responsibility/contact, capabilities, equipment, operational map, activity timeline, scope và notes.
- Actions: contact, dispatch, status, location, profile, capabilities và release assignment. Form hiển thị business/validation errors thay vì mutation UI trực tiếp.

## 4. State integration

`OperationalProvider` vẫn là canonical state duy nhất. Contract được mở rộng bằng profile/capability/release operations; không tạo TeamContext, TeamStore hoặc state system mới. Mỗi mutation enforce permission trước application/domain operation và ghi TeamEvent.

## 5. Task integration

- Assignment cập nhật `task.teamId`, leader/assignee, valid Task status, Team currentTask/currentIncident/status/availability.
- Tái gán tính lại đội cũ từ các task còn mở.
- Gỡ assignment chỉ áp dụng cho Chờ giao/Đã giao và trả task về Chờ giao.
- Task bắt đầu qua lifecycle/progress đưa Team sang Đang thực hiện.
- Task hoàn thành/hủy gọi assignment recalculation để Team không bị bận vĩnh viễn.

## 6. Incident integration

Team dùng `task.incidentId` và relationship hiện hữu, không thêm model thứ hai. Dispatch/release cập nhật Incident primary team khi cần, incident progress và Incident timeline. Team Detail link trực tiếp tới Incident.

## 7. Command Center integration

Không redesign Command Center. Situation Summary đọc canonical teams để hiển thị đội sẵn sàng, đang triển khai và ngoại lệ. Resource Exceptions hiển thị mất liên lạc/không khả dụng; map marker và exception row mở `/teams/:id`.

## 8. GIS integration

Team map tiếp tục dùng MapLibre thật và shared `mapConfig`: OpenFreeMap style, minimum zoom, nhãn tiếng Việt, Quần Đảo Hoàng Sa, Quần Đảo Trường Sa và surrounding geography. Layer tác nghiệp gồm Team, Task, Incident, shelter và route liên quan; không có SVG/canvas fake map.

## 9. Permission enforcement

Tái sử dụng RBAC hiện hữu cho `team_view`, `team_edit`, `team_assign`, `team_update_status`, `team_update_location`. Assertion nằm tại Provider mutation boundary. Citizen có permission list rỗng và test xác nhận không có quyền quản lý đội.

## 10. Demo data

Scenario Hà Nội/Sông Hồng hiện có 7 đội vừa đủ cho demo: CH-01…CH-05, YT-01 và CN-01. Equipment bao gồm xuồng, áo phao, bộ đàm, xe cứu thương, bộ sơ cứu, thiết bị chiếu sáng và máy phát điện. Dữ liệu bao gồm lực lượng cứu hộ đường thủy/đô thị/ngập lụt/hậu cần/tìm kiếm, y tế khẩn cấp và cứu nạn kỹ thuật; assignment, personnel, equipment, position và exceptions nhất quán. Sửa leader của TSK-0241/TSK-0243 để khớp canonical team data.

## 11. Documentation

- `docs/03-use-cases/team-management.md`
- `docs/04-domain-model/team.md`
- `docs/05-architecture/team-management.md`
- `docs/12-testing/team-management.md`

Tài liệu phân biệt local deterministic demo với GPS streaming, backend persistence, identity và realtime multi-user tương lai.

## 12. Tests/verification

- 8 pure domain/application/query/RBAC tests: **8 pass, 0 fail**.
- Search/type/capability/area/assignment filter và priority sort có automated pure test.
- Assignment/release/recalculation, lifecycle guards, location recovery, capability validation và Citizen denial có automated tests.
- Direct-route HTTP 200 sau thay đổi: `/teams`, `/teams/CH-01`, `/teams/YT-01`, `/incidents`, `/incidents/INC-0241`, `/tasks`, `/tasks/TSK-0241`.
- TypeScript production build compile toàn bộ linked Team/Task/Incident/Command Center presentation và state paths.
- History API parser/pushState/popstate không thay đổi; sidebar `Đội cứu hộ` vẫn trỏ `/teams`.
- Responsive Team CSS có breakpoints 1200/900/640 px và mobile-specific hierarchy.

## 13. Known limitations

- State persistence, account/role, scenario và GPS là local deterministic demo; reload reset dữ liệu.
- Không có GPS realtime, backend authorization, database hoặc multi-user sync.
- Repository chưa có browser automation runner; responsive/MapLibre interaction vẫn cần visual browser regression trong môi trường có vector-tile network.
- Production vẫn có cảnh báo main chunk >500 kB đã biết; detail maps tiếp tục lazy-load.

## 14. npm run lint

**PASS — 0 warnings, 0 errors** trên 54 files.

## 15. npm run build

**PASS** — TypeScript và Vite production build thành công. Cảnh báo bundle-size là non-blocking và không phát sinh từ lỗi Team module.
