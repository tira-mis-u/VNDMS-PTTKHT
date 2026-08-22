# Kiến trúc — Analytics & Operational Reporting

## Luồng phụ thuộc

Presentation (`src/features/analytics`) → pure application queries (`src/application/analytics/analyticsQueries.ts`) → domain read models (`src/domain/analytics/types.ts`) → canonical collections từ `OperationalProvider`.

Không có Analytics context/store, event bus, repository, permission system, entity copy hay GIS abstraction mới. Module read-only và không thay đổi state.

## Query layer

Query functions gồm operational summary; Incident, Task, Team, Shelter, Evacuation, SOS, Relief và Recovery analytics; operational exceptions; report builder. Date parsing, period/geographic/Incident filter, distribution và averages nằm ngoài React.

## Presentation

Bốn page component phục vụ năm route (root và operations dùng cùng page), dùng tab điều hướng, filter chung, restrained card/table/bar, drill-down và print-ready report. Charts là HTML/CSS có ý nghĩa tác nghiệp, không thêm chart framework.

## Tích hợp

Mỗi dòng liên kết về route canonical Incident, Task, Team, Shelter, SOS, Relief Request, Warehouse và Recovery. Playbook executions được đọc trong operational summary. Report source ghi rõ `OperationalProvider — dữ liệu canonical`.

## Export boundary

`buildOperationalReport()` trả read model độc lập với UI. Hiện tại `window.print()` cung cấp in/Lưu PDF; nút xuất tệp bị vô hiệu hóa có giải thích thay vì tạo backend/export infrastructure giả.
