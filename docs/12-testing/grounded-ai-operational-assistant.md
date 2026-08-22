# Kiểm thử — Grounded AI Operational Assistant

## Grounding

Kiểm tra FACT lấy giá trị từ snapshot chuẩn, evidence ID đúng, entity không tồn tại trả UNKNOWN, mọi FACT có evidence, shelter capacity là derived value và simulation được nhận diện.

## Reasoning

Kiểm tra P1 verified/unassigned SOS, overdue Task, available Team, shelter pressure, relief shortage và blocked playbook step. Quy tắc phải xác định và không phụ thuộc external API.

## Authorization

Kiểm tra Local Officer không thấy entity ngoài scope; Citizen bị từ chối toàn bộ AI operational access; recommendation dùng canonical permission; action confirmation re-check permission, scope, ownership và stale state.

## Actions

Kiểm tra proposal không mutate trước confirmation; confirmed action gọi existing application contract; canonical task, timeline và security audit behavior được giữ; stale team chặn execution.

## UI/integration

Kiểm tra route `/ai-assistant`, navigation/header shell, context query từ Incident/Task/Team/Shelter/SOS, evidence panel, confirmation dialog, execution result và simulation notice.

## Quality gates

Chạy AI-focused tests, full `tests/**/*.test.ts`, lint, build, route HTTP check và static scans cho duplicate state/permission/audit/event bus, emoji, icon ngoài Lucide, mock map và hard-coded operational answer.
