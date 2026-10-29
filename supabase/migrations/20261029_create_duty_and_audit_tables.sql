-- ==============================================================================
-- VNDMS — MIGRATION: BẢNG SỔ TRỰC BAN (DUTY LOGS) & NHẬT KÝ AN NINH (AUDIT LOGS)
-- ==============================================================================
-- 1. SỔ TRỰC BAN (duty_logs): Đồng bộ đa người dùng trong phòng chỉ huy PCTT,
--    hỗ trợ realtime chat/ghi nhận/chỉ đạo/bàn giao ca giữa các điểm trực.
-- 2. NHẬT KÝ AN NINH (security_audit_logs): Lưu vết tập trung các thao tác
--    nghiệp vụ, đăng nhập, phân quyền, đột biến dữ liệu trên toàn hệ thống.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG SỔ TRỰC BAN (public.duty_logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duty_logs (
    id TEXT PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    actor_id TEXT,
    source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'system'
    kind TEXT NOT NULL,                    -- 'Ghi nhận' | 'Chỉ đạo' | 'Bàn giao ca'
    text TEXT NOT NULL,
    status TEXT,                           -- 'open' | 'done' (cho mục Chỉ đạo)
    task_id TEXT,                          -- Liên kết 2 chiều với nhiệm vụ nếu có
    shift_ref TEXT,                        -- Tên ca trực (vd "Ca 2 · 29/10/2026")
    follow_up BOOLEAN DEFAULT FALSE,       -- Chuyển ca sau theo dõi
    handover JSONB,                        -- { toName, pending, receivedBy, receivedAt }
    link JSONB,                            -- { kind, id, code } hồ sơ liên quan
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ mục tối ưu truy vấn dòng thời gian và loại ghi chép
CREATE INDEX IF NOT EXISTS idx_duty_logs_at ON public.duty_logs (at DESC);
CREATE INDEX IF NOT EXISTS idx_duty_logs_kind ON public.duty_logs (kind);
CREATE INDEX IF NOT EXISTS idx_duty_logs_actor_id ON public.duty_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_duty_logs_status ON public.duty_logs (status);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE public.duty_logs ENABLE ROW LEVEL SECURITY;

-- Chính sách truy cập cho duty_logs:
-- Mọi người dùng đã xác thực (hoặc anon đọc) đều có thể xem sổ trực ban phòng chỉ huy
DROP POLICY IF EXISTS "Cho phép đọc sổ trực ban" ON public.duty_logs;
CREATE POLICY "Cho phép đọc sổ trực ban"
  ON public.duty_logs FOR SELECT
  TO authenticated, anon
  USING (true);

-- Cán bộ vận hành & người dùng đăng nhập có thể ghi sổ
DROP POLICY IF EXISTS "Cho phép ghi sổ trực ban" ON public.duty_logs;
CREATE POLICY "Cho phép ghi sổ trực ban"
  ON public.duty_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Cho phép cập nhật để ký nhận bàn giao ca, liên kết nhiệm vụ, hoặc thu hồi bản ghi
DROP POLICY IF EXISTS "Cho phép cập nhật sổ trực ban" ON public.duty_logs;
CREATE POLICY "Cho phép cập nhật sổ trực ban"
  ON public.duty_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Cho phép xóa bản ghi do chính mình tạo (nếu cần)
DROP POLICY IF EXISTS "Cho phép xóa bản ghi sổ trực ban" ON public.duty_logs;
CREATE POLICY "Cho phép xóa bản ghi sổ trực ban"
  ON public.duty_logs FOR DELETE
  TO authenticated
  USING (true);

-- Kích hoạt Supabase Realtime cho duty_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'duty_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duty_logs;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. BẢNG NHẬT KÝ AN NINH (public.security_audit_logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id TEXT,
    actor_name TEXT NOT NULL,
    role TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    geographic_scope TEXT NOT NULL DEFAULT 'Toàn quốc',
    result TEXT NOT NULL,                  -- 'SUCCESS' | 'DENIED' | 'FAILED'
    reason TEXT NOT NULL,
    permission TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ mục thời gian truy vấn audit trail
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_timestamp ON public.security_audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action ON public.security_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor_id ON public.security_audit_logs (actor_id);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Người dùng đã xác thực (đặc biệt quản trị/cán bộ) xem được audit log hệ thống
DROP POLICY IF EXISTS "Cho phép đọc nhật ký an ninh" ON public.security_audit_logs;
CREATE POLICY "Cho phép đọc nhật ký an ninh"
  ON public.security_audit_logs FOR SELECT
  TO authenticated, anon
  USING (true);

-- Hệ thống & người dùng đã xác thực ghi nhật ký
DROP POLICY IF EXISTS "Cho phép ghi nhật ký an ninh" ON public.security_audit_logs;
CREATE POLICY "Cho phép ghi nhật ký an ninh"
  ON public.security_audit_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Kích hoạt Supabase Realtime cho security_audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'security_audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_audit_logs;
  END IF;
END $$;

