import { supabase } from "../src/infrastructure/supabase/supabaseClient";
import { supabaseOperationalRepository } from "../src/infrastructure/persistence/supabaseOperationalRepository";
import {
  initialIncidents,
  initialTeams,
  initialTasks,
} from "../src/data/scenarios/yagi-2024-national/operationalSeed";
import { initialShelters } from "../src/data/scenarios/yagi-2024-national/shelterSeed";
import { initialSosRequests } from "../src/data/scenarios/yagi-2024-national/sosSeed";
import { initialPublishedAlerts } from "../src/data/scenarios/yagi-2024-national/publishedAlertSeed";

async function main() {
  console.log("Signing in as admin thuantq@vndms.gov.vn...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "thuantq@vndms.gov.vn",
    password: "VNDMS@2026",
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    process.exit(1);
  }
  console.log("Authenticated as:", authData.user?.id);

  console.log(`\n1. Upserting ${initialIncidents.length} incidents...`);
  for (const inc of initialIncidents) {
    try {
      await supabaseOperationalRepository.saveIncident(inc);
      console.log(`  + Incident ${inc.code}: OK`);
    } catch (err: any) {
      console.error(`  - Incident ${inc.code} failed:`, err.message);
    }
  }

  console.log(`\n2. Upserting ${initialTeams.length} teams...`);
  for (const team of initialTeams) {
    try {
      await supabaseOperationalRepository.saveTeam(team);
      console.log(`  + Team ${team.code}: OK`);
    } catch (err: any) {
      console.error(`  - Team ${team.code} failed:`, err.message);
    }
  }

  console.log(`\n3. Upserting ${initialShelters.length} shelters...`);
  for (const shelter of initialShelters) {
    try {
      await supabaseOperationalRepository.saveShelter(shelter);
      console.log(`  + Shelter ${shelter.code}: OK`);
    } catch (err: any) {
      console.error(`  - Shelter ${shelter.code} failed:`, err.message);
    }
  }

  console.log(`\n4. Upserting ${initialTasks.length} tasks...`);
  for (const task of initialTasks) {
    try {
      await supabaseOperationalRepository.saveTask(task);
      console.log(`  + Task ${task.id}: OK`);
    } catch (err: any) {
      console.error(`  - Task ${task.id} failed:`, err.message);
    }
  }

  console.log(`\n5. Upserting ${initialSosRequests.length} SOS requests...`);
  for (const sos of initialSosRequests) {
    try {
      await supabaseOperationalRepository.saveSosRequest(sos);
      console.log(`  + SOS ${sos.code}: OK`);
    } catch (err: any) {
      console.error(`  - SOS ${sos.code} failed:`, err.message);
    }
  }

  console.log(`\n6. Upserting ${initialPublishedAlerts.length} published alerts...`);
  for (const alert of initialPublishedAlerts) {
    try {
      await supabaseOperationalRepository.savePublishedAlert(alert);
      console.log(`  + Alert ${alert.code}: OK`);
    } catch (err: any) {
      console.error(`  - Alert ${alert.code} failed:`, err.message);
    }
  }

  console.log("\nDone! Querying snapshot from supabaseOperationalRepository...");
  const snapshot = await supabaseOperationalRepository.load();
  console.log("Snapshot counts:", {
    incidents: snapshot.incidents.length,
    teams: snapshot.teams.length,
    shelters: snapshot.shelters.length,
    tasks: snapshot.tasks.length,
    sosRequests: snapshot.sosRequests.length,
    publishedAlerts: snapshot.publishedAlerts.length,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
