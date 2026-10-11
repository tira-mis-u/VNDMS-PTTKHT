import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env manually if process.env.VITE_SUPABASE_URL is not set
let url = process.env.VITE_SUPABASE_URL;
let key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  const envContent = fs.readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const k = match[1].trim();
      const v = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (k === "VITE_SUPABASE_URL") url = v;
      if (k === "VITE_SUPABASE_ANON_KEY") key = v;
    }
  }
}

console.log("Supabase URL:", url);
console.log("Supabase Key:", key ? `${key.substring(0, 10)}...` : "None");

const supabase = createClient(url!, key!);

async function runVerification() {
  const tables = [
    "profiles",
    "incidents",
    "shelters",
    "sos_requests",
    "tasks",
    "teams",
    "task_reviews",
    "task_updates",
    "citizen_reports",
    "published_alerts"
  ];

  console.log("\n--- KIỂM TRA SỰ TỒN TẠI VÀ CÁC CỘT HIỆN TẠI ---");
  for (const table of tables) {
    try {
      const { data, error, status } = await supabase.from(table).select("*").limit(1);
      if (error) {
        console.log(`Bảng '${table}': LỖI (HTTP ${status}) -> ${error.message} [code: ${error.code}]`);
      } else {
        const cols = data && data[0] ? Object.keys(data[0]) : "(bảng trống, chưa có dòng mẫu)";
        console.log(`Bảng '${table}': TỒN TẠI (HTTP ${status}) -> Cột:`, cols);
      }
    } catch (e: any) {
      console.log(`Bảng '${table}': NGOẠI LỆ ->`, e.message);
    }
  }

  console.log("\n--- DÒNG MẪU HIỆN CÓ ---");
  const { data: incSample } = await supabase.from("incidents").select("*").limit(1);
  console.log("Incidents sample row:", incSample?.[0]);
  const { data: sheltSample } = await supabase.from("shelters").select("*").limit(1);
  console.log("Shelters sample row:", sheltSample?.[0]);

  console.log("\n--- CHẠY THỬ NGHIỆM CRUD THỰC TẾ TRÊN BẢNG INCIDENTS ---");
  const testId = `TEST-INC-${Date.now()}`;
  try {
    // 1. CREATE
    console.log(`1. INSERT bản ghi test: ${testId}`);
    const insertRes = await supabase.from("incidents").insert({
      id: testId,
      code: testId,
      title: "Sự cố thử nghiệm kiểm tra Supabase CRUD",
      type: "Mưa lớn",
      severity: "Bình thường",
      status: "Đang xử lý",
      location_name: "Khu vực kiểm thử",
      longitude: 105.85,
      latitude: 21.03,
      description: "Bản ghi kiểm thử tự động phục vụ xác minh tích hợp"
    }).select();

    if (insertRes.error) {
      console.log("Lỗi INSERT:", insertRes.error.message, `[code: ${insertRes.error.code}]`);
    } else {
      console.log("INSERT THÀNH CÔNG:", insertRes.data);
    }

    // 2. READ
    console.log(`2. SELECT bản ghi test: ${testId}`);
    const readRes = await supabase.from("incidents").select("*").eq("id", testId);
    if (readRes.error) {
      console.log("Lỗi READ:", readRes.error.message);
    } else {
      console.log("READ THÀNH CÔNG:", readRes.data);
    }

    // 3. UPDATE
    console.log(`3. UPDATE bản ghi test: ${testId}`);
    const updateRes = await supabase.from("incidents").update({
      description: "Đã cập nhật mô tả kiểm thử thành công"
    }).eq("id", testId).select();

    if (updateRes.error) {
      console.log("Lỗi UPDATE:", updateRes.error.message);
    } else {
      console.log("UPDATE THÀNH CÔNG:", updateRes.data);
    }

    // 4. READ AGAIN
    console.log(`4. SELECT lại bản ghi test: ${testId}`);
    const readAgainRes = await supabase.from("incidents").select("*").eq("id", testId);
    console.log("Dữ liệu sau update:", readAgainRes.data);

    // 5. DELETE
    console.log(`5. DELETE bản ghi test: ${testId}`);
    const deleteRes = await supabase.from("incidents").delete().eq("id", testId);
    if (deleteRes.error) {
      console.log("Lỗi DELETE:", deleteRes.error.message);
    } else {
      console.log("DELETE THÀNH CÔNG");
    }

    // 6. VERIFY DELETED
    const verifyDel = await supabase.from("incidents").select("*").eq("id", testId);
    console.log("Kiểm tra sau xóa (phải là 0):", verifyDel.data?.length);

  } catch (err: any) {
    console.error("Ngoại lệ khi thực hiện CRUD:", err);
  }
}

runVerification();
