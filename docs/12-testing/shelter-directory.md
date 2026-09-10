# Testing — Shelter Directory (V2)

Test chuyên biệt cho Evacuation đã gỡ cùng module. Danh mục điểm sơ tán được kiểm gián tiếp qua:

- `tests/application/p0-read-authorization.test.ts` (citizen vẫn thấy danh mục điểm sơ tán)
- `tests/application/alert-management.test.ts`, `tests/domain/alert-management.test.ts` (cảnh báo quá tải/gần đầy)
- `tests/application/unified-operational-map.test.ts` (lớp điểm sơ tán trên bản đồ)

Coverage còn giữ:

1. available capacity và occupancy percentage;
2. near-capacity/overload detection → cảnh báo tác nghiệp;
3. citizen vẫn tra cứu được danh mục điểm sơ tán qua authorized read view.

Integration verification cần kiểm tra `/shelters`, `/shelters/SHELTER-HN-03`, direct navigation/back-forward, cập nhật sức chứa, Command Center dải nguồn lực vượt ngưỡng và MapLibre layers.
