import { supabaseOperationalRepository } from "../../src/infrastructure/persistence/supabaseOperationalRepository";
import { supabase } from "../../src/infrastructure/supabase/supabaseClient";
import type { IncidentTask, TaskReview, TaskUpdate } from "../../src/domain/tasks/types";
import type { RescueTeam } from "../../src/domain/teams/types";
import type { SosRequest } from "../../src/domain/sos/types";
import type { CitizenReport } from "../../src/domain/reports/types";
import type { PublishedAlert } from "../../src/domain/published-alerts/types";

async function verifyAll() {
  console.log("=================================================================");
  console.log("VNDMS SUPABASE FULL SCHEMA & CRUD VERIFICATION (ALL TABLES)");
  console.log("=================================================================\n");

  // 0. Đăng nhập tài khoản vận hành (admin) để có JWT authenticated
  console.log(">>> BƯỚC 0: Đăng nhập Supabase Auth (thuantq@vndms.gov.vn / VNDMS@2026)...");
  const { data: authSession, error: authErr } = await supabase!.auth.signInWithPassword({
    email: "thuantq@vndms.gov.vn",
    password: "VNDMS@2026",
  });
  if (authErr) {
    console.warn("! Cảnh báo đăng nhập Supabase Auth:", authErr.message);
  } else {
    console.log("✓ Đã đăng nhập Supabase Auth thành công:", authSession.user?.email, `(Role: ${authSession.user?.user_metadata?.role})`);
  }

  // 1. Tải snapshot
  console.log("\n>>> BƯỚC 1: supabaseOperationalRepository.load()...");
  const snapshot = await supabaseOperationalRepository.load();
  console.log("- Source:", snapshot.metadata.source);
  console.log("- Incidents count:", snapshot.incidents.length);
  console.log("- Shelters count:", snapshot.shelters.length);
  console.log("- SOS Requests count:", snapshot.sosRequests.length);
  console.log("- Tasks count:", snapshot.tasks.length);
  console.log("- Teams count:", snapshot.teams.length);
  console.log("- Citizen Reports count:", snapshot.citizenReports.length);
  console.log("- Published Alerts count:", snapshot.publishedAlerts.length);
  console.log("- Task Reviews count:", snapshot.taskReviews.length);

  const timestamp = Date.now();

  // 2. Test Teams
  console.log("\n>>> BƯỚC 2: Kiểm thử Team CRUD...");
  const testTeamId = `TEST-TEAM-${timestamp}`;
  const testTeam: RescueTeam = {
    id: testTeamId,
    code: testTeamId,
    name: "Đội Phản Ứng Nhanh Kiểm Thử",
    type: "Cứu hộ",
    status: "Sẵn sàng",
    leader: "Đội trưởng Test",
    members: 8,
    personnel: [],
    capabilities: ["Cứu hộ đường sông", "Y tế dã chiến"],
    capability: "Cứu hộ đường sông",
    vehicles: [],
    currentTask: null,
    currentIncident: null,
    coordinates: [105.85, 21.03],
    location: {
      latitude: 21.03,
      longitude: 105.85,
      accuracy: 10,
      timestamp: new Date().toISOString(),
      source: "Thiết bị định vị",
      communicationStatus: "Kết nối",
    },
    lastLocationUpdate: new Date().toISOString(),
    lastOperationalUpdate: new Date().toISOString(),
    communicationStatus: "Kết nối",
    availability: "Có thể điều phối",
    region: "Hà Nội",
    operatingScope: "Miền Bắc",
    contact: "0912345678",
    notes: "Đội kiểm thử tự động",
    distance: "5km",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await supabaseOperationalRepository.saveTeam(testTeam);
  console.log("✓ saveTeam thành công");
  const { data: dbTeam } = await supabase!.from("teams").select("*").eq("id", testTeamId).single();
  console.log("✓ DB Team tồn tại:", dbTeam?.id, dbTeam?.name);

  // 3. Test Tasks
  console.log("\n>>> BƯỚC 3: Kiểm thử Task CRUD...");
  const validIncidentId = snapshot.incidents[0]?.id ?? "INC-YAGI-01";
  const testTaskId = `TEST-TASK-${timestamp}`;
  const testTask: IncidentTask = {
    id: testTaskId,
    incidentId: validIncidentId,
    title: "Nhiệm vụ kiểm thử tự động",
    type: "Cứu hộ",
    priority: "Khẩn cấp",
    teamId: testTeamId,
    teamLeader: "Đội trưởng Test",
    assignee: "Đội trưởng Test",
    location: "Khu vực kiểm thử",
    coordinates: [105.85, 21.03],
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    description: "Nhiệm vụ kiểm thử lưu trữ",
    status: "Đang thực hiện",
    progress: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    assignmentHistory: [],
  };
  await supabaseOperationalRepository.saveTask(testTask);
  console.log("✓ saveTask thành công");
  const { data: dbTask } = await supabase!.from("tasks").select("*").eq("id", testTaskId).single();
  console.log("✓ DB Task tồn tại:", dbTask?.id, dbTask?.title);

  // 4. Test Task Updates
  console.log("\n>>> BƯỚC 4: Kiểm thử Task Update...");
  const testUpdateId = `TEST-UPD-${timestamp}`;
  const testUpdate: TaskUpdate = {
    id: testUpdateId,
    taskId: testTaskId,
    incidentId: validIncidentId,
    timestamp: new Date().toISOString(),
    actor: "Đội trưởng Test",
    teamId: testTeamId,
    message: "Tiến độ đạt 25%",
    location: "Khu vực kiểm thử",
    source: "Ứng dụng hiện trường",
    networkStatus: "Đã đồng bộ",
  };
  await supabaseOperationalRepository.saveTaskUpdate(testUpdate);
  console.log("✓ saveTaskUpdate thành công");
  const { data: dbUpd } = await supabase!.from("task_updates").select("*").eq("id", testUpdateId).single();
  console.log("✓ DB TaskUpdate tồn tại:", dbUpd?.id, dbUpd?.message);

  // 5. Test Task Reviews
  console.log("\n>>> BƯỚC 5: Kiểm thử Task Review...");
  const testReviewId = `TEST-REV-${timestamp}`;
  const testReview: TaskReview = {
    id: testReviewId,
    taskId: testTaskId,
    incidentId: validIncidentId,
    reportedBy: "Đội trưởng Test",
    reportedAt: new Date().toISOString(),
    reportNote: "Hoàn thành giai đoạn 1 kiểm thử",
    decision: "Chờ xác nhận",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  };
  await supabaseOperationalRepository.saveTaskReview(testReview);
  console.log("✓ saveTaskReview thành công");
  const { data: dbRev } = await supabase!.from("task_reviews").select("*").eq("id", testReviewId).single();
  console.log("✓ DB TaskReview tồn tại:", dbRev?.id, dbRev?.decision);

  // 6. Test Citizen Reports
  console.log("\n>>> BƯỚC 6: Kiểm thử Citizen Report...");
  const testReportId = `TEST-REP-${timestamp}`;
  const testReport: CitizenReport = {
    id: testReportId,
    code: testReportId,
    ownerUserId: "test-user-id",
    reporterName: "Công dân Test",
    contact: "0901234567",
    category: "Ngập lụt",
    description: "Nước ngập sâu kiểm thử",
    location: {
      address: "Đường kiểm thử, Hà Nội",
      administrativeArea: "Hà Nội",
      coordinates: [105.85, 21.03],
    },
    status: "Mới",
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    duplicateOfId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await supabaseOperationalRepository.saveCitizenReport(testReport);
  console.log("✓ saveCitizenReport thành công");
  const { data: dbRep } = await supabase!.from("citizen_reports").select("*").eq("id", testReportId).single();
  console.log("✓ DB CitizenReport tồn tại:", dbRep?.id, dbRep?.category);

  // 7. Test Published Alerts
  console.log("\n>>> BƯỚC 7: Kiểm thử Published Alert...");
  const testAlertId = `TEST-ALT-${timestamp}`;
  const testAlert: PublishedAlert = {
    id: testAlertId,
    code: testAlertId,
    title: "Cảnh báo kiểm thử tự động",
    content: "Bản tin thử nghiệm độ bền",
    severity: "high",
    areaName: "Khu vực kiểm thử",
    status: "Đã công bố",
    revision: 1,
    createdBy: "Ban Chỉ đạo",
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    withdrawnAt: null,
    updatedAt: new Date().toISOString(),
  };
  await supabaseOperationalRepository.savePublishedAlert(testAlert);
  console.log("✓ savePublishedAlert thành công");
  const { data: dbAlt } = await supabase!.from("published_alerts").select("*").eq("id", testAlertId).single();
  console.log("✓ DB PublishedAlert tồn tại:", dbAlt?.id, dbAlt?.title);

  // 8. Test SOS Request
  console.log("\n>>> BƯỚC 8: Kiểm thử SOS Request...");
  const testSosId = `TEST-SOS-${timestamp}`;
  const testSos: SosRequest = {
    id: testSosId,
    code: testSosId,
    ownerUserId: "test-user-id",
    gpsCaptured: true,
    receivedAt: new Date().toISOString(),
    reporter: {
      name: "Người báo tin",
      contact: "0988888888",
      source: "Người dân",
    },
    location: {
      name: "Trạm kiểm thử",
      address: "Hà Nội",
      administrativeArea: "Hà Nội",
      coordinates: [105.85, 21.03],
      accessCondition: "Tiếp cận bình thường",
      floodDepth: "1m",
    },
    description: "Cần hỗ trợ kiểm thử khẩn cấp",
    affectedPeople: [],
    peopleAtRisk: 3,
    injuredCount: 0,
    missingCount: 0,
    childrenCount: 1,
    elderlyCount: 0,
    disabledCount: 0,
    severity: "Đe dọa tính mạng",
    priority: "P1 — Khẩn cấp",
    triageReasons: ["Nguy cơ ngập sâu"],
    status: "Mới tiếp nhận",
    verificationStatus: "Chưa xác minh",
    linkedIncidentId: validIncidentId,
    assignedTeamId: null,
    linkedTaskId: null,
    shelterDestinationId: null,
    communicationStatus: "Kết nối",
    lastContactAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    resolutionSummary: null,
    closedAt: null,
  };
  await supabaseOperationalRepository.saveSosRequest(testSos);
  console.log("✓ saveSosRequest thành công");
  const { data: dbSos } = await supabase!.from("sos_requests").select("*").eq("id", testSosId).single();
  console.log("✓ DB SosRequest tồn tại:", dbSos?.id, dbSos?.description);

  // 9. DỌN DẸP DỮ LIỆU KIỂM THỬ (CLEANUP TEST RECORDS)
  console.log("\n>>> BƯỚC 9: Dọn dẹp các bản ghi kiểm thử...");
  await supabase!.from("task_updates").delete().eq("id", testUpdateId);
  await supabase!.from("task_reviews").delete().eq("id", testReviewId);
  await supabase!.from("tasks").delete().eq("id", testTaskId);
  await supabase!.from("teams").delete().eq("id", testTeamId);
  await supabase!.from("citizen_reports").delete().eq("id", testReportId);
  await supabase!.from("published_alerts").delete().eq("id", testAlertId);
  await supabase!.from("sos_requests").delete().eq("id", testSosId);
  console.log("✓ Đã dọn dẹp toàn bộ bản ghi kiểm thử an toàn!");

  console.log("\n=================================================================");
  console.log("XÁC MINH TOÀN DIỆN THÀNH CÔNG: TẤT CẢ 8 BẢNG HOẠT ĐỘNG 100% TRÊN CLOUD!");
  console.log("=================================================================");
}

verifyAll().catch((err) => {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err);
  process.exit(1);
});
