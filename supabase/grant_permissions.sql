-- ==============================================================================
-- CẤP QUYỀN TRUY CẬP TỐI THIỂU (LEAST PRIVILEGE GRANTS) CHO SUPABASE
-- ==============================================================================
-- Dán đoạn này vào Supabase SQL Editor và nhấn Run nếu cần cập nhật lại quyền truy cập

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- anon (công chúng chưa đăng nhập): chỉ tra cứu điểm sơ tán, xem cảnh báo công bố, gửi SOS khẩn cấp
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.shelters TO anon;
GRANT SELECT ON public.published_alerts TO anon;
GRANT INSERT ON public.sos_requests TO anon;

-- authenticated (người dùng đã đăng nhập): truy cập theo chính sách RLS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- service_role: toàn quyền bảo trì hệ thống
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
