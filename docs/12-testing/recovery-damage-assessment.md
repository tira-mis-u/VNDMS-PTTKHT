# Kiểm thử — Recovery & Damage Assessment

## Domain

Assessment/project/milestone lifecycle, empty assessment, verified immutability, rejection/revision, completion criteria, progress và budget derivation.

## Application

Create/update/submit/review/verify/reject, project approval, budget override, milestone execution, query sorting, RBAC và geographic scope.

## Integration

Incident references, Task contract/progress, Team, Relief, Playbook transition, timeline và Command Center exceptions.

## Quality gate

- Chạy toàn bộ suite bằng `npx --yes tsx --test tests/**/*.test.ts`.
- `npm run lint` phải 0 warning/error.
- `npm run build` phải pass.
- Kiểm tra HTTP 200 cho năm route Recovery và các route Command Center/Incident/Task/Team/Shelter/SOS/Relief/Playbook.
- Map test thủ công xác nhận OpenFreeMap, nhãn Việt Nam và polygon/marker nghiệp vụ.
