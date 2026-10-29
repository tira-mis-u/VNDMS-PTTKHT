-- ==============================================================================
-- VNDMS FIX: 20261028_fix_gotrue_schema_error.sql
-- Khắc phục triệt để lỗi GoTrue "500 Database error querying schema" trên Supabase
-- ==============================================================================
-- HƯỚNG DẪN:
-- 1. Mở Supabase Dashboard -> chọn Project của bạn (wazokfndjvrxfbhjpcub)
-- 2. Vào mục "SQL Editor" ở thanh menu bên trái -> Bấm "New query"
-- 3. Dán toàn bộ nội dung script này vào và bấm "Run"
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- ------------------------------------------------------------------------------
  -- 1. CHUẨN HÓA CÁC TRƯỜNG TOKEN BỊ NULL TRONG AUTH.USERS
  -- ------------------------------------------------------------------------------
  -- GoTrue (Supabase Auth server) dùng Go struct quét các cột token dạng chuỗi.
  -- Khi các cột này bị NULL, Go văng lỗi: "converting NULL to string is unsupported"
  -- và trả về mã lỗi 500: "Database error querying schema".
  --
  -- RÀNG BUỘC SUPABASE:
  -- - "confirmed_at" là GENERATED ALWAYS từ email_confirmed_at -> KHÔNG UPDATE/INSERT!
  -- - "phone" có UNIQUE CONSTRAINT "users_phone_key" -> KHÔNG được đặt chuỗi rỗng '',
  --   nếu không có số điện thoại BẮT BUỘC phải để NULL!
  -- ------------------------------------------------------------------------------

  -- 1.1 Chuyển chuỗi rỗng của phone về NULL nếu có để không vi phạm UNIQUE "users_phone_key"
  UPDATE auth.users
  SET phone = NULL
  WHERE phone = '';

  -- 1.2 Chuẩn hóa 6 cột token GoTrue bắt buộc phải là chuỗi (không được NULL)
  UPDATE auth.users
  SET 
    confirmation_token         = COALESCE(confirmation_token, ''),
    recovery_token             = COALESCE(recovery_token, ''),
    email_change_token_new     = COALESCE(email_change_token_new, ''),
    email_change               = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token     = COALESCE(reauthentication_token, ''),
    email_confirmed_at         = COALESCE(email_confirmed_at, NOW()),
    last_sign_in_at            = COALESCE(last_sign_in_at, NOW()),
    raw_app_meta_data          = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
    raw_user_meta_data         = COALESCE(raw_user_meta_data, '{}'::jsonb),
    is_super_admin             = COALESCE(is_super_admin, false),
    is_sso_user                = COALESCE(is_sso_user, false),
    is_anonymous               = COALESCE(is_anonymous, false),
    aud                        = 'authenticated',
    role                       = 'authenticated'
  WHERE 
    confirmation_token IS NULL OR 
    recovery_token IS NULL OR 
    email_change_token_new IS NULL OR 
    email_change IS NULL OR
    email_change_token_current IS NULL OR
    reauthentication_token IS NULL OR
    email_confirmed_at IS NULL;

  -- ------------------------------------------------------------------------------
  -- 2. ĐẢM BẢO 7 TÀI KHOẢN VẬN HÀNH CHUẨN ĐƯỢC TẠO/CẬP NHẬT MẬT KHẨU VNDMS@2026
  -- ------------------------------------------------------------------------------
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
    -- Cập nhật hoặc thêm mới vào auth.users (KHÔNG đưa phone dạng '' hay confirmed_at vào)
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
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
      NOW(), NOW(),
      '', '', '', '', '', '',
      false, false, false
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password         = crypt('VNDMS@2026', gen_salt('bf')),
      email_confirmed_at         = COALESCE(auth.users.email_confirmed_at, NOW()),
      raw_app_meta_data          = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      raw_user_meta_data         = jsonb_build_object('full_name', rec.display_name, 'display_name', rec.display_name, 'username', rec.username, 'role', rec.role),
      confirmation_token         = COALESCE(auth.users.confirmation_token, ''),
      recovery_token             = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new     = COALESCE(auth.users.email_change_token_new, ''),
      email_change               = COALESCE(auth.users.email_change, ''),
      email_change_token_current = COALESCE(auth.users.email_change_token_current, ''),
      reauthentication_token     = COALESCE(auth.users.reauthentication_token, ''),
      updated_at                 = NOW();

    -- Đồng bộ bảng public.profiles
    INSERT INTO public.profiles (
      id, email, full_name, display_name, username, role, scope_level, scope_name, scope_code, active, created_at, updated_at
    )
    VALUES (
      rec.id, rec.email, rec.display_name, rec.display_name, rec.username, rec.role, rec.scope_level, rec.scope_name, rec.scope_code, true, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role         = EXCLUDED.role,
      full_name    = EXCLUDED.full_name,
      display_name = EXCLUDED.display_name,
      username     = EXCLUDED.username,
      scope_level  = EXCLUDED.scope_level,
      scope_name   = EXCLUDED.scope_name,
      scope_code   = EXCLUDED.scope_code,
      active       = true,
      updated_at   = NOW();
  END LOOP;

  -- ------------------------------------------------------------------------------
  -- 3. BỔ SUNG VÀ ĐỒNG BỘ AUTH.IDENTITIES (BẮT BUỘC ĐỂ GOTRUE XÁC THỰC MẬT KHẨU)
  -- ------------------------------------------------------------------------------
  -- Xóa các identity cũ bị lỗi nếu có
  DELETE FROM auth.identities
  WHERE user_id IN (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'a0000000-0000-0000-0000-000000000004'::uuid,
    'a0000000-0000-0000-0000-000000000005'::uuid,
    'a0000000-0000-0000-0000-000000000006'::uuid,
    'a0000000-0000-0000-0000-000000000007'::uuid
  );

  -- Thêm identity chuẩn cho từng tài khoản (Cột "id" và "user_id" đều là kiểu UUID)
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
  SELECT
    u.id, -- Kiểu UUID khớp với column id của auth.identities
    u.id, -- Kiểu UUID khớp với column user_id
    jsonb_build_object(
      'sub', u.id::text,
      'email', u.email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    u.id::text, -- Kiểu TEXT khớp với column provider_id
    NOW(),
    NOW(),
    NOW()
  FROM auth.users u
  WHERE u.email IN (
    'thuantq@vndms.gov.vn',
    'nguyentrung@vndms.gov.vn',
    'phamhieu@vndms.gov.vn',
    'phamdam@vndms.gov.vn',
    'minhtri@vndms.gov.vn',
    'namanh@vndms.gov.vn',
    'trantuan@vndms.gov.vn'
  );

END $$;

-- 4. Kiểm tra danh sách sau khi đồng bộ
SELECT id, email, role, email_confirmed_at, confirmed_at, updated_at 
FROM auth.users 
WHERE email LIKE '%@vndms.gov.vn';
