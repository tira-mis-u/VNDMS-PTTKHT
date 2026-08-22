# Báo cáo hoàn thành — Simulation Engine

## Phạm vi

Đã triển khai engine deterministic 16 tick cho scenario Lũ Sông Hồng — Hà Nội, seed 20240901, với propagation vào canonical state của Incident, Evacuation, Shelter, SOS, Task, Team, Relief, Playbook và Recovery.

## Route/UI

`/simulation` và alias hữu ích `/simulation/red-river-flood`. UI gồm cảnh báo dữ liệu mô phỏng, controls, stage stepper, hydrological conditions, threshold, propagation list, event log và MapLibre thật.

## State/reset/idempotency

Simulation state nằm trong OperationalProvider hiện hữu nhưng tách kiểu khỏi business entities. Event IDs deterministic. Reset gọi repository baseline và thay toàn bộ collection atomically trong provider, không reload.

## Integration

Command Center thay đổi qua canonical collections và hiển thị strip nhận diện mô phỏng. Analytics dùng nguyên query path hiện hữu. Flood Playbook nhận trigger BĐ III trong execution canonical. Mọi record tạo bởi simulation dùng ID deterministic và route canonical.

## Validation

- Full regression: 115/115 test pass.
- Simulation-focused: 17/17 test pass trong đúng 3 file domain/application/integration.
- Oxlint: 0 warning, 0 error.
- TypeScript/Vite production build: pass.
- HTTP: 30/30 route Simulation, Analytics và regression trả 200.
- Documentation: đúng 5 artifact theo tên yêu cầu.
- Static checks: không có Context/store/event bus/GIS/RBAC/entity trùng lặp; không emoji, SVG map hoặc icon framework ngoài Lucide.
- MapLibre check: dùng `maplibre-gl`, canonical map config, OpenFreeMap và policy nhãn Quần Đảo Hoàng Sa/Quần Đảo Trường Sa.
- Integration tests xác nhận Analytics thay đổi từ canonical state, Command Center source collections nhận mutation và Reset sạch.

## Limitations

Hydrology là mô hình scenario đơn giản hóa, không phải dự báo thủy văn hoặc sensor realtime. Không có seek vì reset + replay an toàn hơn trong kiến trúc in-memory. Baseline deterministic reset cũng loại bỏ mọi mutation thủ công sau khi tải app. Timer Play là UI scheduler; engine và propagation vẫn synchronous deterministic theo Step.

## Technical debt

- Incident/timeline legacy còn timestamp chỉ `HH:mm`; simulation audit IDs bù khả năng truy vết nhưng nên chuẩn hóa toàn hệ thống sang ISO datetime.
- Provider hiện quản lý nhiều collection bằng các `useState` riêng; reset được React batch nhưng repository transaction adapter sẽ phù hợp hơn khi có backend.
- Main bundle tiếp tục có warning trên 500 kB; route-level lazy loading là cải tiến tương lai, không refactor trong task này.
