# Kiểm thử — Simulation Engine

## Domain

Seed deterministic, tick/time/event order, Play/Pause/Speed, BĐ III threshold, risk/stage và explainability.

## Application

Incident/Playbook trigger, route, Shelter pressure, SOS, Task, Team assignment, Relief, progress/stabilization, Recovery, event idempotency và clean reset.

## Integration

Analytics before/after canonical mutation, Command Center source collections/resource pressure, RBAC và deterministic rerun.

## Quality gate

- Simulation tests: `npx --yes tsx --test tests/domain/simulation-engine.test.ts tests/application/simulation-propagation.test.ts tests/integration/simulation-cross-module.test.ts`.
- Full suite: `npx --yes tsx --test tests/**/*.test.ts`.
- `npm run lint`, `npm run build`.
- HTTP 200 cho `/simulation`, route module và regression routes.
- Static scan cho duplicate architecture, emoji, icon ngoài Lucide, mock/SVG map và geographic policy.
