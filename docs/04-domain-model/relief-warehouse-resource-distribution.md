# Mô hình miền — Hậu cần cứu trợ

## Aggregate và thực thể

- `Warehouse`: hồ sơ, vị trí, năng lực, trạng thái và cán bộ phụ trách.
- `InventoryItem`: một mặt hàng tại đúng một kho; cùng mã hàng có thể tồn tại ở nhiều kho nhưng không trùng bản ghi `warehouseId:itemCode`.
- `ReliefRequest`: nhu cầu tác nghiệp, liên kết canonical tới Incident/Shelter/Evacuation/Team.
- `StockReservation`: lượng hàng giữ tại một kho cho một yêu cầu.
- `DistributionShipment`: chuyến xuất từ một phiếu giữ, có tuyến cấu hình và Team tùy chọn.
- `DistributionReceipt`: biên nhận bất biến gắn với chuyến đã đến/giao.
- `ReliefEvent`: timeline cho yêu cầu, kho hoặc chuyến.

## Bất biến

`khả dụng = max(0, tồn thực tế - đã giữ)`.

Giữ hàng chỉ tăng `quantityReserved`. Xuất kho giảm đồng thời `quantityOnHand` và `quantityReserved`. Điều chỉnh tồn không được thấp hơn lượng giữ. Phân bổ đa kho cộng các reservation canonical, không sao chép inventory.

## Vòng đời

Yêu cầu đi từ Nháp → Đã gửi → Đang thẩm định → Đã duyệt → Đã giữ hàng → Đã xuất kho → Đang vận chuyển → Đã giao → Đã xác nhận → Đã đóng, cùng nhánh Từ chối/Hủy.

Chuyến đi từ Chuẩn bị → Đã xuất kho → Đang vận chuyển → Đã đến → Đã giao → Hoàn tất; `Có sự cố` chỉ quay lại vận chuyển hoặc đến nơi.
