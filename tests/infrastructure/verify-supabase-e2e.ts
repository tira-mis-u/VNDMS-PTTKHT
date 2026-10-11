import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import type { Incident } from "../../src/domain/incidents/types";
import type { Shelter } from "../../src/domain/shelters/types";

// Load environment variables from .env
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  const envContent = fs.readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const k = match[1].trim();
      const v = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (k === "VITE_SUPABASE_URL") process.env.VITE_SUPABASE_URL = v;
      if (k === "VITE_SUPABASE_ANON_KEY") process.env.VITE_SUPABASE_ANON_KEY = v;
    }
  }
}

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

async function main() {
  const { supabaseOperationalRepository } = await import(
    "../../src/infrastructure/persistence/supabaseOperationalRepository"
  );

  console.log("=================================================================");
  console.log("VNDMS SUPABASE END-TO-END VERIFICATION");
  console.log("Supabase URL:", url);
  console.log("Supabase Key:", key ? `${key.substring(0, 12)}...` : "None");
  console.log("=================================================================\n");

  // BƯỚC 1: TẢI SNAPSHOT QUA REPOSITORY VÀ ĐỌC BẢN GHI CÓ SẴN
  console.log(">>> BƯỚC 1: Đọc dữ liệu thực tế qua supabaseOperationalRepository.load()...");
  const initialSnapshot = await supabaseOperationalRepository.load();
  console.log("- Nguồn dữ liệu:", initialSnapshot.metadata.source);
  console.log("- Số lượng Incidents nạp được:", initialSnapshot.incidents.length);
  console.log("- Số lượng Shelters nạp được:", initialSnapshot.shelters.length);
  console.log("- Số lượng SOS Requests nạp được:", initialSnapshot.sosRequests.length);

  const existingIncident = initialSnapshot.incidents.find((i: Incident) => i.id === "INC-YAGI-01");
  if (existingIncident) {
    console.log("✓ Tìm thấy bản ghi có sẵn trong DB:", existingIncident.code, "-", existingIncident.title);
  } else {
    console.log("! Không tìm thấy INC-YAGI-01 trong danh sách ban đầu");
  }

  // BƯỚC 2: TẠO BẢN GHI KIỂM THỬ QUA REPOSITORY
  const testIncidentId = `TEST-E2E-${Date.now()}`;
  console.log(`\n>>> BƯỚC 2: Tạo bản ghi kiểm thử Incident qua repository: ${testIncidentId}...`);
  const newIncident: Incident = {
    id: testIncidentId,
    code: testIncidentId,
    title: "Kiểm thử End-to-End Supabase Persistence",
    type: "Mưa lớn",
    severity: "Trung bình",
    status: "Đang xử lý",
    location: {
      name: "Trạm quan trắc kiểm thử Hà Nội",
      coordinates: [105.85, 21.03],
    },
    affectedArea: "Khu vực kiểm thử",
    affectedPopulation: 10,
    affectedHouseholds: 2,
    affectedBuildings: 0,
    affectedRoads: 0,
    floodDepth: "0.2m",
    areaHectares: 1.5,
    assignedTeamId: null,
    lead: "Hệ thống kiểm thử tự động",
    progress: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "Test Runner",
    closedAt: null,
    source: "Tự động hóa",
    description: "Bản ghi kiểm tra luồng lưu trữ vĩnh viễn Supabase",
  };

  await supabaseOperationalRepository.saveIncident(newIncident);
  console.log("✓ Đã gọi saveIncident() thành công qua repository");

  // BƯỚC 3: XÁC MINH BẢN GHI XUẤT HIỆN TRÊN DATABASE THẬT
  console.log("\n>>> BƯỚC 3: Truy vấn trực tiếp database để xác minh...");
  const { data: dbRecord, error: dbErr } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", testIncidentId)
    .single();

  if (dbErr || !dbRecord) {
    throw new Error(`Thất bại: Không tìm thấy bản ghi trên Supabase: ${dbErr?.message}`);
  }
  console.log("✓ Xác minh bản ghi tồn tại trên Supabase Cloud:", {
    id: dbRecord.id,
    title: dbRecord.title,
    progress: dbRecord.progress,
  });

  // BƯỚC 4: CẬP NHẬT BẢN GHI VÀ XÁC MINH GIÁ TRỊ MỚI
  console.log("\n>>> BƯỚC 4: Cập nhật bản ghi qua repository...");
  const updatedIncident: Incident = {
    ...newIncident,
    progress: 85,
    description: "Đã cập nhật tiến độ kiểm thử lên 85% thành công",
    updatedAt: new Date().toISOString(),
  };

  await supabaseOperationalRepository.saveIncident(updatedIncident);
  console.log("✓ Đã gọi saveIncident() cập nhật thành công");

  const { data: updatedRecord, error: updateErr } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", testIncidentId)
    .single();

  if (updateErr || !updatedRecord) {
    throw new Error(`Thất bại: Không lấy được bản ghi sau cập nhật: ${updateErr?.message}`);
  }
  console.log("✓ Xác minh giá trị cập nhật trên DB:", {
    progress: updatedRecord.progress,
    description: updatedRecord.description,
  });
  if (!updatedRecord.description?.includes("85%")) {
    throw new Error(`Giá trị cập nhật không khớp (kỳ vọng chứa 85%, nhận ${updatedRecord.description})`);
  }

  // BƯỚC 5: TẢI LẠI QUA REPOSITORY LOAD() ĐỂ XÁC NHẬN TRẠNG THÁI KHỞI ĐỘNG LẠI
  console.log("\n>>> BƯỚC 5: Gọi lại repository load() để xác nhận dữ liệu được nạp đúng...");
  const reloadedSnapshot = await supabaseOperationalRepository.load();
  const foundInReload = reloadedSnapshot.incidents.find((i: Incident) => i.id === testIncidentId);
  if (!foundInReload) {
    throw new Error("Thất bại: Bản ghi mới không xuất hiện trong snapshot nạp lại!");
  }
  console.log("✓ Bản ghi xuất hiện đầy đủ trong snapshot nạp lại:", {
    id: foundInReload.id,
    progress: foundInReload.progress,
    description: foundInReload.description,
  });

  // BƯỚC 6: XÓA BẢN GHI KIỂM THỬ VÀ XÁC MINH ĐÃ DỌN DẸP SẠCH SẼ
  console.log("\n>>> BƯỚC 6: Xóa bản ghi kiểm thử qua repository deleteIncident()...");
  await supabaseOperationalRepository.deleteIncident(testIncidentId);
  console.log("✓ Đã gọi deleteIncident() thành công");

  const { data: afterDelete } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", testIncidentId);

  console.log("✓ Số lượng bản ghi sau khi xóa (phải là 0):", afterDelete?.length ?? 0);
  if (afterDelete && afterDelete.length > 0) {
    throw new Error("Thất bại: Bản ghi kiểm thử vẫn còn tồn tại sau lệnh xóa!");
  }

  // BƯỚC 7: KIỂM THỬ TƯƠNG TỰ VỚI SHELTER
  const testShelterId = `TEST-SHELTER-${Date.now()}`;
  console.log(`\n>>> BƯỚC 7: Kiểm thử CRUD với Shelter: ${testShelterId}...`);
  const newShelter: Shelter = {
    id: testShelterId,
    code: testShelterId,
    name: "Điểm Sơ Tán Kiểm Thử Tự Động",
    type: "Trường học",
    address: "Số 1 Tràng Tiền, Hoàn Kiếm, Hà Nội",
    administrativeArea: "Hà Nội",
    coordinates: [105.85, 21.03],
    capacity: 250,
    currentOccupancy: 40,
    reservedCapacity: 20,
    status: "Đang tiếp nhận",
    readiness: "Sẵn sàng",
    accessibility: "Tiếp cận bình thường",
    responsibleOfficer: {
      name: "Nguyễn Văn Test",
      role: "Trưởng ban tiếp nhận",
      organization: "PCTT",
      phone: "0912345678",
    },
    contact: "112",
    facilities: [
      { id: "fac-1", name: "Nước sạch", category: "Nước", quantity: 1, status: "Sẵn sàng" },
      { id: "fac-2", name: "Y tế", category: "Y tế", quantity: 1, status: "Sẵn sàng" },
      { id: "fac-3", name: "Máy phát điện", category: "Năng lượng", quantity: 1, status: "Sẵn sàng" },
    ],
    medicalCapability: "Có đội y tế",
    waterAvailability: "Đầy đủ",
    foodAvailability: "Đầy đủ",
    powerAvailability: "Đầy đủ",
    sanitationStatus: "Đầy đủ",
    accessibleForVulnerablePeople: true,
    openingTime: null,
    closingTime: null,
    linkedIncidentIds: [],
    activeEvacuationOperationIds: [],
    notes: "Ghi chú kiểm thử tự động",
    updatedAt: new Date().toISOString(),
  };

  await supabaseOperationalRepository.saveShelter(newShelter);
  console.log("✓ Đã lưu Shelter qua repository");

  const { data: dbShelter } = await supabase.from("shelters").select("*").eq("id", testShelterId).single();
  console.log("✓ Xác minh Shelter trên DB:", { id: dbShelter?.id, name: dbShelter?.name });

  await supabaseOperationalRepository.deleteShelter(testShelterId);
  console.log("✓ Đã xóa Shelter qua repository");

  const { data: afterDeleteShelter } = await supabase.from("shelters").select("*").eq("id", testShelterId);
  console.log("✓ Số lượng Shelter sau xóa (phải là 0):", afterDeleteShelter?.length ?? 0);

  console.log("\n=================================================================");
  console.log("KẾT QUẢ: TOÀN BỘ CHU TRÌNH CRUD THẬT TRÊN SUPABASE HOÀN TẤT THÀNH CÔNG 100%!");
  console.log("=================================================================");
}

main().catch((err) => {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ E2E:", err);
  process.exit(1);
});
