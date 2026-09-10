# Domain model — Shelter (danh mục điểm sơ tán, V2)

## Shelter

`Shelter` gồm identity/address/coordinates, capacity/current occupancy/reserved capacity, status/readiness/accessibility, officer/contact, facilities, y tế, nước/lương thực/điện/vệ sinh, hỗ trợ người yếu thế, giờ mở/đóng, Incident links, active operations, notes và audit timestamp.

Derived values:

- `availableCapacity = max(0, capacity - currentOccupancy - reservedCapacity)`
- `occupancyPercentage = round(currentOccupancy / capacity × 100)`
- Quá tải khi occupancy >= capacity.
- Gần đầy khi tổng occupancy + reserved đạt ít nhất 85% nhưng occupancy chưa quá tải.

Status: Sẵn sàng, Đang tiếp nhận, Gần đầy, Quá tải, Tạm đóng, Không thể tiếp cận. Readiness và accessibility là khái niệm riêng; domain không cho điểm đóng/không thể tiếp cận nhận thêm dân.

## Invariants (V2)

- Không ghi occupancy vượt capacity từ UI; trạng thái Quá tải/Gần đầy do domain suy ra.
- Điểm đóng/không thể tiếp cận không nhận thêm dân.
- `EvacuationOperation`/`EvacuationRoute` đã bị xóa cùng phân hệ Sơ tán; trường `activeOperations` không còn được ghi.
