-- VNDMS: authorization hardening.  This migration deliberately does not touch
-- auth.users or auth.identities; the observed Auth 500 needs Auth-log evidence.

-- Baseline 20261011 accepted client-provided role metadata in this trigger.
-- New Auth sign-ups always receive the least-privileged citizen role.  Existing
-- profiles retain their authorization fields on conflict.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, display_name, username, role,
    scope_name, scope_level, scope_code, phone, organization, active
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email, 'Người dùng'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email, 'Người dùng'),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    'citizen',
    'Toàn quốc', 'national', 'VN',
    NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'organization', true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    organization = EXCLUDED.organization,
    updated_at = NOW();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Profiles are an authorization boundary.  A normal user may change only
-- presentation/contact fields, never role, activation state, or scope.
-- Replace the historical broad authenticated grant with the minimum verb set
-- required by the RLS policies on every public operational table currently in
-- Ensure location_history table exists before adjusting grants and policies
CREATE TABLE IF NOT EXISTS public.location_history (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geom GEOMETRY(Point, 4326),
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_location_history_entity ON public.location_history(entity_type, entity_id, recorded_at DESC);

REVOKE ALL ON TABLE
  public.profiles, public.incidents, public.shelters, public.sos_requests,
  public.location_history, public.teams, public.tasks, public.task_reviews,
  public.task_updates, public.citizen_reports, public.published_alerts
FROM authenticated;
REVOKE ALL ON TABLE
  public.profiles, public.incidents, public.shelters, public.sos_requests,
  public.location_history, public.teams, public.tasks, public.task_reviews,
  public.task_updates, public.citizen_reports, public.published_alerts
FROM anon;

GRANT SELECT ON TABLE public.shelters, public.published_alerts TO anon;
GRANT INSERT ON TABLE public.sos_requests TO anon;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incidents, public.shelters,
  public.teams, public.tasks, public.task_reviews, public.task_updates,
  public.published_alerts TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.sos_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.citizen_reports TO authenticated;

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, display_name, phone, organization) ON TABLE public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cập nhật hồ sơ cá nhân" ON public.profiles;
DROP POLICY IF EXISTS "Cập nhật hồ sơ cá nhân an toàn" ON public.profiles;
CREATE POLICY "Cập nhật hồ sơ cá nhân an toàn" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Security-definer helpers always use a fixed search path and are not callable
-- by PUBLIC.  They read the profile row as the function owner, avoiding an RLS
-- recursion while keeping auth.uid() tied to the caller JWT.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT p.role FROM public.profiles AS p WHERE p.id = auth.uid() AND p.active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_operational_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE((
    SELECT p.active AND p.role IN ('admin', 'disaster_officer', 'rescue_unit')
    FROM public.profiles AS p WHERE p.id = auth.uid() LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_operational_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operational_staff() TO authenticated;

-- Database-only administrative path for authorization-bearing fields.  It is
-- intentionally RPC-only: clients cannot UPDATE these columns directly.
CREATE OR REPLACE FUNCTION public.admin_update_profile_authorization(
  target_id UUID,
  next_role TEXT DEFAULT NULL,
  next_active BOOLEAN DEFAULT NULL,
  next_scope_level TEXT DEFAULT NULL,
  next_scope_name TEXT DEFAULT NULL,
  next_scope_code TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'administrator role required' USING ERRCODE = '42501';
  END IF;
  IF next_role IS NOT NULL AND next_role NOT IN ('admin', 'disaster_officer', 'rescue_unit', 'citizen') THEN
    RAISE EXCEPTION 'invalid role' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
     SET role = COALESCE(next_role, role),
         active = COALESCE(next_active, active),
         scope_level = COALESCE(next_scope_level, scope_level),
         scope_name = COALESCE(next_scope_name, scope_name),
         scope_code = COALESCE(next_scope_code, scope_code),
         updated_at = NOW()
   WHERE id = target_id
   RETURNING * INTO updated_profile;
  IF updated_profile IS NULL THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN updated_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_profile_authorization(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_authorization(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

-- Replace permissive legacy intake policies.  Anonymous reporters have no JWT
-- and therefore cannot claim ownership; authenticated reporters must bind the
-- row to their own subject.  The basic non-empty checks prevent an unrestricted
-- CRUD policy while database constraints continue to validate the row shape.
DROP POLICY IF EXISTS "Gửi yêu cầu SOS khẩn cấp" ON public.sos_requests;
DROP POLICY IF EXISTS "Khách gửi SOS không định danh" ON public.sos_requests;
CREATE POLICY "Khách gửi SOS không định danh" ON public.sos_requests
  FOR INSERT TO anon
  WITH CHECK (owner_user_id IS NULL AND code <> '' AND description <> '');

DROP POLICY IF EXISTS "Người dùng gửi SOS của mình" ON public.sos_requests;
CREATE POLICY "Người dùng gửi SOS của mình" ON public.sos_requests
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid()::text AND code <> '' AND description <> '');

DROP POLICY IF EXISTS "Công dân gửi phản ánh" ON public.citizen_reports;
DROP POLICY IF EXISTS "Người dùng gửi phản ánh của mình" ON public.citizen_reports;
CREATE POLICY "Người dùng gửi phản ánh của mình" ON public.citizen_reports
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid()::text AND code <> '' AND description <> '');

-- location_history contains sensitive movement data.  It was the one exposed
-- operational table without RLS.  Only active operational staff can read it;
-- writing is reserved for service-role/server ingestion.
REVOKE ALL ON TABLE public.location_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.location_history TO authenticated;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cán bộ tác nghiệp xem lịch sử vị trí" ON public.location_history;
CREATE POLICY "Cán bộ tác nghiệp xem lịch sử vị trí" ON public.location_history
  FOR SELECT TO authenticated
  USING (public.is_operational_staff());
