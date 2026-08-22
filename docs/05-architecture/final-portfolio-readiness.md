# VNDMS — Final Portfolio Readiness

## 1. Current architecture

VNDMS là modular-monolith frontend theo hướng `Presentation → Application → Domain`; Infrastructure chỉ cung cấp adapter tại composition boundary. `OperationalProvider` là canonical state owner duy nhất. Mọi thay đổi tác nghiệp đi qua `OperationalMutationBoundary` để kiểm quyền/resource, làm việc trên draft và commit một lần hoặc loại bỏ toàn bộ draft khi lỗi. Command Center, các module chi tiết, Analytics, Simulation và Grounded AI cùng đọc authorized canonical view, không sở hữu operational dataset riêng.

## 2. Demo flow

Flow chính: Login → Command Center → Incident → Task → Rescue Team → Shelter/Evacuation → SOS → Relief/Warehouse → Playbook execution → Recovery assessment/project → Analytics → Simulation → Grounded AI → Audit. Detail pages có back navigation và liên kết theo canonical ID; Incident, Task, Team, Shelter và SOS có thể mở AI với entity context.

## 3. Security model

Một permission matrix áp dụng RBAC, geographic scope, Team/Warehouse ownership, lifecycle và linked-resource authorization tại read/mutation boundary. AI action cần xác nhận, đọc lại state hiện tại và được authorize lại trước command. Đây là enforcement của frontend demo, **không phải production security**: production vẫn cần server authorization, HttpOnly session, durable persistence, immutable audit và database transaction/concurrency control.

## 4. Main modules

- Command Center và GIS MapLibre;
- Incident, Task và Rescue Team;
- Shelter/Evacuation, SOS và Relief/Warehouse;
- Playbook/SOP và Recovery;
- Analytics/reporting;
- deterministic Simulation;
- Grounded AI có FACT/INFERENCE/UNKNOWN, canonical evidence và confirmed action;
- local authentication, profile, Admin và security audit.

Scenario chính là “Lũ Sông Hồng — Hà Nội”. GIS chỉ bổ sung hai custom label: `Quần Đảo Hoàng Sa` và `Quần Đảo Trường Sa`.

## 5. Quality gates

- Full regression: 195 tests.
- Critical focused regression: 34 tests.
- Lint và TypeScript: không lỗi.
- Vite production build và SPA deep-link/route checks: đạt.
- Identity/reference regression bảo vệ sáu demo accounts, canonical personnel, Rescue Team members, affected people và cross-module IDs.
- Browser audit bao phủ login/logout, session restore, unauthorized route, 404, lazy routes, MapLibre, Simulation, AI, Admin và các interactive control chính.

## 6. Known limitations

Không có backend/API, database persistence, server-side authorization, realtime multi-user, immutable audit, MFA/rate limiting, observability, CI/CD hoặc controlled tile SLA. Local atomicity không phải database transaction. MapLibre vẫn tạo lazy chunk lớn; dialog keyboard/focus behavior chưa có automated accessibility regression toàn diện.

## 7. Interview talking points

- Lý do chọn một canonical owner thay vì nhiều feature store.
- Cách application/domain rules giữ consistency xuyên module.
- Resource-aware authorization và authorized read model.
- Draft/commit/discard của local mutation boundary và giới hạn so với ACID.
- Simulation deterministic nhưng vẫn đi qua canonical command path.
- Grounded AI không trực tiếp mutate và không được mô tả là LLM/RAG production.
- Trade-off hợp lý của portfolio frontend: nghiệp vụ sâu, testable architecture và production limitations minh bạch.

## 8. Suggested demo sequence

1. Đăng nhập `Trần Quốc Thuận`, giới thiệu Command Center và `INC-0241`.
2. Đi theo liên kết Incident → Task/Team → SOS/Shelter/Relief, chỉ ra timeline và canonical IDs.
3. Mở Playbook execution và Recovery assessment/project.
4. Mở Analytics để chứng minh projection thay đổi theo canonical state.
5. Chạy từng tick Simulation rồi reset deterministic baseline.
6. Mở AI từ entity context, kiểm evidence và confirmation trước action.
7. Đăng nhập tài khoản giới hạn scope/ownership để demo Access Denied và authorization.
8. Kết thúc tại Audit, sau đó nêu rõ ranh giới frontend demo và production roadmap.
