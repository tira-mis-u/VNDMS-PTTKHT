# Báo cáo triển khai — Playbooks / SOP tác chiến

## Phạm vi

Đã thêm module quản lý template và execution tác chiến vào VNDMS hiện tại mà không thay shell, design system, router architecture, OperationalProvider, GIS hoặc permission architecture.

## Domain/Application

Tách Playbook template, Step, Execution, Step Execution và timeline. Rule kiểm soát publish/activation, lifecycle, prerequisites, readiness, skip override, completion criteria và required-step completion. Use cases bao phủ create/update/publish/archive/activate, pause/resume/cancel/complete, add/reorder step, assign owner, evidence, start/complete/skip và queries.

## UI/Route

- `/playbooks`: danh sách, tìm kiếm, lọc và sắp xếp.
- `/playbooks/:playbookId`: overview, trigger, scope, phiên bản và step sequence.
- `/playbooks/:playbookId/execute`: sequence là trọng tâm; current/next/blocked, owner, prerequisites, evidence, entity links, action và timeline.

## Integration

Incident Detail có khu vực Quy trình tác chiến. Command Center có active execution, progress, current/next và blocked exception. Task có thể được tạo trực tiếp từ bước bằng Task use case hiện hữu. Team/Evacuation/Shelter/SOS/Relief giữ lifecycle canonical và chỉ được Playbook tham chiếu.

## Scenario

`PB-FLOOD-001 — Ứng phó Lũ lớn Sông Hồng — Hà Nội`, 10 bước, execution `PBX-0241`, liên kết INC-0241, TSK-0241/0242, CH-01, TH-01, EVAC-001, SOS-0241 và REQ-0241/0242.

## Xác minh

- `npx --yes tsx --test tests/**/*.test.ts`: 66 pass, 0 fail.
- `npm run lint`: 0 warning, 0 error.
- `npm run build`: PASS; chỉ còn cảnh báo kích thước main bundle trên 500 kB.
- HTTP: 18 route mới/cũ quan trọng đều trả 200, gồm ba route Playbook và Command Center, Incident, Task, Team, Shelter, SOS, Relief/Warehouse.

## Giới hạn

State là deterministic local scenario, không phải backend/realtime/multi-user. Không có simulation hoặc AI. Browser automation chưa được cấu hình; MapLibre không cần thay đổi cho module này.
