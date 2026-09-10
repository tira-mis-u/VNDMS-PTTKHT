# Testing — SOS Management

Files:

- `tests/domain/sos-management.test.ts`
- `tests/application/sos-management.test.ts`

13 SOS-focused pure tests cover:

- P1 calculation and explanations;
- vulnerable population effect;
- lifecycle/invalid transitions/waiting time;
- verification;
- Incident mapping/link;
- Task mapping + Team assignment contracts;
- resolution/closure;
- location re-triage;
- queue sorting;
- RBAC and Local Officer geographic scope.

Suite V2: `tests/application/sos-management.test.ts` 10 pass (09/09/2026).

Browser verification checklist: `/sos`, `/sos/SOS-0241`, search/filter/default ordering, verify/link/create Incident, create Task/dispatch, Task start/completion reflection, Shelter routing, MapLibre markers, timeline, back/forward, desktop/tablet/mobile. Browser automation runner remains future work; tile network is required for map visual verification.
