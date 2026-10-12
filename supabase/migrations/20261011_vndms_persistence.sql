-- ==============================================================================
-- VNDMS (Vietnam Disaster Management System) — MIGRATION 20261011
-- HỆ THỐNG LƯU TRỮ VĨNH VIỄN SUPABASE (SUPABASE PERSISTENCE)
-- ==============================================================================
-- Hướng dẫn: Dán toàn bộ script này vào Supabase SQL Editor và nhấn 'Run'.
-- Script được viết chuẩn IDEMPOTENT (chạy nhiều lần an toàn, không mất dữ liệu).
-- ==============================================================================

-- 1. BẬT EXTENSION POSTGIS
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- 2. CẬP NHẬT BẢNG PROFILES (MÔ HÌNH 4 VAI TRÒ V2 & AUTH MAPPING)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN (
    -- 4 Vai trò V2 chuẩn
    'admin', 'disaster_officer', 'rescue_unit', 'citizen',
    -- Các vai trò cũ (tương thích ngược)
    'commander', 'operator', 'local_officer', 'rescue_team_leader', 'rescue_team_member', 'logistics_coordinator'
  )
);

-- Bổ sung các cột nếu thiếu
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scope_level TEXT DEFAULT 'national';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scope_name TEXT DEFAULT 'Toàn quốc';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scope_code TEXT DEFAULT 'VN';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

-- Cập nhật trigger handle_new_user() hỗ trợ V2 roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'citizen');
  -- Map legacy vai nếu cần
  IF v_role = 'commander' THEN v_role := 'admin';
  ELSIF v_role = 'operator' THEN v_role := 'disaster_officer';
  ELSIF v_role IN ('rescue_team_leader', 'rescue_leader') THEN v_role := 'rescue_unit';
  END IF;

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
    role = EXCLUDED.role,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. CẬP NHẬT CỘT CHO BẢNG INCIDENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS affected_buildings INTEGER DEFAULT 0;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS affected_roads INTEGER DEFAULT 0;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS flood_depth TEXT DEFAULT '0m';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS area_hectares DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS assigned_team_id TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS lead TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Trung tâm chỉ huy';

-- ------------------------------------------------------------------------------
-- 4. BẢNG TEAMS (Lực lượng cứu hộ, phản ứng nhanh)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Sẵn sàng',
  leader TEXT,
  members INTEGER DEFAULT 1,
  personnel JSONB DEFAULT '[]'::jsonb,
  capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
  capability TEXT,
  vehicles JSONB DEFAULT '[]'::jsonb,
  current_task TEXT,
  current_incident TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geom GEOMETRY(Point, 4326),
  last_location_update TEXT,
  last_operational_update TEXT,
  communication_status TEXT DEFAULT 'Kết nối',
  availability TEXT DEFAULT 'Có thể điều phối',
  region TEXT DEFAULT 'Toàn quốc',
  operating_scope TEXT DEFAULT 'Toàn quốc',
  contact TEXT,
  notes TEXT,
  distance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_current_incident ON public.teams(current_incident);

-- ------------------------------------------------------------------------------
-- 5. BẢNG TASKS (Nhiệm vụ tác nghiệp PCTT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Trung bình',
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  team_leader TEXT,
  assignee TEXT,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geom GEOMETRY(Point, 4326),
  due_at TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Chờ giao',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  assignment_history JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tasks_incident_id ON public.tasks(incident_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ------------------------------------------------------------------------------
-- 6. BẢNG TASK_REVIEWS (Báo cáo kết quả nhiệm vụ từ Đội cứu hộ & Phê duyệt của Cán bộ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  reported_by TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_note TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'Chờ xác nhận',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON public.task_reviews(task_id);

-- ------------------------------------------------------------------------------
-- 7. BẢNG TASK_UPDATES (Nhật ký tiến độ nhiệm vụ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_updates (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  location TEXT,
  source TEXT DEFAULT 'Ứng dụng hiện trường',
  network_status TEXT DEFAULT 'Đã đồng bộ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON public.task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_incident_id ON public.task_updates(incident_id);
-- ------------------------------------------------------------------------------
-- 8. CẬP NHẬT CỘT CHO BẢNG SHELTERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS reserved_capacity INTEGER DEFAULT 0;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS readiness TEXT DEFAULT 'Sẵn sàng';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS accessibility TEXT DEFAULT 'Tiếp cận bình thường';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS responsible_officer JSONB;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS facilities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS medical_capability TEXT DEFAULT 'Sơ cứu cơ bản';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS water_availability TEXT DEFAULT 'Đầy đủ';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS food_availability TEXT DEFAULT 'Đầy đủ';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS power_availability TEXT DEFAULT 'Đầy đủ';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS sanitation_status TEXT DEFAULT 'Đầy đủ';
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS accessible_for_vulnerable_people BOOLEAN DEFAULT true;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS opening_time TEXT;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS closing_time TEXT;
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS linked_incident_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS active_evacuation_operation_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.shelters ADD COLUMN IF NOT EXISTS notes TEXT;

-- ------------------------------------------------------------------------------
-- 9. CẬP NHẬT CỘT CHO BẢNG SOS_REQUESTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS gps_captured BOOLEAN DEFAULT false;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'P1 — Khẩn cấp';
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS reporter JSONB;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS affected_people JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS people_at_risk INTEGER DEFAULT 1;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS injured_count INTEGER DEFAULT 0;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS missing_count INTEGER DEFAULT 0;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS elderly_count INTEGER DEFAULT 0;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS disabled_count INTEGER DEFAULT 0;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Chưa xác minh';
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.sos_requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 10. BẢNG CITIZEN_REPORTS (Phản ánh hiện trường từ người dân)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.citizen_reports (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  administrative_area TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_geom GEOMETRY(Point, 4326),
  status TEXT NOT NULL DEFAULT 'Mới',
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  duplicate_of_id TEXT REFERENCES public.citizen_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citizen_reports_owner ON public.citizen_reports(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_citizen_reports_status ON public.citizen_reports(status);

-- ------------------------------------------------------------------------------
-- 11. BẢNG PUBLISHED_ALERTS (Bản tin cảnh báo công bố tới người dân)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.published_alerts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Cảnh báo',
  area_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Đã công bố',
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_alerts_status ON public.published_alerts(status);

-- ------------------------------------------------------------------------------
-- 12. HÀM HỖ TRỢ XÁC THỰC VAI TRÒ (SECURITY DEFINER FUNCTIONS)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 13. PHÂN QUYỀN TRUY CẬP TỐI THIỂU (LEAST PRIVILEGE GRANTS)
-- ------------------------------------------------------------------------------
-- Thu hồi toàn bộ quyền mặc định của anon trên các bảng tác nghiệp nhạy cảm
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- anon (công chúng/người chưa login): CHỈ tra cứu điểm sơ tán, đọc bản tin đã công bố, và gửi SOS
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.shelters TO anon;
GRANT SELECT ON public.published_alerts TO anon;
GRANT INSERT ON public.sos_requests TO anon;

-- authenticated (người dùng đã đăng nhập): truy cập theo chính sách RLS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- service_role: toàn quyền cho tác vụ hệ thống
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------------------
-- 14. CHÍNH SÁCH ROW LEVEL SECURITY (RLS) CHUẨN BẢO MẬT V2
-- ------------------------------------------------------------------------------
-- Kích hoạt RLS cho toàn bộ các bảng nghiệp vụ
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_requests ENABLE ROW LEVEL SECURITY;

-- 14.1 PROFILES
DROP POLICY IF EXISTS "Đọc thông tin hồ sơ" ON public.profiles;
DROP POLICY IF EXISTS "Cập nhật hồ sơ cá nhân" ON public.profiles;
CREATE POLICY "Đọc thông tin hồ sơ" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cập nhật hồ sơ cá nhân" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (id = auth.uid() OR public.current_user_role() = 'admin');

-- 14.2 SHELTERS (Điểm sơ tán: công khai đọc cứu nạn, chỉ cán bộ được sửa)
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

-- 14.3 PUBLISHED ALERTS (Người dân chỉ xem bản tin đã công bố; cán bộ xem/soạn tất cả)
DROP POLICY IF EXISTS "Đọc bản tin cảnh báo" ON public.published_alerts;
DROP POLICY IF EXISTS "Ghi bản tin cảnh báo" ON public.published_alerts;
DROP POLICY IF EXISTS "Xem bản tin đã công bố" ON public.published_alerts;
DROP POLICY IF EXISTS "Cán bộ quản lý cảnh báo" ON public.published_alerts;
CREATE POLICY "Xem bản tin đã công bố" ON public.published_alerts
  FOR SELECT USING (status = 'Đã công bố' OR public.is_operational_staff());
CREATE POLICY "Cán bộ quản lý cảnh báo" ON public.published_alerts
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'disaster_officer'))
  WITH CHECK (public.current_user_role() IN ('admin', 'disaster_officer'));

-- 14.4 SOS REQUESTS (Mọi người được gửi; chỉ cán bộ hoặc người gửi xem/sửa)
DROP POLICY IF EXISTS "Người dùng xem được các yêu cầu SOS" ON public.sos_requests;
DROP POLICY IF EXISTS "Ai cũng có thể gửi yêu cầu SOS" ON public.sos_requests;
DROP POLICY IF EXISTS "Đọc yêu cầu SOS" ON public.sos_requests;
DROP POLICY IF EXISTS "Ghi yêu cầu SOS" ON public.sos_requests;
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

-- 14.5 CITIZEN REPORTS (Người dân gửi và xem báo cáo của mình; cán bộ xem xét toàn bộ)
DROP POLICY IF EXISTS "Đọc phản ánh" ON public.citizen_reports;
DROP POLICY IF EXISTS "Ghi phản ánh" ON public.citizen_reports;
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

-- 14.6 INCIDENTS (Dữ liệu tác nghiệp sự cố: CHỈ CÁN BỘ PCTT VÀ QUẢN TRỊ)
DROP POLICY IF EXISTS "Công khai xem danh sách sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép cập nhật sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép đọc sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép ghi sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cán bộ tác nghiệp xem sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cán bộ chỉ huy quản lý sự cố" ON public.incidents;
CREATE POLICY "Cán bộ tác nghiệp xem sự cố" ON public.incidents
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());
CREATE POLICY "Cán bộ chỉ huy quản lý sự cố" ON public.incidents
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'disaster_officer'))
  WITH CHECK (public.current_user_role() IN ('admin', 'disaster_officer'));

-- 14.7 TEAMS (Đội cứu hộ: chỉ lực lượng cứu hộ và cán bộ điều phối)
DROP POLICY IF EXISTS "Đọc danh sách đội" ON public.teams;
DROP POLICY IF EXISTS "Ghi dữ liệu đội" ON public.teams;
DROP POLICY IF EXISTS "Xem danh sách đội cứu hộ" ON public.teams;
DROP POLICY IF EXISTS "Cập nhật thông tin đội cứu hộ" ON public.teams;
CREATE POLICY "Xem danh sách đội cứu hộ" ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());
CREATE POLICY "Cập nhật thông tin đội cứu hộ" ON public.teams
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

-- 14.8 TASKS, TASK_UPDATES, TASK_REVIEWS (Nhiệm vụ và tiến độ tác nghiệp)
DROP POLICY IF EXISTS "Đọc danh sách nhiệm vụ" ON public.tasks;
DROP POLICY IF EXISTS "Ghi dữ liệu nhiệm vụ" ON public.tasks;
DROP POLICY IF EXISTS "Xem danh sách nhiệm vụ" ON public.tasks;
DROP POLICY IF EXISTS "Quản lý và thực hiện nhiệm vụ" ON public.tasks;
CREATE POLICY "Xem danh sách nhiệm vụ" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());
CREATE POLICY "Quản lý và thực hiện nhiệm vụ" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

DROP POLICY IF EXISTS "Đọc báo cáo kết quả" ON public.task_reviews;
DROP POLICY IF EXISTS "Ghi báo cáo kết quả" ON public.task_reviews;
CREATE POLICY "Đọc báo cáo kết quả" ON public.task_reviews
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());
CREATE POLICY "Ghi báo cáo kết quả" ON public.task_reviews
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

DROP POLICY IF EXISTS "Đọc cập nhật tiến độ" ON public.task_updates;
DROP POLICY IF EXISTS "Ghi cập nhật tiến độ" ON public.task_updates;
CREATE POLICY "Đọc cập nhật tiến độ" ON public.task_updates
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());
CREATE POLICY "Ghi cập nhật tiến độ" ON public.task_updates
  FOR ALL TO authenticated
  USING (public.is_operational_staff())
  WITH CHECK (public.is_operational_staff());

-- ------------------------------------------------------------------------------
-- 15. ĐỒNG BỘ 7 TÀI KHOẢN VẬN HÀNH V2 VÀO AUTH.USERS & PROFILES (Mật khẩu: VNDMS@2026)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_pass_hash TEXT := crypt('VNDMS@2026', gen_salt('bf'));
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
      v_pass_hash,
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', rec.display_name, 'username', rec.username, 'role', rec.role),
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '', '', '', '', '', '', '', '', '',
      false, false, false
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      email_change_token_current = COALESCE(auth.users.email_change_token_current, ''),
      reauthentication_token = COALESCE(auth.users.reauthentication_token, ''),
      updated_at = NOW();

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
      last_sign_in_at = NOW(),
      updated_at = NOW();

    INSERT INTO public.profiles (
      id, email, full_name, display_name, username, role, scope_level, scope_name, scope_code, active, created_at, updated_at
    )
    VALUES (
      rec.id, rec.email, rec.display_name, rec.display_name, rec.username, rec.role, rec.scope_level, rec.scope_name, rec.scope_code, true, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      username = EXCLUDED.username,
      scope_level = EXCLUDED.scope_level,
      scope_name = EXCLUDED.scope_name,
      scope_code = EXCLUDED.scope_code,
      active = true,
      updated_at = NOW();
  END LOOP;

  -- Khắc phục triệt để lỗi GoTrue 'Database error querying schema' do các cột token bị NULL
  UPDATE auth.users
  SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone = COALESCE(phone, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, '')
  WHERE confirmation_token IS NULL 
     OR recovery_token IS NULL 
     OR email_change_token_new IS NULL 
     OR email_change IS NULL;
END $$;

-- ==============================================================================
-- HOÀN TẤT MIGRATION 20261011 (CHÍNH SÁCH BẢO MẬT TỐI THIỂU LEAST PRIVILEGE)
-- ==============================================================================

