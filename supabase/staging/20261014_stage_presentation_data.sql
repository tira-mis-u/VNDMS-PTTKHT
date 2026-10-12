-- Run manually in the Supabase SQL Editor only after:
--   1) baseline 20261011 is confirmed applied; and
--   2) 20261013_harden_authorization_and_sessions.sql is applied.
-- This script never creates Auth users, changes grants/RLS, or deletes data.
-- It upserts only STG-2026-10-12 identifiers so it is repeatable for staging.

DO $$
DECLARE required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'incidents', 'shelters', 'teams', 'tasks', 'task_reviews',
    'task_updates', 'sos_requests', 'citizen_reports', 'published_alerts'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Missing public.%: apply/verify the 20261011 baseline before loading staging data', required_table;
    END IF;
  END LOOP;
END $$;

INSERT INTO public.incidents (
  id, code, title, type, severity, status, location_name, latitude, longitude,
  affected_population, affected_households, description, created_by, source, progress
) VALUES (
  'STG-INC-20261012-01', 'STG-INC-20261012-01', 'Mưa lớn và ngập cục bộ tại Hà Nội',
  'Mưa lớn, ngập đô thị', 'Cao', 'Đang xử lý', 'Phường Yên Hòa, Hà Nội', 21.0285, 105.7912,
  186, 52, 'Mực nước dâng tại khu dân cư thấp trũng; cần điều phối điểm sơ tán và lực lượng hỗ trợ.',
  'Hệ thống staging', 'Diễn tập VNDMS', 35
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, severity = EXCLUDED.severity, status = EXCLUDED.status,
  description = EXCLUDED.description, progress = EXCLUDED.progress, updated_at = NOW();

INSERT INTO public.teams (
  id, code, name, type, status, leader, members, capabilities, capability,
  latitude, longitude, communication_status, availability, region, operating_scope, contact, notes
) VALUES (
  'STG-TEAM-20261012-01', 'STG-TEAM-20261012-01', 'Đội cứu hộ phản ứng nhanh Hà Nội',
  'Cứu hộ đường bộ', 'Đang triển khai', 'Nguyễn Minh An', 12,
  ARRAY['Sơ cứu', 'Cứu hộ đô thị', 'Điều phối sơ tán'], 'Cứu hộ đô thị',
  21.0301, 105.7895, 'Kết nối', 'Đang thực hiện nhiệm vụ', 'Hà Nội', 'Quận Cầu Giấy',
  '024-3900-0112', 'Dữ liệu staging phục vụ trình bày'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status, current_incident = 'STG-INC-20261012-01',
  availability = EXCLUDED.availability, updated_at = NOW();

INSERT INTO public.shelters (
  id, code, name, type, address, latitude, longitude, capacity, current_occupancy,
  reserved_capacity, status, readiness, accessibility, contact, facilities,
  medical_capability, water_availability, food_availability, power_availability,
  sanitation_status, accessible_for_vulnerable_people, notes
) VALUES (
  'STG-SHL-20261012-01', 'STG-SHL-20261012-01', 'Nhà văn hóa Yên Hòa', 'Nhà văn hóa',
  'Số 1 phố Dương Đình Nghệ, phường Yên Hòa, Hà Nội', 21.0292, 105.7930, 500, 184,
  120, 'Đang tiếp nhận', 'Sẵn sàng', 'Tiếp cận bình thường', '024-3900-0113',
  '[{"id":"water","name":"Nước sạch","category":"Nhu yếu phẩm","quantity":500,"status":"Sẵn sàng"},{"id":"medical","name":"Túi sơ cứu","category":"Y tế","quantity":20,"status":"Sẵn sàng"}]'::jsonb,
  'Sơ cứu cơ bản', 'Đầy đủ', 'Đầy đủ', 'Dự phòng', 'Đầy đủ', true,
  'Điểm sơ tán staging liên kết với diễn tập ngập đô thị'
) ON CONFLICT (id) DO UPDATE SET
  current_occupancy = EXCLUDED.current_occupancy, reserved_capacity = EXCLUDED.reserved_capacity,
  status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = NOW();

INSERT INTO public.tasks (
  id, incident_id, title, type, priority, team_id, team_leader, assignee, location,
  latitude, longitude, due_at, description, status, progress
) VALUES (
  'STG-TASK-20261012-01', 'STG-INC-20261012-01', 'Khảo sát tuyến phố Dương Đình Nghệ',
  'Khảo sát hiện trường', 'Khẩn cấp', 'STG-TEAM-20261012-01', 'Nguyễn Minh An',
  'Đội cứu hộ phản ứng nhanh Hà Nội', 'Phường Yên Hòa, Hà Nội', 21.0291, 105.7920,
  '2026-10-12T12:00:00+07:00', 'Đánh giá điểm ngập, hỗ trợ người dân tới điểm sơ tán.', 'Đang thực hiện', 45
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status, progress = EXCLUDED.progress, updated_at = NOW();

INSERT INTO public.task_updates (id, task_id, incident_id, timestamp, actor, team_id, message, location, source, network_status)
VALUES (
  'STG-UPD-20261012-01', 'STG-TASK-20261012-01', 'STG-INC-20261012-01',
  '2026-10-12T09:30:00+07:00', 'Nguyễn Minh An', 'STG-TEAM-20261012-01',
  'Đã hoàn tất khảo sát ban đầu; tuyến tiếp cận nhà văn hóa thông suốt.', 'Dương Đình Nghệ', 'Ứng dụng hiện trường', 'Đã đồng bộ'
) ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message;

INSERT INTO public.task_reviews (id, task_id, incident_id, reported_by, reported_at, report_note, decision)
VALUES (
  'STG-REV-20261012-01', 'STG-TASK-20261012-01', 'STG-INC-20261012-01',
  'Nguyễn Minh An', '2026-10-12T09:35:00+07:00', 'Báo cáo khảo sát hiện trường giai đoạn một.', 'Chờ xác nhận'
) ON CONFLICT (id) DO UPDATE SET report_note = EXCLUDED.report_note;

INSERT INTO public.sos_requests (id, code, phone, description, severity, status, address, latitude, longitude,
  owner_user_id, priority, reporter, location, people_at_risk, verification_status)
VALUES (
  'STG-SOS-20261012-01', 'STG-SOS-20261012-01', '0900000112', 'Gia đình cần hỗ trợ di chuyển khỏi khu vực ngập.',
  'Khẩn cấp', 'Đang xác minh', 'Ngõ 18 Dương Đình Nghệ, Hà Nội', 21.0290, 105.7918,
  NULL, 'P1 — Khẩn cấp', '{"name":"Người dân staging","contact":"0900000112","source":"Điện thoại"}'::jsonb,
  '{"name":"Ngõ 18 Dương Đình Nghệ","address":"Ngõ 18 Dương Đình Nghệ, Hà Nội","administrativeArea":"Cầu Giấy","coordinates":[105.7918,21.0290]}'::jsonb,
  4, 'Chưa xác minh'
) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description;

INSERT INTO public.citizen_reports (id, code, owner_user_id, reporter_name, contact, category, description,
  address, administrative_area, latitude, longitude, status)
VALUES (
  'STG-REP-20261012-01', 'STG-REP-20261012-01', 'STAGING-UNASSIGNED', 'Người dân staging',
  '0900000112', 'Ngập lụt', 'Nước tràn vào tầng một khu chung cư.',
  'Dương Đình Nghệ, Hà Nội', 'Cầu Giấy, Hà Nội', 21.0294, 105.7914, 'Mới'
) ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW();

INSERT INTO public.published_alerts (id, code, title, content, severity, area_name, status, revision, created_by, published_at)
VALUES (
  'STG-ALT-20261012-01', 'STG-ALT-20261012-01', 'Cảnh báo ngập cục bộ khu vực Yên Hòa',
  'Người dân hạn chế đi qua khu vực trũng thấp, theo dõi hướng dẫn của lực lượng chức năng và chuẩn bị sơ tán khi được yêu cầu.',
  'Cảnh báo', 'Phường Yên Hòa, Hà Nội', 'Đã công bố', 1, 'Hệ thống staging', '2026-10-12T09:00:00+07:00'
) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();

-- =============================================================================
-- VERIFICATION — run this after the script and confirm all 7 rows appear
-- =============================================================================
SELECT 'incidents'       AS tbl, COUNT(*) AS total, SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) AS staged FROM public.incidents
UNION ALL
SELECT 'teams',          COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.teams
UNION ALL
SELECT 'shelters',       COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.shelters
UNION ALL
SELECT 'tasks',          COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.tasks
UNION ALL
SELECT 'task_updates',   COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.task_updates
UNION ALL
SELECT 'task_reviews',   COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.task_reviews
UNION ALL
SELECT 'sos_requests',   COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.sos_requests
UNION ALL
SELECT 'citizen_reports',COUNT(*), SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.citizen_reports
UNION ALL
SELECT 'published_alerts',COUNT(*),SUM(CASE WHEN id LIKE 'STG-%' THEN 1 ELSE 0 END) FROM public.published_alerts
ORDER BY tbl;

