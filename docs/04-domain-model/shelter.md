# Domain model — Shelter & Evacuation

## Shelter

`Shelter` gồm identity/address/coordinates, capacity/current occupancy/reserved capacity, status/readiness/accessibility, officer/contact, facilities, y tế, nước/lương thực/điện/vệ sinh, hỗ trợ người yếu thế, giờ mở/đóng, Incident links, active operations, notes và audit timestamp.

Derived values:

- `availableCapacity = max(0, capacity - currentOccupancy - reservedCapacity)`
- `occupancyPercentage = round(currentOccupancy / capacity × 100)`
- Quá tải khi occupancy >= capacity.
- Gần đầy khi tổng occupancy + reserved đạt ít nhất 85% nhưng occupancy chưa quá tải.

Status: Sẵn sàng, Đang tiếp nhận, Gần đầy, Quá tải, Tạm đóng, Không thể tiếp cận. Readiness và accessibility là khái niệm riêng; domain không cho điểm đóng/không thể tiếp cận nhận thêm dân.

## EvacuationOperation

Liên kết Incident, source area/population, destination Shelter, Rescue Team và EvacuationRoute. Có estimated/evacuated population, progress, priority, timestamps và event stream.

Lifecycle: Dự kiến → Đã phê duyệt → Đang triển khai ↔ Tạm dừng → Hoàn thành; cancellation hợp lệ trước khi kết thúc.

Route status: Thông suốt, Hạn chế, Bị chặn, Đang dùng tuyến thay thế. Route bị chặn trong lúc triển khai buộc operation tạm dừng.

## Invariants

- Không reserve quá available capacity.
- Không triển khai nếu chưa gán Team hoặc route bị chặn.
- Không chuyển hướng tới điểm không tiếp cận/đóng/không đủ chỗ.
- Một Team không nhận đồng thời Task khác hoặc Evacuation khác.
- Completion/cancellation phải giải phóng Team và cập nhật Shelter reservation.
