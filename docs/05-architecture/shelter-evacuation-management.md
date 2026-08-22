# Kiến trúc Shelter & Evacuation Management

Module tuân theo kiến trúc hiện hữu:

- Presentation: `src/features/shelters`.
- Application: `application/shelters`, `application/evacuations`, pure queries/use cases.
- Domain: `domain/shelters`, `domain/evacuations`.
- Infrastructure/data: deterministic seed dưới `data/scenarios/red-river-flood`, clone bởi in-memory repository; GIS dùng shared `mapConfig`.
- State: mở rộng canonical `OperationalProvider`; không có ShelterContext/EvacuationStore.

Provider là orchestration boundary cập nhật Shelter ↔ Evacuation ↔ Incident ↔ Team và event streams sau RBAC assertion. Team assignment tái sử dụng Team application contracts; Incident relationship dùng ID hiện hữu.

Routing thêm `/shelters` và `/shelters/:id` vào parser/History API hiện hữu. Command Center chỉ đọc canonical shelter/operation exceptions và marker, không redesign.

Map là MapLibre thật với OpenFreeMap config, Vietnamese label expression và Quần Đảo Hoàng Sa/Quần Đảo Trường Sa. Demo route geometry là deterministic local route, không phải routing engine/realtime traffic.

Persistence vẫn in-memory theo phiên. GPS, blocked roads và occupancy là scenario/demo updates; API/database/realtime multi-user/routing backend là tương lai.
