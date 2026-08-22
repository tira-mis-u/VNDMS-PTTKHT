# Architecture — SOS Management

- Presentation: `src/features/sos` list/detail/dialog/MapLibre.
- Application: `application/sos/sosUseCases.ts`, `sosQueries.ts`.
- Domain: `domain/sos` framework-independent model/rules.
- Data: deterministic `sosSeed.ts`, cloned by existing in-memory repository.
- State: canonical `OperationalProvider`; no SOSContext/SOSStore/event bus.

Provider orchestrates SOS ↔ Incident ↔ Task ↔ Team ↔ Shelter/Evacuation and all timelines after RBAC/scope checks. Mapping helpers produce existing Incident/Task/Evacuation inputs; feature UI does not duplicate those models.

Routes `/sos` and `/sos/:id` use the existing History API parser. Command Center only consumes canonical SOS queue/exceptions/markers. Incident Detail adds a related SOS section; existing visual structure remains intact.

SOS map uses shared OpenFreeMap config, Vietnamese label policy and Quần Đảo Hoàng Sa/Quần Đảo Trường Sa data. Marker click navigates to operational entities. No separate GIS initialization or mock map.

State, calls, location and route geometry are local deterministic demo data. No telephony integration, realtime GPS, API/database or multi-user backend is claimed.
