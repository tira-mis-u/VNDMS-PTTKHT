# Báo cáo hoàn thành — Recovery & Damage Assessment

## Triển khai

Đã bổ sung lớp nghiệp vụ khôi phục incremental trên VNDMS, giữ nguyên shell, design system, custom router, OperationalProvider, RBAC và GIS infrastructure.

## Domain/Application

DamageAssessment, DamageItem, verification/revision; RecoveryProject, RecoveryMilestone, budget và completion verification. Rules kiểm soát lifecycle, verified immutability, rejection reason, verified basis, budget override, derived progress và completion safeguard. Use cases/query đầy đủ cho assessment, project, milestone và operational exceptions.

## UI/Route

- `/recovery`, `/recovery/assessments`
- `/recovery/assessments/:assessmentId`
- `/recovery/projects`
- `/recovery/projects/:projectId`

List là operational queue; detail có impact/evidence/verification hoặc milestone/resources/budget/progress/timeline. Map dùng MapLibre/OpenFreeMap và policy nhãn Việt Nam hiện tại.

## Integration

Incident Detail có Đánh giá thiệt hại & Khôi phục. Command Center có recovery exceptions. Task canonical tác động progress; Team/Relief chỉ reference. Playbook execution có action tạo project recovery. Mọi recovery event liên quan Incident được đẩy vào Incident timeline.

## Scenario

4 assessment credible tại Phúc Tân, Âu Cơ, Tứ Liên, Yên Phụ và 3 dự án khôi phục liên kết INC-0241, TSK-0242, CH-03, REQ-0241/0242.

## Xác minh

- Full regression: 87/87 test pass.
- Recovery tests: đúng 3 file; Recovery docs: đúng 5 file.
- Oxlint: 0 warning, 0 error.
- TypeScript/Vite production build: pass.
- HTTP: 23/23 route Recovery và regression trả 200.
- Duplicate architecture/emoji/forbidden icon scan: không phát hiện vi phạm.
- MapLibre check: Recovery dùng `maplibre-gl`, `mapConfig` canonical, OpenFreeMap và lớp nhãn Quần Đảo Hoàng Sa/Quần Đảo Trường Sa.

## Giới hạn

Dữ liệu là deterministic local scenario, không phải backend/realtime/accounting. Budget control là nghiệp vụ đơn giản. Chưa có browser automation; bundle-size warning hiện hữu vẫn còn. Workspace không có metadata `.git`, vì vậy không thể xuất `git status/diff`.
