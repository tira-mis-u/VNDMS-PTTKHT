import { supabase } from "../src/infrastructure/supabase/supabaseClient";
import { supabaseOperationalRepository } from "../src/infrastructure/persistence/supabaseOperationalRepository";
import {
  initialTeams,
  initialTasks,
} from "../src/data/scenarios/yagi-2024-national/operationalSeed";

async function main() {
  console.log("=== ĐẨY DỮ LIỆU ĐỘI CỨU HỘ & NHIỆM VỤ LÊN SUPABASE CLOUD ===");

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "thuantq@vndms.gov.vn",
    password: "VNDMS@2026",
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    process.exit(1);
  }
  console.log("✓ Đã đăng nhập quản trị viên:", auth.user?.email);

  console.log(`\n1. Cập nhật ${initialTeams.length} đội cứu hộ (trong đó có 6 đội mới SẴN SÀNG)...`);
  for (const team of initialTeams) {
    try {
      await supabaseOperationalRepository.saveTeam(team);
      console.log(`  + Đội ${team.id} (${team.name}) - [${team.status}]: OK`);
    } catch (err: any) {
      console.error(`  - Đội ${team.id} lỗi:`, err.message);
    }
  }

  console.log(`\n2. Cập nhật ${initialTasks.length} nhiệm vụ (trong đó có 10 nhiệm vụ CHỜ GIAO)...`);
  for (const task of initialTasks) {
    try {
      await supabaseOperationalRepository.saveTask(task);
      console.log(`  + Nhiệm vụ ${task.id} (${task.title}) - [${task.status}]: OK`);
    } catch (err: any) {
      console.error(`  - Nhiệm vụ ${task.id} lỗi:`, err.message);
    }
  }

  console.log("\n✅ Hoàn tất đồng bộ dữ liệu tác nghiệp lên Cloud!\n");
}

main();

