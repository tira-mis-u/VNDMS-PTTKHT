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
