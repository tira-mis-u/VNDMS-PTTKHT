/**
 * Chạy migration SQL lên Supabase thông qua Supabase Admin REST API (service role key).
 * 
 * Supabase không cung cấp endpoint thực thi SQL tuỳ ý qua anon/user key nên
 * script này dùng Supabase CLI connection string (postgres trực tiếp) nếu có,
 * hoặc hướng dẫn người dùng dán vào SQL Editor trên Dashboard.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envContent = fs.readFileSync(".env", "utf-8");
const url = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() ?? "";
const key = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() ?? "";

const supabase = createClient(url, key);

const MIGRATION_SQL = fs.readFileSync(
  path.join("supabase", "migrations", "20261029_create_duty_and_audit_tables.sql"),
  "utf-8"
);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "thuantq@vndms.gov.vn",
    password: "VNDMS@2026",
  });
  if (authErr) {
    console.error("❌ Auth failed:", authErr.message);
    process.exit(1);
  }
  console.log("✓ Authenticated as:", auth.user?.email);

  // Thử chạy từng câu SQL riêng biệt qua RPC nếu có
  // Supabase REST không hỗ trợ raw SQL qua anon key nên kiểm tra bảng
  const { error: e1 } = await supabase.from("duty_logs").select("id").limit(1);
  const { error: e2 } = await supabase.from("security_audit_logs").select("id").limit(1);
  
  const need1 = e1?.code === "PGRST205";
  const need2 = e2?.code === "PGRST205";

  if (!need1 && !need2) {
    console.log("✅ Cả 2 bảng đã tồn tại. Không cần migration.");
    process.exit(0);
  }

  console.log("\n⚠️  Cần chạy migration SQL trên Supabase Dashboard:");
  console.log("   URL: https://supabase.com/dashboard/project/wazokfndjvrxfbhjpcub/sql/new");
  console.log("\n=== NỘI DUNG SQL CẦN CHẠY ===\n");
  console.log(MIGRATION_SQL);
  
  process.exit(2);
}

run();
