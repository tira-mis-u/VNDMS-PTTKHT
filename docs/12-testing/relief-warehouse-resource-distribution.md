# Kiểm thử — Hậu cần cứu trợ

## Phạm vi

- Domain: khả dụng, cảnh báo tồn, fulfillment thiếu/không có/đủ và lifecycle.
- Application: giữ, giải phóng, xuất, receipt, điều chỉnh tồn, queue ordering.
- RBAC/phạm vi: quyền cứu trợ/kho và chặn địa bàn ngoài Hà Nội.
- Cross-module: khóa Incident/Shelter canonical, inventory duy nhất theo kho, Team assignment/release.
- Regression: toàn bộ test Team, Shelter/Evacuation và SOS.

## Lệnh và kết quả 21/08/2026

- `npx --yes tsx --test tests/**/*.test.ts`: **48 pass, 0 fail**.
- `npm run lint`: **0 warning, 0 error**.
- `npm run build`: **PASS**.

## Kiểm tra thủ công cần duy trì

- Route trực tiếp và back/forward cho năm route Relief.
- Responsive queue/detail trên desktop và mobile.
- MapLibre label Việt Nam, Quần Đảo Hoàng Sa, Quần Đảo Trường Sa.
- Thao tác RBAC theo vai trò và cảnh báo đóng kho.
