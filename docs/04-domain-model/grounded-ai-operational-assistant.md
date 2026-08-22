# Domain model — Grounded AI Operational Assistant

## AiIntent

Các intent: current situation, incident analysis, task analysis, team availability, shelter capacity, SOS prioritization, evacuation status, relief shortage, recovery status, playbook status, operational exceptions, recommendation request, entity lookup và unknown.

## AiEvidence

Evidence gồm source, entityType, entityId, field, value, timestamp tùy chọn và valueKind (`recorded`/`derived`). Evidence không chứa bản sao entity hoặc relationship mới.

## AiStatement và AiResponse

AiStatement có classification, text và evidenceIds. AiResponse chứa conclusion, statements, evidence, optional actions, simulation marker, intent và generatedAt. FACT phải có evidence; UNKNOWN không được dùng dữ liệu suy đoán.

## AiActionProposal

Proposal mô tả action type, permission chuẩn, target, resource scope, affected resources, current state và payload ID. Proposal chưa phải mutation. `AiActionRequest.confirmed` phải là true trước khi executor được gọi.

## Grounding snapshot

`AiGroundingSnapshot` là typed read view tham chiếu các collection đã thuộc OperationalProvider. Đây không phải AI state hay nguồn dữ liệu thứ hai; snapshot chỉ tồn tại trong một lần query/action re-check.

## Quy tắc xác định

Rules dùng trạng thái, ưu tiên, dueAt, capacity/occupancy/reservation, verification/assignment, inventory/reservation, execution step và recovery progress hiện có. Không có probabilistic model hoặc external knowledge.
