import { test } from "node:test";
import assert from "node:assert/strict";
import {
  incidentToRow,
  rowToIncident,
  shelterToRow,
  rowToShelter,
  sosToRow,
  rowToSos,
  taskToRow,
  rowToTask,
  teamToRow,
  rowToTeam,
  citizenReportToRow,
  rowToCitizenReport,
  publishedAlertToRow,
  rowToPublishedAlert,
  supabaseOperationalRepository,
} from "../../src/infrastructure/persistence/supabaseOperationalRepository";
import type { Incident } from "../../src/domain/incidents/types";
import type { Shelter } from "../../src/domain/shelters/types";
import type { SosRequest } from "../../src/domain/sos/types";
import type { IncidentTask } from "../../src/domain/tasks/types";
import type { RescueTeam } from "../../src/domain/teams/types";
import { supabase, isSupabaseConfigured } from "../../src/infrastructure/supabase/supabaseClient";

test("PERSISTENCE 1: Mapping 2 chiều Incident giữ nguyên tọa độ [lng, lat] và metadata", () => {
  const incident: Incident = {
    id: "INC-TEST-01",
    code: "INC-TEST-01",
    title: "Sạt lở đất đèo Hải Vân",
    type: "Sạt lở đất",
    severity: "Khẩn cấp",
    status: "Đang xử lý",
    location: { name: "Đèo Hải Vân", coordinates: [108.123, 16.123] },
    affectedArea: "Đèo Hải Vân",
    affectedPopulation: 50,
    affectedHouseholds: 10,
    affectedBuildings: 2,
    affectedRoads: 1,
    floodDepth: "0m",
    areaHectares: 5,
    assignedTeamId: "TEAM-01",
    lead: "Chỉ huy Nguyễn Văn A",
    progress: 40,
    createdAt: "2026-10-11T00:00:00.000Z",
    updatedAt: "2026-10-11T01:00:00.000Z",
    createdBy: "USR-OPS-001",
    closedAt: null,
    source: "Hiện trường",
    description: "Sạt lở đất đá chia cắt tuyến đèo",
  };

  const row = incidentToRow(incident);
  assert.equal(row.id, "INC-TEST-01");
  assert.equal(row.longitude, 108.123);
  assert.equal(row.latitude, 16.123);

  const restored = rowToIncident(row);
  assert.equal(restored.id, incident.id);
  assert.deepEqual(restored.location.coordinates, [108.123, 16.123]);
  assert.equal(restored.progress, 40);
});

test("PERSISTENCE 2: Mapping 2 chiều Shelter giữ nguyên thông tin cơ sở vật chất và sức chứa", () => {
  const shelter: Shelter = {
    id: "SHELTER-TEST-01",
    code: "SHELTER-TEST-01",
    name: "Trường THPT Chu Văn An",
    type: "Trường học",
    address: "10 Thụy Khuê, Tây Hồ",
    administrativeArea: "Tây Hồ, Hà Nội",
    coordinates: [105.83, 21.04],
    capacity: 1000,
    currentOccupancy: 350,
    reservedCapacity: 50,
    status: "Đang tiếp nhận",
    readiness: "Sẵn sàng",
    accessibility: "Tiếp cận bình thường",
    responsibleOfficer: { name: "Trần Văn B", role: "Hiệu trưởng", organization: "Sở GD", phone: "0912345678" },
    contact: "0912345678",
    facilities: [{ id: "F-01", name: "Máy phát điện", category: "Điện", quantity: 2, status: "Sẵn sàng" }],
    medicalCapability: "Sơ cứu cơ bản",
    waterAvailability: "Đầy đủ",
    foodAvailability: "Đầy đủ",
    powerAvailability: "Đầy đủ",
    sanitationStatus: "Đầy đủ",
    accessibleForVulnerablePeople: true,
    openingTime: "2026-10-10 07:00",
    closingTime: null,
    linkedIncidentIds: ["INC-TEST-01"],
    activeEvacuationOperationIds: ["EVAC-01"],
    notes: "Ưu tiên người già và trẻ nhỏ",
    updatedAt: "2026-10-11T00:00:00.000Z",
  };

  const row = shelterToRow(shelter);
  assert.equal(row.longitude, 105.83);
  assert.equal(row.latitude, 21.04);
  assert.equal(row.capacity, 1000);

  const restored = rowToShelter(row);
  assert.deepEqual(restored.coordinates, [105.83, 21.04]);
  assert.equal(restored.currentOccupancy, 350);
});

test("PERSISTENCE 3: Mapping 2 chiều Task và Team bảo đảm toàn vẹn dữ liệu điều phối", () => {
  const task: IncidentTask = {
    id: "TSK-TEST-01",
    incidentId: "INC-TEST-01",
    title: "Tiếp cận cứu hộ nhóm người mắc kẹt",
    type: "Cứu hộ",
    priority: "Khẩn cấp",
    teamId: "CH-01",
    teamLeader: "Lê Văn C",
    assignee: "Đội phản ứng nhanh số 1",
    location: "Xã A, Huyện B",
    coordinates: [105.9, 21.1],
    dueAt: "2026-10-11 18:00",
    description: "Mang theo cano và phao cứu sinh",
    status: "Đang thực hiện",
    progress: 50,
    createdAt: "2026-10-11T02:00:00.000Z",
    updatedAt: "2026-10-11T03:00:00.000Z",
    completedAt: null,
  };

  const taskRow = taskToRow(task);
  assert.equal(taskRow.team_id, "CH-01");
  assert.equal(taskRow.progress, 50);

  const restoredTask = rowToTask(taskRow);
  assert.equal(restoredTask.teamId, "CH-01");
  assert.deepEqual(restoredTask.coordinates, [105.9, 21.1]);

  const team: RescueTeam = {
    id: "TEAM-TEST-01",
    code: "TEAM-TEST-01",
    name: "Đội cứu hộ đường sông số 1",
    type: "Cứu nạn đường thủy",
    status: "Đang thực hiện",
    leader: "Phạm D",
    members: 8,
    personnel: [],
    capabilities: ["Cano cứu hộ", "Lặn"],
    capability: "Cano chuyên dụng",
    vehicles: [],
    currentTask: "TSK-TEST-01",
    currentIncident: "INC-TEST-01",
    location: {
      latitude: 21.1,
      longitude: 105.9,
      accuracy: 5,
      timestamp: "2026-10-11T03:00:00.000Z",
      source: "Thiết bị di động",
      communicationStatus: "Kết nối",
    },
    coordinates: [105.9, 21.1],
    lastLocationUpdate: "2026-10-11T03:00:00.000Z",
    lastOperationalUpdate: "2026-10-11T03:00:00.000Z",
    communicationStatus: "Kết nối",
    availability: "Đang bận",
    region: "Miền Bắc",
    operatingScope: "Hà Nội và phụ cận",
    contact: "0987654321",
    notes: "Sẵn sàng 2 cano",
    distance: "5km",
    createdAt: "2026-10-11T00:00:00.000Z",
    updatedAt: "2026-10-11T03:00:00.000Z",
  };

  const teamRow = teamToRow(team);
  assert.equal(teamRow.current_task, "TSK-TEST-01");
  const restoredTeam = rowToTeam(teamRow);
  assert.equal(restoredTeam.currentTask, "TSK-TEST-01");
  assert.deepEqual(restoredTeam.coordinates, [105.9, 21.1]);
});

test("PERSISTENCE 4: Truy vấn Live Supabase Database nạp dữ liệu thật", async () => {
  if (!isSupabaseConfigured || !supabase) {
    console.log("Supabase chưa được cấu hình, bỏ qua test live");
    return;
  }

  const snapshot = await supabaseOperationalRepository.load();
  assert.ok(snapshot, "Snapshot phải tồn tại");
  assert.ok(Array.isArray(snapshot.incidents), "Danh sách incidents phải là mảng");
  assert.ok(Array.isArray(snapshot.shelters), "Danh sách shelters phải là mảng");
  assert.ok(snapshot.incidents.length > 0, "Phải nạp được sự cố từ Supabase");
  assert.ok(snapshot.shelters.length > 0, "Phải nạp được điểm sơ tán từ Supabase");

  // Kiểm tra dữ liệu bão Yagi live từ Supabase
  const yagi01 = snapshot.incidents.find((i: Incident) => i.id === "INC-YAGI-01");
  assert.ok(yagi01, "Phải tìm thấy sự cố INC-YAGI-01 trên live Supabase");
  assert.ok(yagi01.title.includes("Làng Nủ"), "Tiêu đề phải khớp bản ghi Làng Nủ");
});

test("PERSISTENCE 5: Bắt lỗi tường minh, không nuốt ngoại lệ khi ghi vào bảng chưa tồn tại hoặc lỗi RLS", async () => {
  if (!isSupabaseConfigured || !supabase) return;

  // Cố ý ghi vào bảng chưa tồn tại để xác nhận repository bắn lỗi rõ ràng
  await assert.rejects(
    async () => {
      const dummyTask: IncidentTask = {
        id: "TSK-REJECT-TEST",
        incidentId: "INC-YAGI-01",
        title: "Test reject",
        type: "Test",
        priority: "Thấp",
        teamId: "",
        teamLeader: "",
        assignee: "",
        location: "Test",
        coordinates: [105.84, 21.03],
        dueAt: "",
        description: "",
        status: "Chờ giao",
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      await supabaseOperationalRepository.saveTask(dummyTask);
    },
    (err: Error) => {
      assert.ok(err.message.includes("[Supabase]"), "Ngoại lệ phải chứa tiền tố [Supabase]");
      return true;
    }
  );
});
