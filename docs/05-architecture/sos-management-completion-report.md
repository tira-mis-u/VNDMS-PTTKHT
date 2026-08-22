# Completed SOS & Emergency Request Management on the existing VNDMS architecture

Ngày hoàn tất: 21/08/2026. Đây là feature implementation tăng dần, không rebuild, redesign shell hoặc tạo state/GIS/permission system khác.

## 1. Files created

### Domain/application/data

- `src/domain/sos/types.ts`, `src/domain/sos/rules.ts`
- `src/application/sos/sosUseCases.ts`, `src/application/sos/sosQueries.ts`
- `src/data/scenarios/red-river-flood/sosSeed.ts`

### Presentation

- `src/features/sos/index.ts`
- `src/features/sos/pages/SosListPage.tsx`
- `src/features/sos/pages/SosDetailPage.tsx`
- `src/features/sos/components/SosActionDialogs.tsx`
- `src/features/sos/components/SosOperationalMap.tsx`
- `src/styles/sos.css`

### Tests/docs

- `tests/domain/sos-management.test.ts`
- `tests/application/sos-management.test.ts`
- `docs/03-use-cases/sos-management.md`
- `docs/04-domain-model/sos.md`
- `docs/05-architecture/sos-management.md`
- `docs/12-testing/sos-management.md`
- Báo cáo này.

## 2. Files modified

- Router/App/sidebar/styles entry và README.
- Canonical Operational state contract/provider, repository snapshot và RBAC.
- Incident Detail để hiển thị SOS liên quan.
- Task lifecycle orchestration để phản ánh start/completion/cancellation về SOS.
- Command Center Resource Exceptions/Operational Map để đọc canonical SOS và điều hướng `/sos/:id`.
- Không tạo SOSContext, SOSStore, EmergencyStore hoặc event bus mới.

## 3. Domain/application changes

- `SosRequest` chứa reporter/source/contact, location/access, population/vulnerable counts, severity, P1–P4 priority + reasons, lifecycle/verification, Incident/Task/Team/Shelter/Evacuation links và resolution.
- Explicit transition matrix: tiếp nhận → xác minh → điều phối → cứu hộ → xử lý → đóng; reject/no-contact/cancel có rule riêng.
- Deterministic triage giải thích từng yếu tố: life threat, population, injury/missing, vulnerable groups, isolation/access, communication.
- Mapping helpers tạo input cho Incident/Task/Evacuation contracts hiện hữu; không sao chép entity model.
- Pure queue query sắp xếp P1/P2, waiting-too-long, unverified, unassigned, newest.
- Geographic scope assertion cho Local Officer và Provider-level permission enforcement.

## 4. Routes/UI implemented

- `/sos`: operational queue với search, priority/lifecycle/verification/area/assignment/Incident/time filters và default intervention ordering.
- `/sos/:sosId`: emergency facts first, triage explanation, reporter/verification, affected people, linked entities, real MapLibre, timeline và resolution.
- Mobile layout ưu tiên P1/P2, location, population, response status/action và map.

## 5. Real actions/integrations

- Verify, reject, cancel, link/create Incident, create rescue Task, dispatch Team, priority/location/field updates, no-contact, Shelter/Evacuation routing, resolve and close are canonical mutations.
- Incident creation carries location, severity, affected population and source while preserving SOS.
- Task creation uses Task use case; Team eligibility/lifecycle uses Team use cases.
- Task start/progress changes SOS to Đang cứu hộ; Task completion resolves SOS; Task cancellation returns it for redispatch.
- Shelter action uses existing capacity checks and creates Evacuation through its application contract.
- Command Center surfaces P1/unassigned/waiting SOS and opens the real route. Canonical map markers navigate to SOS.

## 6. GIS

Shared MapLibre/OpenFreeMap config is reused. The SOS map displays SOS, Incident, Task, Team, Shelter, current/blocked/alternative evacuation routes. Markers navigate to existing entity routes. Vietnamese labels and Quần Đảo Hoàng Sa/Quần Đảo Trường Sa behavior remain centralized; no fake SVG/canvas map.

## 7. Tests

- SOS-focused pure tests: **13 pass** for priority/reasons, vulnerable handling, lifecycle/invalid transitions, verification, Incident mapping, Task/Team assignment, Shelter/Evacuation input, resolution/closure, re-triage, queue ordering, RBAC and geographic scope.
- Complete Team + Shelter/Evacuation + SOS regression suite: **34 pass, 0 fail**.
- HTTP 200 confirmed for `/`, `/sos`, `/sos/SOS-0241`, `/sos/SOS-0243`, and existing Incident/Task/Team/Shelter routes.

## 8. Lint/build

- `npm run lint`: **PASS — 0 warnings, 0 errors** on 81 files.
- `npm run build`: **PASS**; SOS map emits a separate lazy chunk.
- Existing non-blocking main bundle >500 kB warning remains.

## 9. Known limitations

- SOS intake is deterministic scenario data; no live 112/telephony/mobile gateway.
- State resets on reload; no database, server authorization or multi-user synchronization.
- Location, proximity/distance and blocked routes are local scenario values, not realtime feeds.
- Alternative routes are deterministic geometry, not a routing engine response.
- Browser automation runner is not installed; MapLibre visual verification requires tile network access.
