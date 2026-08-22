# Chiến lược kiểm thử VNDMS

Test suite dùng Node test runner thông qua `tsx`. Mục tiêu là chứng minh domain rules, application contracts, authorization và cross-module consistency; không chạy theo coverage phần trăm hình thức.

## Chạy test

```bash
npm test
npm run test:focused
```

- `npm test`: toàn bộ domain, application và integration regression.
- `npm run test:focused`: mutation boundary, authorization, final hardening, AI và Simulation critical paths.

## Cấu trúc

### `tests/domain`

Kiểm tra lifecycle và calculation thuần cho Team, Shelter/Evacuation, SOS, Relief, Playbook, Recovery và Simulation engine.

### `tests/application`

Kiểm tra:

- authentication/session;
- RBAC, geographic scope và ownership;
- authorized canonical read model;
- resource-aware multi-resource authorization;
- mutation draft, nested commit và rollback;
- Incident closure invariants;
- module use cases và analytics/reporting queries;
- alert derivation, authorized alert view, read/ack qua mutation boundary;
- evacuation workspace queries, permission map và authorized-read regressions;
- Command Center quick action plans, boundary enforcement, rollback và projection refresh;
- navigation access: route↔label highlight parity, RBAC-driven sidebar filtering, post-login landing path và GIS sea-label/island-zone invariants;
- deterministic Simulation propagation;
- AI grounding và authorization reasoning.

### `tests/integration`

Kiểm tra các liên kết quan trọng:

- confirmed AI action → current-state authorization → canonical command;
- Playbook → Incident/Task/Team/Shelter/SOS/Relief;
- Recovery → Incident/Assessment/Task/Team/Relief;
- Relief → Warehouse/Reservation/Shipment/Team;
- Simulation → canonical state/Analytics/Command Center;
- Alerts → authorized view/mutation boundary/Command Center/AI/Analytics/Simulation;
- Evacuations → canonical change propagation/alerts self-resolve/authorized pruning;
- authentication và security audit attribution.

## Static architecture assertions

Một số test đọc source để bảo vệ các invariant không cần DOM:

- operational commands được publish qua `atomic(command)`;
- chỉ có một permission matrix;
- authorization invocation có resource context;
- Command Center không có operational dataset thứ hai;
- AI không mutate canonical state trực tiếp.

Các assertion này bổ sung cho behavior tests, không thay thế chúng.

## Browser regression thủ công

Trước demo/release cần kiểm tra:

1. login và route guard theo role;
2. direct detail URL, back/forward và 404;
3. desktop/tablet/mobile shell;
4. dialog validation, disabled action và failure feedback;
5. MapLibre loading với/không có mạng;
6. end-to-end Incident → SOS → Task → Team;
7. Relief, Playbook, Recovery, Analytics, Simulation và AI confirmation;
8. Admin users và audit trail.

Project chưa thêm browser E2E runner hoặc CI; đây là production roadmap thay vì được mô phỏng bằng test giả.
