# Kiến trúc — Grounded deterministic operational assistant

## Pipeline

User Question → Intent Classification → Authorized Operational Query → Evidence Collection → Deterministic Reasoning → FACT/INFERENCE/RECOMMENDATION/UNKNOWN → Optional Confirmed Action → Existing OperationalProvider mutation → Existing audit/timeline → Updated canonical state.

## Layers

- Domain: AI contracts, statement/evidence/action types và intent rules.
- Application: authorized snapshot filtering, grounding, recommendation rules và confirmed action coordinator.
- Presentation: `/ai-assistant`, conversation workspace, evidence panel, confirmation dialog và entity context launches.
- Infrastructure: chưa cần provider ngoài; không có LLM SDK.

## State ownership

OperationalProvider vẫn là canonical owner duy nhất. AI page chỉ giữ conversation/panel/dialog presentation state cục bộ. Không có AI Context, store, event bus, entity repository, GIS, RBAC hoặc audit store mới.

## Authorization

`ai_assistant_use` được thêm vào permission matrix chuẩn cho các vai trò tác nghiệp, không cấp cho Citizen. Mỗi collection tiếp tục yêu cầu permission đọc tương ứng. `authorizedOperationalSnapshot` lọc theo geographic scope trước reasoning. Action coordinator kiểm tra permission, scope, ownership và state freshness lần nữa.

## Mutation và audit

AI không gọi setState hoặc domain mutation trực tiếp. Executor map về `assignTaskTeam`, `createRescueTaskFromSos`, `transitionTask`, `redirectEvacuation` và `createTask` của OperationalProvider. Vì vậy permission-boundary security audit và business timeline hiện hữu vẫn là canonical records.

## Simulation

Grounding đọc cùng canonical collections đã bị Simulation cập nhật. Khi simulation status/tick cho thấy trạng thái mô phỏng, response và UI công bố rõ đây không phải dữ liệu cảm biến.

## Provider boundary tương lai

Có thể bổ sung text-generation provider sau này để diễn đạt hoặc phân loại, nhưng provider phải nhận authorized evidence bundle và không được tự truy vấn/mutate canonical state. Deterministic grounding và action validation vẫn là authority.
