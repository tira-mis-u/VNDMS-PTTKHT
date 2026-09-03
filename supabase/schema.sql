-- ==============================================================================
-- VNDMS (Vietnam Disaster Management System) — SUPABASE INITIAL DATABASE SCHEMA
-- ==============================================================================
-- Hướng dẫn: Copy và dán toàn bộ script này vào Supabase SQL Editor và nhấn Run.
-- ==============================================================================

-- 1. BẬT EXTENSION POSTGIS (Hỗ trợ dữ liệu không gian địa lý, vùng ngập lụt, tọa độ)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ------------------------------------------------------------------------------
-- 2. BẢNG PROFILES (Hồ sơ người dùng & Phân quyền)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('commander', 'operator', 'local_officer', 'rescue_team_leader', 'rescue_team_member', 'logistics_coordinator', 'citizen')),
  scopes TEXT[] NOT NULL DEFAULT ARRAY['Toàn quốc']::TEXT[],
  organization TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy RLS cho profiles:
-- 1. Mọi người đã đăng nhập có thể xem hồ sơ người dùng trong hệ thống tác nghiệp
CREATE POLICY "Cho phép người dùng đã xác thực xem danh sách profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Người dùng có thể sửa thông tin cá nhân của chính mình (Tên, SĐT, Cơ quan)
CREATE POLICY "Người dùng tự cập nhật thông tin cá nhân của mình"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Chỉ huy (commander) toàn quyền cập nhật vai trò và phạm vi địa lý của bất kỳ ai
CREATE POLICY "Chỉ huy có quyền phân quyền cho mọi người dùng"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'commander'
    )
  );

-- ------------------------------------------------------------------------------
-- 3. TRIGGER TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ AUTH.USERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, scopes, phone, organization)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'),
    ARRAY[COALESCE(NEW.raw_user_meta_data->>'scope', 'Toàn quốc')]::TEXT[],
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'organization'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn trigger vào bảng auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 4. BẢNG SOS_REQUESTS (Yêu cầu cứu nạn khẩn cấp)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sos_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Khẩn cấp',
  status TEXT NOT NULL DEFAULT 'Chờ tiếp nhận',
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geom GEOMETRY(Point, 4326),
  people_count INTEGER DEFAULT 1,
  has_elderly_or_children BOOLEAN DEFAULT false,
  water_level TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_team_id TEXT,
  linked_incident_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sos_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ai cũng có thể gửi yêu cầu SOS"
  ON public.sos_requests FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Người dùng xem được các yêu cầu SOS"
  ON public.sos_requests FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------------------------
-- 5. BẢNG LOCATION_HISTORY (Lưu vết di chuyển/lộ trình từ Redis vào Supabase)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.location_history (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'team' hoặc 'citizen'
  entity_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geom GEOMETRY(Point, 4326),
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_entity ON public.location_history(entity_type, entity_id, recorded_at DESC);

-- ------------------------------------------------------------------------------
-- 6. BẢNG INCIDENTS (Sự cố thiên tai & Hồ sơ lịch sử)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Cao',
  status TEXT NOT NULL DEFAULT 'Đang xử lý',
  location_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  affected_population INTEGER DEFAULT 0,
  affected_households INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Công khai xem danh sách sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép cập nhật sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép đọc sự cố" ON public.incidents;
DROP POLICY IF EXISTS "Cho phép ghi sự cố" ON public.incidents;
CREATE POLICY "Cho phép đọc sự cố" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Cho phép ghi sự cố" ON public.incidents FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 7. BẢNG SHELTERS (Điểm sơ tán dân cư)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shelters (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  capacity INTEGER NOT NULL,
  current_occupancy INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Đang tiếp nhận',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Công khai xem điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cho phép đọc điểm sơ tán" ON public.shelters;
DROP POLICY IF EXISTS "Cho phép ghi điểm sơ tán" ON public.shelters;
CREATE POLICY "Cho phép đọc điểm sơ tán" ON public.shelters FOR SELECT USING (true);
CREATE POLICY "Cho phép ghi điểm sơ tán" ON public.shelters FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- CẤP QUYỀN TRUY CẬP (GRANT PERMISSIONS CHO ANON VÀ AUTHENTICATED)
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sos_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.location_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.incidents TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shelters TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. NẠP DỮ LIỆU MẪU BAN ĐẦU (BÃO YAGI 2024 & THIÊN TAI LỊCH SỬ)
-- ------------------------------------------------------------------------------
INSERT INTO public.incidents (id, code, title, type, severity, status, location_name, latitude, longitude, affected_population, affected_households, description)
VALUES
  ('INC-YAGI-01', 'INC-YAGI-01', 'Lũ quét — Làng Nủ, Bảo Yên', 'Lũ quét, sạt lở đất', 'Khẩn cấp', 'Đang xử lý', 'Làng Nủ, Phúc Khánh, Bảo Yên, Lào Cai', 22.073, 104.423, 350, 86, 'Lũ quét bùn đá cuốn trôi khu dân cư Làng Nủ. 67 người chết và mất tích. Quân đội và cứu hộ đang tiếp cận.'),
  ('INC-YAGI-02', 'INC-YAGI-02', 'Sạt lở đất — Ca Thành, Nguyên Bình', 'Sạt lở đất', 'Khẩn cấp', 'Đang xử lý', 'Xã Ca Thành, Nguyên Bình, Cao Bằng', 22.62, 105.89, 120, 31, 'Sạt lở đất vùi lấp xóm bản tại Ca Thành. 31 người chết/mất tích. Nhiều điểm sạt chặn đường tiếp cận.'),
  ('INC-YAGI-03', 'INC-YAGI-03', 'Ngập lụt nghiêm trọng — Hà Nội', 'Lũ, ngập lụt', 'Khẩn cấp', 'Đang xử lý', 'Các quận ven Sông Hồng, Hà Nội', 21.032, 105.836, 45000, 12000, 'Lũ Sông Hồng vượt Báo động III. Hơn 800 sự cố đê điều được ghi nhận. Sơ tán hàng chục nghìn hộ dân.'),
  ('INC-YAGI-04', 'INC-YAGI-04', 'Lũ sông — Yên Bái', 'Lũ, ngập lụt', 'Cao', 'Đang điều phối', 'Thành phố Yên Bái, Yên Bái', 21.715, 104.872, 18000, 4200, 'Lũ Sông Thao dâng cao bất thường gây ngập diện rộng toàn TP Yên Bái.')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  severity = EXCLUDED.severity,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO public.shelters (id, code, name, type, address, latitude, longitude, capacity, current_occupancy, status)
VALUES
  ('SHELTER-HN-01', 'SHELTER-HN-01', 'Trường THPT Nguyễn Gia Thiều', 'Trường học', '4 Cự Khối, Long Biên, Hà Nội', 21.044, 105.897, 1200, 1045, 'Gần đầy'),
  ('SHELTER-HN-02', 'SHELTER-HN-02', 'Nhà văn hóa phường Phúc Đồng', 'Nhà văn hóa', '45 Đà Nẵng, Phúc Đồng, Long Biên, Hà Nội', 21.038, 105.898, 600, 488, 'Đang tiếp nhận'),
  ('SHELTER-HN-03', 'SHELTER-HN-03', 'Trung tâm Thể thao Gia Lâm', 'Nhà thi đấu', 'Trâu Quỳ, Gia Lâm, Hà Nội', 21.018, 105.924, 2000, 1680, 'Quá tải'),
  ('SHELTER-LC-01', 'SHELTER-LC-01', 'Trường THCS Phúc Khánh', 'Trường học', 'Xã Phúc Khánh, Bảo Yên, Lào Cai', 22.065, 104.43, 300, 215, 'Đang tiếp nhận'),
  ('SHELTER-YB-01', 'SHELTER-YB-01', 'Trung tâm Văn hóa Yên Bái', 'Cơ sở văn hóa', '06 Hùng Vương, TP. Yên Bái', 21.715, 104.872, 800, 620, 'Đang tiếp nhận')
ON CONFLICT (id) DO UPDATE SET
  current_occupancy = EXCLUDED.current_occupancy,
  status = EXCLUDED.status,
  updated_at = NOW();


