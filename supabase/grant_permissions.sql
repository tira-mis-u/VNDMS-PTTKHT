-- ==============================================================================
-- CẤP QUYỀN TRUY CẬP (GRANT PERMISSIONS) CHO POSTGREST ANON / AUTHENTICATED
-- ==============================================================================
-- Dán đoạn này vào Supabase SQL Editor và nhấn Run để sửa lỗi 'permission denied'

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sos_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.location_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.incidents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shelters TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Cập nhật Policy RLS
DROP POLICY IF EXISTS "Công khai xem danh sách sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép cập nhật sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép đọc sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép ghi sự cố" ON public.incidents;
CREATE POLICY "Cho phép đọc sự cố" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Cho phép ghi sự cố" ON public.incidents FOR ALL USING (true);

DROP POLICY IF EXISTS "Công khai xem điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cho phép đọc điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cho phép ghi điểm sơ tán" ON public.shelters;
CREATE POLICY "Cho phép đọc điểm sơ tán" ON public.shelters FOR SELECT USING (true);
CREATE POLICY "Cho phép ghi điểm sơ tán" ON public.shelters FOR ALL USING (true);
