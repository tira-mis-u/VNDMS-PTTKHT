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
- Shelter capacity + Evacuation input;
- resolution/closure;
- location re-triage;
- queue sorting;
- RBAC and Local Officer geographic scope.

Complete pure regression suite (Team + Shelter/Evacuation + SOS): 34 pass, 0 fail on 21/08/2026.

Browser verification checklist: `/sos`, `/sos/SOS-0241`, search/filter/default ordering, verify/link/create Incident, create Task/dispatch, Task start/completion reflection, Shelter routing, MapLibre markers, timeline, back/forward, desktop/tablet/mobile. Browser automation runner remains future work; tile network is required for map visual verification.
