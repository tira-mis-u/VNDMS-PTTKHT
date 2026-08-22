# Kiểm thử — Playbook Management

## Domain

Lifecycle execution/step, invalid transition, prerequisite, readiness, blocked state, required/optional, progress và completion criteria.

## Application

Activation, publish, pause/resume/cancel, start/complete/skip, evidence, completion safeguard, RBAC và geographic scope.

## Cross-module

- Incident reference canonical.
- Task tạo bằng application contract hiện hữu và step chỉ giữ ID.
- Team dispatch dùng assignment hiện hữu.
- Shelter/Evacuation/SOS/Relief references phải tồn tại trong scenario.
- Timeline có activation, start, completion và blocked event.

## Quality gate

Chạy `npx --yes tsx --test tests/**/*.test.ts`, `npm run lint`, `npm run build`, sau đó kiểm tra HTTP 200 cho route cũ và `/playbooks`, `/playbooks/PB-FLOOD-001`, `/playbooks/PB-FLOOD-001/execute`.
