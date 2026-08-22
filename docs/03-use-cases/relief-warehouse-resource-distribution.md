# Ca sử dụng — Cứu trợ, kho và phân phối nguồn lực

## Tác nhân

- Chỉ huy/điều hành viên: thẩm định, duyệt, điều phối và đóng yêu cầu.
- Cán bộ địa phương: tạo yêu cầu trong phạm vi địa lý, xác nhận tiếp nhận.
- Phụ trách kho: giữ hàng, xuất kho, điều chỉnh tồn và trạng thái kho.
- Đội cứu hộ đủ điều kiện: có thể được gán vận chuyển và cập nhật mốc chuyến.

## Luồng chính

1. Tạo bản nháp từ nhu cầu của Incident, điểm sơ tán, hoạt động sơ tán, đội cứu hộ hoặc địa phương.
2. Gửi, thẩm định và phê duyệt số lượng từng mặt hàng.
3. Chọn một hoặc nhiều kho; giữ một phần hoặc toàn bộ hàng khả dụng.
4. Công bố rõ `Đủ hàng`, `Thiếu hàng`, `Không có hàng`; phần thiếu không tự hoàn tất.
5. Xuất từng phiếu giữ thành chuyến hàng; tồn thực tế và lượng giữ cùng giảm.
6. Cập nhật mốc vận chuyển, sự cố, đến nơi, giao hàng và biên nhận.
7. Khi mọi chuyến có biên nhận, xác nhận và đóng yêu cầu.

## Ngoại lệ

- Chặn giữ/xuất quá tồn khả dụng.
- Hủy yêu cầu giải phóng phiếu giữ còn hiệu lực.
- Chặn đóng kho khi còn phiếu giữ hoặc chuyến mở.
- Chặn Team đang có Task, sơ tán, chuyến khác hoặc trạng thái không phù hợp.
- Mọi mutation kiểm tra RBAC và phạm vi địa lý tại biên ứng dụng/state.
