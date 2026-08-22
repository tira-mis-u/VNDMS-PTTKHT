# Kiến trúc — Playbook Management

Module tiếp tục pattern Presentation → Application → Domain và Infrastructure hiện hữu.

- `src/domain/playbooks`: types, lifecycle, prerequisite, readiness, progress và completion evaluation.
- `src/application/playbooks`: use cases pure và queries riêng.
- `src/data/scenarios/red-river-flood/playbookSeed.ts`: template/execution tham chiếu scenario canonical.
- `OperationalProvider`: chủ sở hữu duy nhất của Playbook, Execution và timeline; không có PlaybookContext/Store/EventBus mới.
- `src/features/playbooks`: list, template detail và execution UI.

## Tích hợp

Task tạo từ bước gọi `createTaskEntity` hiện hữu và được thêm vào canonical Task state. Team readiness dùng assignment contract hiện hữu. Evacuation, Shelter, SOS và Relief chỉ được liên kết bằng ID; completion đọc trạng thái canonical. Incident Detail và Command Center chỉ dẫn xuất summary từ execution.

## RBAC và scope

Mở rộng permission matrix hiện hữu bằng `playbook_view/edit/publish/activate/execute/override/cancel`. Activation dùng `assertPlaybookScope`; Local Officer bị chặn ngoài Hà Nội. Permission được kiểm tra trong mutation boundary của OperationalProvider.

## Audit

Playbook event nằm trong canonical operational snapshot theo pattern event array hiện tại. Event execution đồng thời xuất hiện trong timeline execution và Incident event stream; không tạo event bus.
