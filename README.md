# VNDMS — Nền tảng Quản lý và Điều hành Phòng chống Thiên tai

VNDMS là đồ án modular-monolith frontend mô phỏng một hệ thống tác nghiệp điều phối phòng chống thiên tai tại Việt Nam. Ứng dụng tập trung vào bài toán liên kết Incident, Task, Rescue Team, Shelter/Evacuation, SOS, Relief/Warehouse, Playbook và Recovery trên **một canonical operational state** có phân quyền và mutation atomic cục bộ.

> Đây là application/frontend architecture có khả năng demo production-like. Project không có backend và không được xem là hệ thống production-secure.

## Bài toán

Điều hành thiên tai dễ phát sinh dữ liệu rời rạc: đội cứu hộ được giao ở nhiều màn hình, SOS không đồng bộ với Task, kho giữ hàng nhưng chuyến hàng không phản ánh, hoặc báo cáo khác dữ liệu chi tiết. VNDMS dùng một nguồn dữ liệu tác nghiệp duy nhất và các application use case để giữ các module nhất quán.

## Kiến trúc

```text
Presentation / Features
  → Application use cases, queries và authorization
  → Domain rules và entity types
  → Infrastructure adapters
```

Luồng mutation:

```text
UI hoặc AI-confirmed action
  → OperationalProvider command
  → permission + geography + ownership + linked-resource authorization
  → OperationalMutationBoundary draft
  → domain/application rules + canonical timeline
  → one commit hoặc full draft discard
```

- `OperationalProvider` là canonical state owner và application boundary duy nhất.
- `OperationalMutationBoundary` cung cấp rollback xác định cho state in-memory; không phải database transaction.
- Presentation chỉ nhận authorized canonical read view.
- Command Center, Analytics, Simulation và Grounded AI không sở hữu dataset tác nghiệp riêng.
- Feature routes được lazy-load; MapLibre nằm trong chunk riêng.

Xem [Architecture](./docs/05-architecture/ARCHITECTURE.md) và [Final System Readiness Audit](./docs/05-architecture/final-system-readiness-audit.md).

## Module map

| Nhóm                 | Chức năng chính                                                                     |
| -------------------- | ----------------------------------------------------------------------------------- |
| Command Center       | Tình hình, action queue, timeline, bản đồ và ngoại lệ nguồn lực                     |
| Incident             | Lifecycle, severity, task/team liên quan, timeline và đóng sự cố có invariant       |
| Task & Rescue Team   | Assignment/release, progress, field update, readiness và GPS local                  |
| Shelter & Evacuation | Capacity, occupancy, route, team assignment và redirect                             |
| SOS                  | Triage có giải thích, verification, Incident/Task/Team và resolution đồng bộ        |
| Relief & Warehouse   | Request, approval, stock reservation, shipment, receipt và ownership                |
| Playbook/SOP         | Template, prerequisite, execution, evidence và linked canonical entities            |
| Recovery             | Damage Assessment, milestone, budget, Task/Team/Relief và completion criteria       |
| Analytics            | Pure queries và báo cáo từ authorized canonical state                               |
| Simulation           | Kịch bản Lũ Sông Hồng deterministic, tick/reset qua mutation boundary               |
| Grounded AI          | Trả lời có evidence, recommendation cần confirmation; không phải LLM/RAG production |
| Admin & Audit        | Demo users, session local, role/scope management và security audit trail            |

Một số mục sidebar như Cảnh báo, Lịch sử thiên tai hoặc Cấu hình vẫn là placeholder có chủ đích và không tạo operational state riêng.

## Authorization

Project có một permission matrix và một resource-aware authorization system:

- RBAC theo vai trò;
- geographic scope;
- Rescue Team/Warehouse ownership;
- lifecycle/resource state;
- kiểm tra toàn bộ linked resources của multi-resource command;
- authorized read model trước Presentation, Analytics và AI;
- final authorization lại khi thực thi AI action đã xác nhận.

Đây vẫn là enforcement trong browser để chứng minh application architecture. Production bắt buộc lặp lại và thực thi chính sách ở server.

## GIS, Simulation và Grounded AI

- **GIS:** MapLibre GL JS, OpenFreeMap/OpenStreetMap, nhãn ưu tiên tiếng Việt và lớp tác nghiệp GeoJSON. Bản đồ cần kết nối mạng để tải vector tiles.
- **Simulation:** deterministic scenario seed `20240901`; tác động được áp dụng vào canonical state qua application contract và có thể reset về baseline.
- **Grounded AI:** engine rule/query-based cục bộ; FACT/INFERENCE/UNKNOWN có evidence canonical. Không gọi model bên ngoài, không embedding và không vector database.

## Công nghệ

React 19 · TypeScript 6 · Vite 8 · MapLibre GL JS · Lucide React · CSS design tokens · Node test runner qua `tsx`.

## Tài khoản demo

Mật khẩu dùng chung: `VNDMS@2026`.

| Tên đăng nhập        | Vai trò demo                     |
| -------------------- | -------------------------------- |
| `Trần Quốc Thuận`    | Chỉ huy                          |
| `Nguyễn Quốc Trung`  | Điều hành viên                   |
| `Phạm Văn Đam`       | Cán bộ địa phương, scope Tây Hồ  |
| `Phạm Trung Hiếu`    | Đội trưởng đội cứu hộ, đội CH-05 |
| `Lê Nguyễn Minh Trí` | Thành viên cứu hộ, đội CH-05     |
| `Nguyễn Nam Anh`     | Nhân viên kho KHO-01             |

## Chạy local

Yêu cầu Node.js hiện đại và npm.

```bash
npm install
npm run dev
```

Production build/preview:

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

Quality gates:

```bash
npm test
npm run test:focused
npm run lint
npm run build
```

## Route demo chính

`/login` · `/command` · `/incidents` · `/tasks` · `/teams` · `/shelters` · `/sos` · `/relief` · `/playbooks` · `/recovery` · `/analytics` · `/simulation` · `/ai-assistant` · `/admin/users` · `/admin/audit`.

Các detail routes dùng ID canonical, ví dụ `/incidents/INC-0241`, `/tasks/TSK-0241` và `/playbooks/PB-FLOOD-001/execute`.

## Testing

Test suite tập trung vào giá trị kiến trúc và nghiệp vụ thay vì coverage hình thức:

- domain lifecycle/transition rules;
- application use cases và analytics queries;
- authentication/session và resource authorization;
- mutation success, nested commit và full rollback;
- Task–Team, SOS–Task–Team, Shelter–Evacuation–Team, Relief–Warehouse–Shipment–Team;
- Playbook/Recovery cross-module consistency;
- deterministic Simulation propagation/reset;
- AI grounding, confirmation và final authorization;
- static scans cho canonical owner, permission matrix và mutation bypass.

Chi tiết tại [`tests/README.md`](./tests/README.md).

## Giới hạn production

Project hiện chưa có:

- backend/API và database persistence;
- server-side authorization hoặc database row-level policy;
- database transaction, concurrency control hoặc multi-client synchronization;
- realtime transport;
- immutable/tamper-proof audit;
- HttpOnly session, MFA, rate limiting, CSRF protection hoặc secret management;
- monitoring, observability, CI/CD và production deployment runbook;
- tile service do hệ thống kiểm soát.

Session, users và audit dùng local browser adapters; người dùng có thể sửa JavaScript/localStorage. Không dùng frontend này làm security boundary thực tế.

## Production roadmap

1. Backend API với server-side auth/resource authorization và durable database transaction.
2. Identity provider, HttpOnly session/MFA và immutable audit.
3. Realtime event delivery, idempotency, optimistic concurrency và observability.
4. CI/CD, browser E2E, accessibility regression và deployment hardening.
5. Tile source/cache có SLA cho môi trường vận hành.

## Demo end-to-end gợi ý

1. Đăng nhập `Trần Quốc Thuận`, xem Command Center và Incident `INC-0241`.
2. Mở SOS, xác minh/liên kết, tạo Task và điều phối Team.
3. Cập nhật Task để quan sát Team, SOS, Incident timeline và Analytics cùng thay đổi.
4. Thực hiện Relief hoặc Playbook linked mutation.
5. Chạy từng tick Simulation rồi reset baseline.
6. Hỏi AI Assistant và kiểm tra evidence/confirmation trước action.
7. Đăng nhập `Phạm Văn Đam` để chứng minh geographic read/mutation boundary.
8. Xem `/admin/audit` để giải thích security audit và giới hạn local demo.
