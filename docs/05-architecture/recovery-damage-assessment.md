# Kiến trúc — Recovery & Damage Assessment

Module tuân thủ Presentation → Application → Domain và dùng Infrastructure/state hiện tại.

- `src/domain/recovery`: entity, lifecycle, budget, overdue, progress và completion rules.
- `src/application/recovery`: pure mutations/use cases và queries operational.
- `src/data/scenarios/red-river-flood/recoverySeed.ts`: assessment/project liên kết INC-0241.
- `OperationalProvider`: canonical owner duy nhất của assessment, project và recovery events.
- `src/features/recovery`: list/detail và MapLibre adapter dùng `mapConfig` chung.

## Cross-module

Incident Detail dẫn xuất recovery summary. Task completion/progress gọi đồng bộ progress dự án. Team và Relief chỉ được reference. Playbook execution tạo project qua Recovery use case. Recovery mutation tạo RecoveryEvent và IncidentEvent hiện hữu.

## RBAC/scope

Permission matrix hiện hữu được mở rộng bằng `damage_assessment_*` và `recovery_project_*`. Provider enforce permission và `assertRecoveryScope` tại mutation boundary. Local Officer không verify/approve và không thao tác ngoài Hà Nội.

Không có RecoveryContext, store, event bus, GIS abstraction, Team assignment hay inventory mới.
