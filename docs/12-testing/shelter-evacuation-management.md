# Testing — Shelter & Evacuation Management

Automated pure tests:

- `tests/domain/shelter-evacuation-management.test.ts`
- `tests/application/shelter-evacuation-management.test.ts`

Coverage:

1. available capacity và occupancy percentage;
2. near-capacity/overload detection;
3. status/readiness/accessibility contradictions;
4. capacity/open validation;
5. evacuation transitions;
6. assignment và Team synchronization;
7. blocked/alternative route state;
8. progress, completion và Team release;
9. shelter/evacuation RBAC denial cho Citizen.

Integration verification cần kiểm tra `/shelters`, `/shelters/TH-01`, direct navigation/back-forward, create/approve/assign/progress/redirect/complete, Incident evacuation summary, Team active operation, Command Center exceptions và MapLibre layers.

Không tuyên bố test GPS realtime, traffic routing hoặc multi-user backend vì chưa triển khai. Browser automation runner chưa được thêm; production compile, HTTP routes và visual preview là regression boundary hiện tại.
