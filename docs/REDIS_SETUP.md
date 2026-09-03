# Hướng Dẫn Cấu Hình Redis Cho Hệ Thống VNDMS

Hệ thống VNDMS sử dụng Redis cho 2 mục đích chính:
1. **Lưu trữ & Truyền phát tọa độ GPS Realtime** của các lực lượng tác chiến (Chỉ huy, Đội trưởng, Thành viên) và Công dân.
2. **Kênh Cảnh Báo 1 Chạm (SOS Panic)**: Gửi cảnh báo khẩn cấp tức thời với độ trễ dưới 100ms.

---

## Cách Lấy API Key & Điền Vào `.env`

Hệ thống hỗ trợ cả 2 phương thức kết nối:

### Cách 1: Sử dụng Upstash Redis Serverless (Khuyên Dùng — Nhanh & Miễn Phí)
Upstash Redis hoạt động trực tiếp qua REST API (HTTPS), không lo bị chặn cổng firewall:
1. Đăng ký/đăng nhập miễn phí tại: [console.upstash.com](https://console.upstash.com/)
2. Bấm **Create Database**:
   - Name: `vndms-live-fleet`
   - Region: Chọn vùng gần nhất (ví dụ: `ap-southeast-1` Singapore)
   - Bấm **Create**
3. Trong trang Dashboard của Database vừa tạo:
   - Cuộn xuống phần **REST API**
   - Chọn tab **`.env`**
   - Bạn sẽ thấy 2 dòng:
     ```bash
     UPSTASH_REDIS_REST_URL="https://..."
     UPSTASH_REDIS_REST_TOKEN="..."
     ```
4. Sao chép và dán vào file `.env` trong thư mục gốc của dự án:
   ```bash
   VITE_UPSTASH_REDIS_REST_URL=https://your-database-name.upstash.io
   VITE_UPSTASH_REDIS_REST_TOKEN=AX...
   ```

---

### Cách 2: Sử dụng Redis Server hoặc Redis Cloud
Nếu bạn dùng Docker local hoặc Redis Cloud:
1. Mở file `.env`
2. Điền biến:
   ```bash
   REDIS_URL=redis://default:mat_khau_cua_ban@host:port
   ```

---

## Cơ Chế Tự Động Fallback Của Hệ Thống
- Khi **chưa điền API Key Redis**: Hệ thống tự động kích hoạt bộ đệm bộ nhớ và kênh broadcast cục bộ (`BroadcastChannel` & `localStorage`). Toàn bộ tính năng **Cảnh báo 1 chạm**, **Phát tín hiệu Realtime** và **Hiển thị trên bản đồ** vẫn hoạt động trơn tru 100% để bạn thử nghiệm.
- Khi **đã điền API Key Redis**: Hệ thống sẽ tự động đồng bộ vị trí lên Cloud Redis Server và Geospatial Index `vndms:geo:live_fleet`.
