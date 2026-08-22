# Ca sử dụng — Trợ lý AI tác nghiệp có căn cứ

## Mục tiêu

Trợ lý hỗ trợ người dùng đã đăng nhập quan sát, hiểu, đánh giá, so sánh lựa chọn và đề xuất hành động từ trạng thái chuẩn VNDMS. Trợ lý không phải bộ điều khiển tự động.

## Truy vấn tình hình

Người dùng hỏi bằng tiếng Việt về sự cố, nhiệm vụ, đội cứu hộ, sức chứa điểm sơ tán, SOS, sơ tán, cứu trợ/kho, playbook, phục hồi hoặc ngoại lệ. Hệ thống phân loại intent, áp dụng quyền và phạm vi địa lý, truy vấn canonical entities rồi tạo câu trả lời có bằng chứng.

## Phân loại phát biểu

Mọi câu trả lời tác nghiệp dùng SỰ KIỆN (FACT), SUY LUẬN (INFERENCE), KHUYẾN NGHỊ (RECOMMENDATION) hoặc CHƯA XÁC ĐỊNH (UNKNOWN). FACT luôn liên kết ít nhất một evidence. Dữ liệu không tồn tại trả “Chưa có dữ liệu trong hệ thống.”

## Kiểm tra bằng chứng

Người dùng mở panel bằng chứng để xem nguồn, loại entity, ID, field, value, timestamp và trạng thái “Đã ghi nhận” hay “Dẫn xuất”. Panel chỉ trỏ tới entity chuẩn; không tạo citation ngoài.

## Thực thi có xác nhận

Tập hành động đầu tiên gồm gán Task cho Team, điều phối SOS đã xác minh, bắt đầu Task đủ điều kiện, chuyển hướng Evacuation và tạo Task. Nút Thực thi mở xác nhận gồm lý do, dữ liệu nền, nguồn lực ảnh hưởng, trạng thái hiện tại và actor. Application action đọc lại state, quyền, scope và điều kiện trước khi gọi mutation hiện hữu.

## Ngữ cảnh entity

Incident, Task, Team, Shelter và SOS detail mở `/ai-assistant?context=...&id=...`. Trợ lý ưu tiên entity ID nhưng không sao chép entity state.
