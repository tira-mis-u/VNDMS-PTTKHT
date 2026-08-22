# Kiến trúc — Simulation Engine

## Dependency flow

Presentation → simulation application use cases → deterministic domain engine → existing application contracts → OperationalProvider/canonical repository.

- `src/domain/simulation`: tick/state/event/hydrology deterministic.
- `src/application/simulation`: controls và operational propagation.
- `OperationalProvider`: owner duy nhất của simulation state và canonical collections.
- `inMemoryOperationalRepository.load()`: reset boundary.
- `src/features/simulation`: controls, timeline và MapLibre.

Không có SimulationContext, SimulationStore, event bus, router, GIS, RBAC hoặc operational entity model mới.

## Canonical propagation

Propagator tái sử dụng Incident severity/status, Task creation/transition/assignment, Team assignment/recalculation, Shelter occupancy, Evacuation progress/route, SOS creation/verification/link/resolution, Relief creation/transition, Playbook evidence và Recovery creation/approval/start contracts. Deterministic audit events được ghi vào collection module và Incident timeline.

## Integration

Command Center đọc canonical state và chỉ thêm một strip nhận diện khi simulation đang có tick. Analytics không có query riêng cho simulation; mọi thay đổi xuất hiện qua query hiện hữu. Map dùng `maplibre-gl`, `MAP_BASE_STYLE`, `applyVietnameseMapLabels` và sea-label layer hiện hữu.

## Authorization

Commander/Operator có `simulation_view` và `simulation_control`; Local Officer/Rescue roles chỉ view; Citizen không có quyền. Provider enforce control tại mutation boundary.
