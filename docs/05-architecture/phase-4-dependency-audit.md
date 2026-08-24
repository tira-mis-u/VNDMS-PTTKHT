# Phase 4 — Dependency audit

**Trạng thái:** IN PROGRESS  
**Ngày audit:** 24/08/2026  
**Phạm vi:** kiểm tra dependency/provenance trước khi quyết định capability nào đủ điều kiện triển khai.

## Quy tắc phân loại

- `DONE`: capability đã có đủ contract, canonical source và boundary cần thiết.
- `PARTIAL`: có implementation hữu ích nhưng chưa hoàn tất toàn bộ contract.
- `BLOCKED — thiếu dữ liệu`: không có nguồn dữ liệu nghiệp vụ có thẩm quyền/canonical.
- `BLOCKED — thiếu backend/persistence`: không có persistence, archive hoặc concurrency contract cần thiết.
- `BLOCKED — thiếu product contract`: chưa có quy tắc nghiệp vụ/lifecycle/authorization được phê duyệt.

Không tạo store, seed, localStorage, geometry, forecast hoặc workflow giả để thay dependency còn thiếu.

## Dependency matrix

| Capability | Trạng thái | Dependency bắt buộc | Kết quả audit repository | Quyết định Phase 4 |
|---|---|---|---|---|
| Cấu hình hệ thống | **BLOCKED — thiếu backend/persistence và product contract** | Schema/type/default; validation; permission; persistence; version/concurrency; audit; conflict hoặc rollback | Chưa tồn tại đầy đủ contract cấu hình có version, persistence, concurrency và rollback/conflict | Không tạo form lưu giả hoặc localStorage |
| Quan trắc/dự báo hiểm họa | **BLOCKED — thiếu dữ liệu và product contract** | Observation/forecast source có thẩm quyền; provenance; freshness; đơn vị; failure/empty-state contract | Không có authoritative observation/forecast adapter hoặc dataset được phê duyệt | Không tạo số liệu, chart hoặc “realtime” giả |
| Kho lịch sử thiên tai dài hạn | **BLOCKED — thiếu backend/persistence** | Archive/import; retention; canonical historical persistence; audit/provenance | Chỉ có trạng thái vận hành hiện tại và audit phù hợp phạm vi hiện hữu; không có historical archive contract | Không tạo history store song song |
| Xu hướng/dự báo dài hạn | **BLOCKED — thiếu dữ liệu** | Longitudinal baseline đủ độ dài; phương pháp; provenance; uncertainty contract | Không có baseline chuỗi thời gian dài hạn canonical | Không hard-code trend/forecast |
| Phát hành/phê duyệt báo cáo | **BLOCKED — thiếu product contract** | Numbering; approval; signature; authorization; lifecycle; audit; concurrency | Có cấu trúc/tổng hợp báo cáo nhưng chưa có contract phát hành/phê duyệt đầy đủ | Giữ trạng thái “Chưa cấp số · Chưa phê duyệt”; không thêm nút/workflow giả |
| Nhãn Hoàng Sa/Trường Sa | **PARTIAL** tại thời điểm audit | Source; ngày truy cập; CRS; conversion; geometry type; runtime anchor/collision/responsive evidence | Có hai Point có provenance và DMS → EPSG:4326; chưa có geometry quần đảo có thẩm quyền; evidence cũ dùng HTML Marker thay symbol runtime | Chỉ harden shared Point-label và tạo evidence Phase 4 mới |
| UI/product hardening đã hoàn thiện ở Phase 3 | **DONE, cần regression** | Shared typography/form/header/personnel/language/architecture contracts và browser/static gates | Contract và evidence Phase 3 tồn tại; không phải dependency mới | Không tái triển khai; chạy regression Phase 4 mới |

## GIS provenance decision

- Hoàng Sa: Point `[111.601944, 16.533333]`, chuyển từ `16°32′00″B, 111°36′07″Đ`, nguồn chính thức Đà Nẵng.
- Trường Sa: Point `[111.931944, 8.641667]`, chuyển từ `8°38′30″B, 111°55′55″Đ`, nguồn Công an Hà Tĩnh.
- CRS hiển thị: `EPSG:4326`.
- Hai điểm là tọa độ **Đảo Hoàng Sa** và **Đảo Trường Sa** được nguồn nêu tên; không phải centroid của quần đảo.
- Dataset geometry VN-2000 của MONRE chưa tải được; metadata catalog không đủ để tái dựng geometry.
- Phase 4 không được tạo ellipse, polygon, extent, bounding box hoặc tâm ước lượng.

## Kết luận audit

Không capability blocked nào đủ dependency để nâng trạng thái. Workstream được phép triển khai là hardening nhãn Point dùng chung và verification runtime mới; các workstream còn lại chỉ được regression/audit, không được thay dependency thật bằng dữ liệu hoặc persistence giả.
