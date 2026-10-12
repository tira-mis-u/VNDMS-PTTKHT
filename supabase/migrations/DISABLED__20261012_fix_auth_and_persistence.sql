-- ==============================================================================
-- VNDMS MIGRATION: 20261012_fix_auth_and_persistence.sql
-- Khắc phục triệt để lỗi GoTrue 'Database error querying schema' và RLS Shelters
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. SỬA LỖI GOTRUE: BỔ SUNG AUTH.IDENTITIES & LÀM SẠCH 7 TÀI KHOẢN SEED
-- ------------------------------------------------------------------------------
-- GoTrue (Supabase Auth) bắt buộc mỗi tài khoản trong auth.users phải có:
--   a) Bản ghi tương ứng trong auth.identities (provider = 'email')
--   b) Các cột token/phone không được mang giá trị NULL (phải là chuỗi rỗng '')
--   c) email_confirmed_at có giá trị hợp lệ để không bị chặn đăng nhập
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT * FROM (VALUES
      ('a0000000-0000-0000-0000-000000000001'::uuid, 'thuantq@vndms.gov.vn', 'thuantq', 'Trần Quốc Thuận', 'admin', 'national', 'Toàn quốc', 'VN'),
      ('a0000000-0000-0000-0000-000000000002'::uuid, 'nguyentrung@vndms.gov.vn', 'nguyentrung', 'Nguyễn Trung Trực', 'disaster_officer', 'national', 'Toàn quốc', 'VN'),
      ('a0000000-0000-0000-0000-000000000003'::uuid, 'phamhieu@vndms.gov.vn', 'phamhieu', 'Phạm Minh Hiếu', 'rescue_unit', 'national', 'Toàn quốc', 'VN'),
      ('a0000000-0000-0000-0000-000000000004'::uuid, 'phamdam@vndms.gov.vn', 'phamdam', 'Phạm Văn Đàm', 'citizen', 'national', 'Toàn quốc', 'VN'),
      ('a0000000-0000-0000-0000-000000000005'::uuid, 'minhtri@vndms.gov.vn', 'minhtri', 'Lê Minh Trí', 'citizen', 'national', 'Toàn quốc', 'VN'),
      ('a0000000-0000-0000-0000-000000000006'::uuid, 'namanh@vndms.gov.vn', 'namanh', 'Đỗ Nam Anh', 'citizen', 'national', 'Toàn quốc', 'VN'),
      ('a0000000-0000-0000-0000-000000000007'::uuid, 'trantuan@vndms.gov.vn', 'trantuan', 'Trần Tuấn Anh', 'citizen', 'national', 'Toàn quốc', 'VN')
    ) AS t(id, email, username, display_name, role, scope_level, scope_name, scope_code)
  ) LOOP
    -- 1.1 Khởi tạo auth.users nếu chưa tồn tại (KHÔNG ghi đè mật khẩu nếu đã tồn tại)
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token, phone, phone_change, phone_change_token,
      is_super_admin, is_sso_user, is_anonymous
    )
    VALUES (
      rec.id,
      '00000000-0000-0000-0000-000000000000',
      rec.email,
      crypt('VNDMS@2026', gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', rec.display_name, 'display_name', rec.display_name, 'username', rec.username, 'role', rec.role),
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '', '', '', '', '', '', '', '', '',
      false, false, false
    )
    ON CONFLICT (id) DO UPDATE SET
      -- Bảo vệ mật khẩu: KHÔNG đặt lại encrypted_password khi chạy lại migration
      raw_app_meta_data = COALESCE(auth.users.raw_app_meta_data, EXCLUDED.raw_app_meta_data),
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      updated_at = NOW();

    -- 1.2 Bổ sung auth.identities (BẮT BUỘC cho GoTrue)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      rec.id::text,
      rec.id,
      jsonb_build_object('sub', rec.id::text, 'email', rec.email),
      'email',
      rec.id::text,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();

    -- 1.3 Khởi tạo public.profiles nếu chưa có (KHÔNG ghi đè thông tin nếu đã tồn tại)
    INSERT INTO public.profiles (
      id, email, full_name, display_name, username, role, scope_level, scope_name, scope_code, active, created_at, updated_at
    )
    VALUES (
      rec.id, rec.email, rec.display_name, rec.display_name, rec.username, rec.role, rec.scope_level, rec.scope_name, rec.scope_code, true, NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- 1.4 Chỉ chuẩn hóa các trường token NULL cho đúng 7 tài khoản seed có vấn đề
  UPDATE auth.users
  SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, '')
  WHERE id IN (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'a0000000-0000-0000-0000-000000000004'::uuid,
    'a0000000-0000-0000-0000-000000000005'::uuid,
    'a0000000-0000-0000-0000-000000000006'::uuid,
    'a0000000-0000-0000-0000-000000000007'::uuid
  ) AND (
    confirmation_token IS NULL 
    OR recovery_token IS NULL 
    OR email_change_token_new IS NULL 
    OR email_change IS NULL
  );

  -- 1.5 Xác nhận email chỉ dành riêng cho 7 tài khoản seed kiểm thử đã biết nếu chưa xác nhận
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id IN (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'a0000000-0000-0000-0000-000000000004'::uuid,
    'a0000000-0000-0000-0000-000000000005'::uuid,
    'a0000000-0000-0000-0000-000000000006'::uuid,
    'a0000000-0000-0000-0000-000000000007'::uuid
  ) AND email_confirmed_at IS NULL;
END $$;

-- ------------------------------------------------------------------------------
-- TÙY CHỌN RIÊNG (CHỈ DÙNG CHO MÔI TRƯỜNG TEST): RESET MẬT KHẨU 7 TÀI KHOẢN DEMO
-- ------------------------------------------------------------------------------
-- Mặc định migration KHÔNG ghi đè mật khẩu hiện có khi chạy lại.
-- Nếu trong môi trường kiểm thử cần đặt lại mật khẩu của 7 tài khoản demo về 'VNDMS@2026',
-- người quản trị có thể chủ động chạy riêng khối lệnh sau:
/*
UPDATE auth.users
SET encrypted_password = crypt('VNDMS@2026', gen_salt('bf'))
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'a0000000-0000-0000-0000-000000000004'::uuid,
  'a0000000-0000-0000-0000-000000000005'::uuid,
  'a0000000-0000-0000-0000-000000000006'::uuid,
  'a0000000-0000-0000-0000-000000000007'::uuid
);
*/

-- ------------------------------------------------------------------------------
-- 2. LOẠI BỎ TRIGGER AUTO CONFIRM EMAIL TỰ ĐỘNG
-- ------------------------------------------------------------------------------
-- Bảo mật tuyệt đối: KHÔNG tự động xác nhận email cho bất kỳ tài khoản mới nào đăng ký,
-- kể cả tài khoản có đuôi @vndms.gov.vn.
-- Mọi tài khoản mới đăng ký phải qua luồng xác minh email chính thống của Supabase Auth.
DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_new_user();

-- ------------------------------------------------------------------------------
-- 3. ĐỒNG BỘ TRIGGER TẠO PROFILE KHI SIGN UP (BẢO VỆ PHÂN QUYỀN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- BẢO MẬT: Mọi tài khoản tự đăng ký qua Supabase Auth BẮT BUỘC nhận role là 'citizen'.
  -- Không nhận role đặc quyền (admin, disaster_officer, rescue_unit) từ raw_user_meta_data
  -- do client gửi lên để ngăn chặn hành vi leo thang đặc quyền trái phép.
  v_role := 'citizen';

  INSERT INTO public.profiles (
    id, email, full_name, display_name, username, role, scope_name, scope_level, scope_code, phone, organization, active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email, 'Người dùng'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email, 'Người dùng'),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'scope_name', 'Toàn quốc'),
    COALESCE(NEW.raw_user_meta_data->>'scope_level', 'national'),
    COALESCE(NEW.raw_user_meta_data->>'scope_code', 'VN'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'organization',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    display_name = EXCLUDED.display_name,
    -- Giữ nguyên role của profile nếu đã tồn tại (không ghi đè role quản trị viên đã cấp)
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 4. ĐẢM BẢO QUYỀN TRUY CẬP TỐI THIỂU (LEAST PRIVILEGE) CHO TOÀN BỘ CÁC BẢNG
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- anon (công chúng chưa đăng nhập): chỉ tra cứu điểm sơ tán, xem bản tin công bố, gửi yêu cầu cứu nạn SOS
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.shelters TO anon;
GRANT SELECT ON public.published_alerts TO anon;
GRANT INSERT ON public.sos_requests TO anon;

-- authenticated (người dùng đã đăng nhập hệ thống): có quyền thao tác dữ liệu theo các chính sách RLS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- service_role: toàn quyền bảo trì hệ thống
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 5. CỦNG CỐ CHÍNH SÁCH ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
-- 5.1 Hàm hỗ trợ xác thực vai trò
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_operational_staff()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('admin', 'disaster_officer', 'rescue_unit', 'commander', 'operator', 'rescue_team_leader')
     FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5.2 RLS Bảng Shelters (Điểm sơ tán)
ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Công khai xem điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cho phép đọc điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cho phép ghi điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cán bộ quản lý điểm sơ tán" ON public.shelters;

CREATE POLICY "Công khai xem điểm sơ tán" ON public.shelters
  FOR SELECT USING (true);

CREATE POLICY "Cán bộ quản lý điểm sơ tán" ON public.shelters
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'disaster_officer'))
  WITH CHECK (public.current_user_role() IN ('admin', 'disaster_officer'));

-- 5.3 RLS Bảng Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Đọc thông tin hồ sơ" ON public.profiles;
DROP POLICY IF EXISTS "Cập nhật hồ sơ cá nhân" ON public.profiles;

CREATE POLICY "Đọc thông tin hồ sơ" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cập nhật hồ sơ cá nhân" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (id = auth.uid() OR public.current_user_role() = 'admin');

-- 5.4 RLS Bảng Incidents
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cán bộ tác nghiệp xem sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cán bộ chỉ huy quản lý sự cố" ON public.incidents;

CREATE POLICY "Cán bộ tác nghiệp xem sự cố" ON public.incidents
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());

CREATE POLICY "Cán bộ chỉ huy quản lý sự cố" ON public.incidents
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'disaster_officer'))
  WITH CHECK (public.current_user_role() IN ('admin', 'disaster_officer'));

-- 5.5 RLS Bảng Teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem danh sách đội cứu hộ" ON public.teams;
DROP POLICY IF EXISTS "Cập nhật thông tin đội cứu hộ" ON public.teams;

CREATE POLICY "Xem danh sách đội cứu hộ" ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());

CREATE POLICY "Cập nhật thông tin đội cứu hộ" ON public.teams
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

-- 5.6 RLS Bảng Tasks, Task Updates, Task Reviews
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem danh sách nhiệm vụ" ON public.tasks;
DROP POLICY IF EXISTS "Quản lý và thực hiện nhiệm vụ" ON public.tasks;

CREATE POLICY "Xem danh sách nhiệm vụ" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());

CREATE POLICY "Quản lý và thực hiện nhiệm vụ" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Đọc cập nhật tiến độ" ON public.task_updates;
DROP POLICY IF EXISTS "Ghi cập nhật tiến độ" ON public.task_updates;

CREATE POLICY "Đọc cập nhật tiến độ" ON public.task_updates
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());

CREATE POLICY "Ghi cập nhật tiến độ" ON public.task_updates
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

ALTER TABLE public.task_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Đọc báo cáo kết quả" ON public.task_reviews;
DROP POLICY IF EXISTS "Ghi báo cáo kết quả" ON public.task_reviews;

CREATE POLICY "Đọc báo cáo kết quả" ON public.task_reviews
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());

CREATE POLICY "Ghi báo cáo kết quả" ON public.task_reviews
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

-- 5.7 RLS Bảng SOS Requests
ALTER TABLE public.sos_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gửi yêu cầu SOS khẩn cấp" ON public.sos_requests;
DROP POLICY IF EXISTS "Xem yêu cầu SOS hợp lệ" ON public.sos_requests;
DROP POLICY IF EXISTS "Cập nhật yêu cầu SOS" ON public.sos_requests;

CREATE POLICY "Gửi yêu cầu SOS khẩn cấp" ON public.sos_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Xem yêu cầu SOS hợp lệ" ON public.sos_requests
  FOR SELECT USING (
    public.is_operational_staff() OR
    (auth.uid() IS NOT NULL AND owner_user_id = auth.uid()::text)
  );

CREATE POLICY "Cập nhật yêu cầu SOS" ON public.sos_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_operational_staff() OR
    (auth.uid() IS NOT NULL AND owner_user_id = auth.uid()::text)
  )
  WITH CHECK (
    public.is_operational_staff() OR
    (auth.uid() IS NOT NULL AND owner_user_id = auth.uid()::text)
  );

-- 5.8 RLS Bảng Citizen Reports
ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Công dân gửi phản ánh" ON public.citizen_reports;
DROP POLICY IF EXISTS "Xem phản ánh hợp lệ" ON public.citizen_reports;
DROP POLICY IF EXISTS "Cán bộ duyệt phản ánh" ON public.citizen_reports;

CREATE POLICY "Công dân gửi phản ánh" ON public.citizen_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Xem phản ánh hợp lệ" ON public.citizen_reports
  FOR SELECT TO authenticated
  USING (public.is_operational_staff() OR owner_user_id = auth.uid()::text);

CREATE POLICY "Cán bộ duyệt phản ánh" ON public.citizen_reports
  FOR UPDATE TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

-- 5.9 RLS Bảng Published Alerts
ALTER TABLE public.published_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem bản tin đã công bố" ON public.published_alerts;
DROP POLICY IF EXISTS "Cán bộ quản lý cảnh báo" ON public.published_alerts;

CREATE POLICY "Xem bản tin đã công bố" ON public.published_alerts
  FOR SELECT USING (status = 'Đã công bố' OR public.is_operational_staff());

CREATE POLICY "Cán bộ quản lý cảnh báo" ON public.published_alerts
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'disaster_officer'))
  WITH CHECK (public.current_user_role() IN ('admin', 'disaster_officer'));

-- ==============================================================================
-- HOÀN TẤT MIGRATION 20261012 (SỬA LỖI GOTRUE AUTH VÀ RLS TOÀN DIỆN)
-- ==============================================================================
