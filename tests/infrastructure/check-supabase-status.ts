import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const url = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim() ?? "";
const key = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim() ?? "";

const supabase = createClient(url, key);

async function check() {
  console.log("Checking Supabase Cloud Tables at:", url);
  const tables = [
    "incidents",
    "shelters",
    "sos_requests",
    "profiles",
    "tasks",
    "teams",
    "citizen_reports",
    "published_alerts",
    "task_reviews",
    "task_updates",
  ];

  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`- ${table}: ❌ ${error.code} - ${error.message}`);
    } else {
      console.log(`- ${table}: ✅ Ready (count: ${count ?? 0})`);
    }
  }

  // Check auth user status
  const { data: authData } = await supabase.auth.getSession();
  console.log("- Auth session active:", !!authData?.session);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
