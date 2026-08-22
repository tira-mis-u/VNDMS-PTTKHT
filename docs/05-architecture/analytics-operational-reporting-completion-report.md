# Báo cáo hoàn thành — Analytics & Operational Reporting

## Phạm vi

Đã bổ sung phân tích vận hành đa phân hệ và báo cáo sau tác nghiệp theo kiến trúc read-only, trực tiếp trên dữ liệu canonical của VNDMS.

## Routes

- `/analytics`
- `/analytics/operations`
- `/analytics/resources`
- `/analytics/incidents`
- `/analytics/reports`

## Thành phần

Domain read models định nghĩa basis, distributions, module analytics, exceptions và report. Application query layer thực hiện filter/aggregation/timing/report generation. Presentation cung cấp tổng quan, Incident/Task, Team/Shelter/Evacuation/Relief, SOS/Recovery exceptions và báo cáo in-ready.

## Tích hợp

Incident, Task, Team, Shelter, SOS, Relief Request, Warehouse và Recovery có drill-down về route hiện hữu. Active Playbook execution xuất hiện trong operational summary. Không tạo state hoặc entity mới.

## Validation

- Full regression: 98/98 test pass, gồm 11 focused Analytics tests.
- Oxlint: 0 warning, 0 error.
- TypeScript/Vite production build: pass.
- HTTP: 28/28 Analytics và regression route trả 200.
- Documentation: đúng 5 artifact Analytics.
- Static checks: không có store/context/event bus/GIS/icon framework trùng lặp, emoji, SVG thủ công hoặc calculation heuristic trong JSX.

## Giới hạn

Dữ liệu seed là deterministic, không realtime. Một số timeline legacy chỉ lưu `HH:mm`, query neo vào ngày tạo Incident. Incident acknowledgement dựa trên event đánh giá/xác nhận đầu tiên; dispatch dựa trên assignment/dispatch đầu tiên. Export chuyên biệt (Excel/PDF adapter) chưa có; report dùng print/Lưu PDF của trình duyệt. Chart dùng CSS có chủ đích để tránh thêm dependency.

## Technical debt phát hiện

- Event timestamp nên được chuẩn hóa thành ngày giờ đầy đủ/ISO để loại bỏ quy tắc neo ngày.
- Capability demand hiện ánh xạ bảo thủ từ từ khóa Task và Evacuation; taxonomy năng lực có cấu trúc sẽ cho dự báo chính xác hơn.
- Main bundle tiếp tục vượt ngưỡng cảnh báo 500 kB; code splitting theo route là cải tiến sau, không thực hiện trong module này để tránh refactor router hiện hữu.
