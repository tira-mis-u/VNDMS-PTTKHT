import { supabase, isExplicitDemoMode, isSupabaseConfigured } from "../supabase/supabaseClient";
import type { IOperationalRepository } from "./operationalRepositoryContracts";
import { createEmptyOperationalSnapshot, type OperationalSnapshot } from "../../application/operations/operationalSnapshot";
import { inMemoryOperationalRepository } from "./inMemoryOperationalRepository";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask, TaskReview, TaskUpdate } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { SosRequest } from "@/domain/sos/types";
import type { CitizenReport } from "@/domain/reports/types";
import type { PublishedAlert } from "@/domain/published-alerts/types";

// ==============================================================================
// TYPE MAPPINGS (DB ROWS <-> DOMAIN ENTITIES)
// ==============================================================================

export function incidentToRow(incident: Incident): Record<string, unknown> {
  return {
    id: incident.id,
    code: incident.code,
    title: incident.title,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    location_name: incident.location.name,
    latitude: incident.location.coordinates[1],
    longitude: incident.location.coordinates[0],
    affected_population: incident.affectedPopulation,
    affected_households: incident.affectedHouseholds,
    affected_buildings: incident.affectedBuildings,
    affected_roads: incident.affectedRoads,
    flood_depth: incident.floodDepth,
    area_hectares: incident.areaHectares,
    assigned_team_id: incident.assignedTeamId,
    lead: incident.lead,
    progress: incident.progress,
    created_at: incident.createdAt,
    updated_at: incident.updatedAt,
    created_by: incident.createdBy,
    closed_at: incident.closedAt,
    source: incident.source,
    description: incident.description,
  };
}

export function incidentToBaselineRow(incident: Incident): Record<string, unknown> {
  return {
    id: incident.id,
    code: incident.code,
    title: incident.title,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    location_name: incident.location.name,
    latitude: incident.location.coordinates[1],
    longitude: incident.location.coordinates[0],
    affected_population: incident.affectedPopulation,
    affected_households: incident.affectedHouseholds,
    description: incident.description,
  };
}

export function rowToIncident(row: any): Incident {
  return {
    id: row.id,
    code: row.code ?? row.id,
    title: row.title ?? "",
    type: row.type ?? "Khác",
    severity: row.severity ?? "Cao",
    status: row.status ?? "Đang xử lý",
    location: {
      name: row.location_name ?? "Chưa xác định",
      coordinates: [row.longitude ?? 105.84, row.latitude ?? 21.03],
    },
    affectedArea: row.location_name ?? "",
    affectedPopulation: row.affected_population ?? 0,
    affectedHouseholds: row.affected_households ?? 0,
    affectedBuildings: row.affected_buildings ?? 0,
    affectedRoads: row.affected_roads ?? 0,
    floodDepth: row.flood_depth ?? "0m",
    areaHectares: row.area_hectares ?? 0,
    assignedTeamId: row.assigned_team_id ?? null,
    lead: row.lead ?? "Chỉ huy trưởng",
    progress: row.progress ?? 0,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    createdBy: row.created_by ?? "Hệ thống",
    closedAt: row.closed_at ?? null,
    source: row.source ?? "Trung tâm chỉ huy",
    description: row.description ?? "",
  };
}

export function shelterToRow(shelter: Shelter): Record<string, unknown> {
  return {
    id: shelter.id,
    code: shelter.code,
    name: shelter.name,
    type: shelter.type,
    address: shelter.address,
    latitude: shelter.coordinates[1],
    longitude: shelter.coordinates[0],
    capacity: shelter.capacity,
    current_occupancy: shelter.currentOccupancy,
    reserved_capacity: shelter.reservedCapacity,
    status: shelter.status,
    readiness: shelter.readiness,
    accessibility: shelter.accessibility,
    responsible_officer: shelter.responsibleOfficer,
    contact: shelter.contact,
    facilities: shelter.facilities,
    medical_capability: shelter.medicalCapability,
    water_availability: shelter.waterAvailability,
    food_availability: shelter.foodAvailability,
    power_availability: shelter.powerAvailability,
    sanitation_status: shelter.sanitationStatus,
    accessible_for_vulnerable_people: shelter.accessibleForVulnerablePeople,
    opening_time: shelter.openingTime,
    closing_time: shelter.closingTime,
    linked_incident_ids: shelter.linkedIncidentIds,
    active_evacuation_operation_ids: shelter.activeEvacuationOperationIds ?? [],
    notes: shelter.notes,
    updated_at: shelter.updatedAt,
  };
}

export function shelterToBaselineRow(shelter: Shelter): Record<string, unknown> {
  return {
    id: shelter.id,
    code: shelter.code,
    name: shelter.name,
    type: shelter.type,
    address: shelter.address,
    latitude: shelter.coordinates[1],
    longitude: shelter.coordinates[0],
    capacity: shelter.capacity,
    current_occupancy: shelter.currentOccupancy,
    status: shelter.status,
  };
}

export function rowToShelter(row: any): Shelter {
  return {
    id: row.id,
    code: row.code ?? row.id,
    name: row.name ?? "",
    type: row.type ?? "Nhà văn hóa",
    address: row.address ?? "",
    administrativeArea: row.address ?? "",
    coordinates: [row.longitude ?? 105.84, row.latitude ?? 21.03],
    capacity: row.capacity ?? 100,
    currentOccupancy: row.current_occupancy ?? 0,
    reservedCapacity: row.reserved_capacity ?? 0,
    status: row.status ?? "Đang tiếp nhận",
    readiness: row.readiness ?? "Sẵn sàng",
    accessibility: row.accessibility ?? "Tiếp cận bình thường",
    responsibleOfficer: row.responsible_officer ?? { name: "Cán bộ phụ trách", role: "Trưởng điểm", organization: "UBND", phone: "0900000000" },
    contact: row.contact ?? "112",
    facilities: Array.isArray(row.facilities) ? row.facilities : [],
    medicalCapability: row.medical_capability ?? "Sơ cứu cơ bản",
    waterAvailability: row.water_availability ?? "Đầy đủ",
    foodAvailability: row.food_availability ?? "Đầy đủ",
    powerAvailability: row.power_availability ?? "Đầy đủ",
    sanitationStatus: row.sanitation_status ?? "Đầy đủ",
    accessibleForVulnerablePeople: row.accessible_for_vulnerable_people ?? true,
    openingTime: row.opening_time ?? null,
    closingTime: row.closing_time ?? null,
    linkedIncidentIds: Array.isArray(row.linked_incident_ids) ? row.linked_incident_ids : [],
    activeEvacuationOperationIds: Array.isArray(row.active_evacuation_operation_ids) ? row.active_evacuation_operation_ids : [],
    notes: row.notes ?? "",
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export function sosToRow(sos: SosRequest): Record<string, unknown> {
  return {
    id: sos.id,
    code: sos.code,
    phone: sos.reporter.contact || "112",
    description: sos.description,
    severity: sos.priority === "P1 — Khẩn cấp" ? "Khẩn cấp" : "Đáng chú ý",
    status: sos.status,
    address: sos.location.address || sos.location.name,
    latitude: sos.location.coordinates[1],
    longitude: sos.location.coordinates[0],
    people_count: sos.peopleAtRisk,
    has_elderly_or_children: (sos.childrenCount > 0 || sos.elderlyCount > 0),
    owner_user_id: sos.ownerUserId,
    gps_captured: sos.gpsCaptured ?? false,
    priority: sos.priority,
    reporter: sos.reporter,
    location: sos.location,
    affected_people: sos.affectedPeople,
    people_at_risk: sos.peopleAtRisk,
    injured_count: sos.injuredCount,
    missing_count: sos.missingCount,
    children_count: sos.childrenCount,
    elderly_count: sos.elderlyCount,
    disabled_count: sos.disabledCount,
    verification_status: sos.verificationStatus,
    resolution_note: sos.resolutionSummary ?? null,
    resolved_at: sos.closedAt ?? null,
    updated_at: sos.lastUpdatedAt ?? new Date().toISOString(),
  };
}

export function rowToSos(row: any): SosRequest {
  const loc = row.location ?? {
    name: row.address ?? "Hiện trường",
    address: row.address ?? "Hà Nội",
    administrativeArea: "Hà Nội",
    coordinates: [row.longitude ?? 105.84, row.latitude ?? 21.03],
    accessCondition: "Tiếp cận bình thường",
    floodDepth: "0m",
  };
  return {
    id: row.id,
    code: row.code ?? row.id,
    ownerUserId: row.owner_user_id ?? null,
    gpsCaptured: row.gps_captured ?? false,
    receivedAt: row.created_at ?? new Date().toISOString(),
    reporter: row.reporter ?? { name: "Người dân", contact: row.phone ?? "112", source: "Người dân" },
    location: {
      ...loc,
      coordinates: loc.coordinates ?? [row.longitude ?? 105.84, row.latitude ?? 21.03],
    },
    description: row.description ?? "",
    affectedPeople: Array.isArray(row.affected_people) ? row.affected_people : [],
    peopleAtRisk: row.people_at_risk ?? row.people_count ?? 1,
    injuredCount: row.injured_count ?? 0,
    missingCount: row.missing_count ?? 0,
    childrenCount: row.children_count ?? 0,
    elderlyCount: row.elderly_count ?? 0,
    disabledCount: row.disabled_count ?? 0,
    severity: row.severity ?? "Đáng chú ý",
    priority: row.priority ?? "P1 — Khẩn cấp",
    triageReasons: Array.isArray(row.triage_reasons) ? row.triage_reasons : [],
    status: row.status ?? "Mới tiếp nhận",
    verificationStatus: row.verification_status ?? "Chưa xác minh",
    linkedIncidentId: row.linked_incident_id ?? null,
    assignedTeamId: row.assigned_team_id ?? null,
    linkedTaskId: row.linked_task_id ?? null,
    shelterDestinationId: row.shelter_destination_id ?? null,
    communicationStatus: row.communication_status ?? "Kết nối",
    lastContactAt: row.last_contact_at ?? row.updated_at ?? new Date().toISOString(),
    lastUpdatedAt: row.updated_at ?? new Date().toISOString(),
    resolutionSummary: row.resolution_note ?? null,
    closedAt: row.resolved_at ?? null,
  };
}

export function taskToRow(task: IncidentTask): Record<string, unknown> {
  return {
    id: task.id,
    incident_id: task.incidentId,
    title: task.title,
    type: task.type,
    priority: task.priority,
    team_id: task.teamId || null,
    team_leader: task.teamLeader,
    assignee: task.assignee,
    location: task.location,
    latitude: task.coordinates[1],
    longitude: task.coordinates[0],
    due_at: task.dueAt,
    description: task.description,
    status: task.status,
    progress: task.progress,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
    assignment_history: task.assignmentHistory ?? [],
  };
}

export function rowToTask(row: any): IncidentTask {
  return {
    id: row.id,
    incidentId: row.incident_id,
    title: row.title ?? "",
    type: row.type ?? "Cứu hộ",
    priority: row.priority ?? "Trung bình",
    teamId: row.team_id ?? "",
    teamLeader: row.team_leader ?? "",
    assignee: row.assignee ?? "",
    location: row.location ?? "",
    coordinates: [row.longitude ?? 105.84, row.latitude ?? 21.03],
    dueAt: row.due_at ?? "",
    description: row.description ?? "",
    status: row.status ?? "Chờ giao",
    progress: row.progress ?? 0,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    completedAt: row.completed_at ?? null,
    assignmentHistory: Array.isArray(row.assignment_history) ? row.assignment_history : [],
  };
}

export function teamToRow(team: RescueTeam): Record<string, unknown> {
  return {
    id: team.id,
    code: team.code,
    name: team.name,
    type: team.type,
    status: team.status,
    leader: team.leader,
    members: team.members,
    personnel: team.personnel,
    capabilities: team.capabilities,
    capability: team.capability,
    vehicles: team.vehicles,
    current_task: team.currentTask,
    current_incident: team.currentIncident,
    latitude: team.coordinates[1],
    longitude: team.coordinates[0],
    last_location_update: team.lastLocationUpdate,
    last_operational_update: team.lastOperationalUpdate,
    communication_status: team.communicationStatus,
    availability: team.availability,
    region: team.region,
    operating_scope: team.operatingScope,
    contact: team.contact,
    notes: team.notes,
    distance: team.distance,
    created_at: team.createdAt,
    updated_at: team.updatedAt,
  };
}

export function rowToTeam(row: any): RescueTeam {
  const coords: [number, number] = [row.longitude ?? 105.84, row.latitude ?? 21.03];
  return {
    id: row.id,
    code: row.code ?? row.id,
    name: row.name ?? "",
    type: row.type ?? "Cứu nạn",
    status: row.status ?? "Sẵn sàng",
    leader: row.leader ?? "Đội trưởng",
    members: row.members ?? 10,
    personnel: Array.isArray(row.personnel) ? row.personnel : [],
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    capability: row.capability ?? "Cứu hộ",
    vehicles: Array.isArray(row.vehicles) ? row.vehicles : [],
    currentTask: row.current_task ?? null,
    currentIncident: row.current_incident ?? null,
    location: {
      latitude: coords[1],
      longitude: coords[0],
      accuracy: 10,
      timestamp: row.last_location_update ?? new Date().toISOString(),
      source: "Thiết bị di động",
      communicationStatus: row.communication_status ?? "Kết nối",
    },
    coordinates: coords,
    lastLocationUpdate: row.last_location_update ?? new Date().toISOString(),
    lastOperationalUpdate: row.last_operational_update ?? new Date().toISOString(),
    communicationStatus: row.communication_status ?? "Kết nối",
    availability: row.availability ?? "Có thể điều phối",
    region: row.region ?? "Toàn quốc",
    operatingScope: row.operating_scope ?? "Toàn quốc",
    contact: row.contact ?? "112",
    notes: row.notes ?? "",
    distance: row.distance ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export function citizenReportToRow(report: CitizenReport): Record<string, unknown> {
  return {
    id: report.id,
    code: report.code,
    owner_user_id: report.ownerUserId,
    reporter_name: report.reporterName,
    contact: report.contact,
    category: report.category,
    description: report.description,
    address: report.location.address,
    administrative_area: report.location.administrativeArea,
    latitude: report.location.coordinates ? report.location.coordinates[1] : null,
    longitude: report.location.coordinates ? report.location.coordinates[0] : null,
    status: report.status,
    review_note: report.reviewNote,
    reviewed_by: report.reviewedBy,
    reviewed_at: report.reviewedAt,
    duplicate_of_id: report.duplicateOfId,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  };
}

export function rowToCitizenReport(row: any): CitizenReport {
  return {
    id: row.id,
    code: row.code ?? row.id,
    ownerUserId: row.owner_user_id,
    reporterName: row.reporter_name ?? "Người dân",
    contact: row.contact ?? "",
    category: row.category ?? "Khác",
    description: row.description ?? "",
    location: {
      address: row.address ?? "",
      administrativeArea: row.administrative_area ?? "",
      coordinates: (row.latitude !== null && row.longitude !== null && row.latitude !== undefined)
        ? [row.longitude, row.latitude]
        : null,
    },
    status: row.status ?? "Mới",
    reviewNote: row.review_note ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ?? null,
    duplicateOfId: row.duplicate_of_id ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export function publishedAlertToRow(alert: PublishedAlert): Record<string, unknown> {
  return {
    id: alert.id,
    code: alert.code,
    title: alert.title,
    content: alert.content,
    severity: alert.severity,
    area_name: alert.areaName,
    status: alert.status,
    revision: alert.revision,
    created_by: alert.createdBy,
    published_at: alert.publishedAt,
    withdrawn_at: alert.withdrawnAt,
    created_at: alert.createdAt,
    updated_at: alert.updatedAt,
  };
}

export function rowToPublishedAlert(row: any): PublishedAlert {
  return {
    id: row.id,
    code: row.code ?? row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    severity: row.severity ?? "Cảnh báo",
    areaName: row.area_name ?? "Toàn quốc",
    status: row.status ?? "Đã công bố",
    revision: row.revision ?? 1,
    createdBy: row.created_by ?? "Cán bộ PCTT",
    createdAt: row.created_at ?? new Date().toISOString(),
    publishedAt: row.published_at ?? null,
    withdrawnAt: row.withdrawn_at ?? null,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

// ==============================================================================
// REPOSITORY IMPLEMENTATION
// ==============================================================================

export class SupabaseOperationalRepository implements IOperationalRepository {
  async load(): Promise<OperationalSnapshot> {
    const fallback = inMemoryOperationalRepository.load();
    if (!isSupabaseConfigured || !supabase) {
      if (!isExplicitDemoMode) {
        throw new Error("Supabase chưa được cấu hình. Chỉ chế độ demo được bật rõ ràng mới dùng dữ liệu cục bộ.");
      }
      return fallback;
    }

    try {
      // Tải các thực thể song song từ Supabase
      const [
        incidentsRes,
        sheltersRes,
        sosRes,
        tasksRes,
        teamsRes,
        reportsRes,
        alertsRes,
        taskReviewsRes,
      ] = await Promise.all([
        supabase.from("incidents").select("*").order("created_at", { ascending: false }),
        supabase.from("shelters").select("*").order("created_at", { ascending: false }),
        supabase.from("sos_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("teams").select("*").order("created_at", { ascending: false }),
        supabase.from("citizen_reports").select("*").order("created_at", { ascending: false }),
        supabase.from("published_alerts").select("*").order("created_at", { ascending: false }),
        supabase.from("task_reviews").select("*").order("created_at", { ascending: false }),
      ]);

      const failedTables: string[] = [];
      if (incidentsRes.error) failedTables.push(`incidents (${incidentsRes.error.message})`);
      if (sheltersRes.error) failedTables.push(`shelters (${sheltersRes.error.message})`);
      if (sosRes.error) failedTables.push(`sos_requests (${sosRes.error.message})`);
      if (tasksRes.error) failedTables.push(`tasks (${tasksRes.error.message})`);
      if (teamsRes.error) failedTables.push(`teams (${teamsRes.error.message})`);
      if (reportsRes.error) failedTables.push(`citizen_reports (${reportsRes.error.message})`);
      if (alertsRes.error) failedTables.push(`published_alerts (${alertsRes.error.message})`);
      if (taskReviewsRes.error) failedTables.push(`task_reviews (${taskReviewsRes.error.message})`);

      if (failedTables.length > 0) {
        throw new Error(`Supabase Cloud không sẵn sàng: ${failedTables.join("; ")}`);
      }

      const incidents = (!incidentsRes.error && incidentsRes.data)
        ? incidentsRes.data.map(rowToIncident)
        : isExplicitDemoMode ? fallback.incidents : [];

      const shelters = (!sheltersRes.error && sheltersRes.data)
        ? sheltersRes.data.map(rowToShelter)
        : isExplicitDemoMode ? fallback.shelters : [];

      const sosRequests = (!sosRes.error && sosRes.data)
        ? sosRes.data.map(rowToSos)
        : isExplicitDemoMode ? fallback.sosRequests : [];

      const tasks = (!tasksRes.error && tasksRes.data)
        ? tasksRes.data.map(rowToTask)
        : isExplicitDemoMode ? fallback.tasks : [];

      const teams = (!teamsRes.error && teamsRes.data)
        ? teamsRes.data.map(rowToTeam)
        : isExplicitDemoMode ? fallback.teams : [];

      const citizenReports = (!reportsRes.error && reportsRes.data)
        ? reportsRes.data.map(rowToCitizenReport)
        : isExplicitDemoMode ? fallback.citizenReports : [];

      const publishedAlerts = (!alertsRes.error && alertsRes.data)
        ? alertsRes.data.map(rowToPublishedAlert)
        : isExplicitDemoMode ? fallback.publishedAlerts : [];

      const taskReviews = (!taskReviewsRes.error && taskReviewsRes.data)
        ? taskReviewsRes.data.map((r: any): TaskReview => ({
            id: r.id,
            taskId: r.task_id,
            incidentId: r.incident_id,
            reportedBy: r.reported_by,
            reportedAt: r.reported_at,
            reportNote: r.report_note,
            decision: r.decision,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            reviewNote: r.review_note,
          }))
        : isExplicitDemoMode ? fallback.taskReviews : [];

      const baseSnapshot = isExplicitDemoMode ? fallback : createEmptyOperationalSnapshot();

      return {
        ...baseSnapshot,
        metadata: {
          ...baseSnapshot.metadata,
          source: "Supabase Cloud Database (Live)",
        },
        incidents,
        shelters,
        sosRequests,
        tasks,
        teams,
        citizenReports,
        publishedAlerts,
        taskReviews,
      };
    } catch (err: any) {
      console.warn("[VNDMS/Supabase] Không thể nạp dữ liệu Cloud:", err?.message);
      if (!isExplicitDemoMode) {
        throw err;
      }
      return fallback;
    }
  }

  async saveIncident(incident: Incident): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = incidentToRow(incident);
    const { error } = await supabase.from("incidents").upsert(row, { onConflict: "id" });
    if (error) {
      if (error.code === "PGRST204") {
        // CSDL chưa chạy migration mở rộng cột; lưu các cột cơ sở hiện có
        const baseRow = incidentToBaselineRow(incident);
        const retryRes = await supabase.from("incidents").upsert(baseRow, { onConflict: "id" });
        if (retryRes.error) {
          console.error("[VNDMS/Supabase] Lỗi lưu sự cố (bản cơ sở):", retryRes.error);
          throw new Error(`[Supabase] Không thể lưu sự cố ${incident.code}: ${retryRes.error.message}`);
        }
        return;
      }
      console.error("[VNDMS/Supabase] Lỗi lưu sự cố:", error);
      throw new Error(`[Supabase] Không thể lưu sự cố ${incident.code}: ${error.message}`);
    }
  }

  async saveShelter(shelter: Shelter): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = shelterToRow(shelter);
    const { error } = await supabase.from("shelters").upsert(row, { onConflict: "id" });
    if (error) {
      if (error.code === "PGRST204") {
        // CSDL chưa chạy migration mở rộng cột; lưu các cột cơ sở hiện có
        const baseRow = shelterToBaselineRow(shelter);
        const retryRes = await supabase.from("shelters").upsert(baseRow, { onConflict: "id" });
        if (retryRes.error) {
          console.error("[VNDMS/Supabase] Lỗi lưu Shelter (baseline):", retryRes.error);
          throw new Error(`[Supabase] Không thể lưu điểm sơ tán ${shelter.name}: ${retryRes.error.message}`);
        }
        return;
      }
      console.error("[VNDMS/Supabase] Lỗi lưu Shelter:", error);
      throw new Error(`[Supabase] Không thể lưu điểm sơ tán ${shelter.name}: ${error.message}`);
    }
  }

  async saveSosRequest(sos: SosRequest): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = sosToRow(sos);
    const { error } = await supabase.from("sos_requests").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu SOS:", error);
      throw new Error(`[Supabase] Không thể lưu yêu cầu cứu nạn ${sos.code}: ${error.message}`);
    }
  }

  async saveTask(task: IncidentTask): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = taskToRow(task);
    const { error } = await supabase.from("tasks").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu Task:", error);
      throw new Error(`[Supabase] Không thể lưu nhiệm vụ ${task.id}: ${error.message}`);
    }
  }

  async saveTaskReview(review: TaskReview): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = {
      id: review.id,
      task_id: review.taskId,
      incident_id: review.incidentId,
      reported_by: review.reportedBy,
      reported_at: review.reportedAt,
      report_note: review.reportNote,
      decision: review.decision,
      reviewed_by: review.reviewedBy,
      reviewed_at: review.reviewedAt,
      review_note: review.reviewNote,
    };
    const { error } = await supabase.from("task_reviews").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu TaskReview:", error);
      throw new Error(`[Supabase] Không thể lưu đánh giá kết quả: ${error.message}`);
    }
  }

  async saveTaskUpdate(update: TaskUpdate): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = {
      id: update.id,
      task_id: update.taskId,
      incident_id: update.incidentId,
      timestamp: update.timestamp,
      actor: update.actor,
      team_id: update.teamId,
      message: update.message,
      location: update.location ?? null,
      source: update.source,
      network_status: update.networkStatus,
    };
    const { error } = await supabase.from("task_updates").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu TaskUpdate:", error);
      throw new Error(`[Supabase] Không thể lưu cập nhật tiến độ: ${error.message}`);
    }
  }

  async saveTeam(team: RescueTeam): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = teamToRow(team);
    const { error } = await supabase.from("teams").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu Team:", error);
      throw new Error(`[Supabase] Không thể lưu đội cứu hộ ${team.name}: ${error.message}`);
    }
  }

  async saveCitizenReport(report: CitizenReport): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = citizenReportToRow(report);
    const { error } = await supabase.from("citizen_reports").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu CitizenReport:", error);
      throw new Error(`[Supabase] Không thể lưu phản ánh ${report.code}: ${error.message}`);
    }
  }

  async savePublishedAlert(alert: PublishedAlert): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const row = publishedAlertToRow(alert);
    const { error } = await supabase.from("published_alerts").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi lưu PublishedAlert:", error);
      throw new Error(`[Supabase] Không thể lưu bản tin cảnh báo ${alert.title}: ${error.message}`);
    }
  }

  async deleteIncident(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("incidents").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa sự cố:", error);
      throw new Error(`[Supabase] Không thể xóa sự cố ${id}: ${error.message}`);
    }
  }

  async deleteShelter(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("shelters").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa điểm sơ tán:", error);
      throw new Error(`[Supabase] Không thể xóa điểm sơ tán ${id}: ${error.message}`);
    }
  }

  async deleteSosRequest(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("sos_requests").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa SOS:", error);
      throw new Error(`[Supabase] Không thể xóa yêu cầu cứu nạn ${id}: ${error.message}`);
    }
  }

  async deleteTask(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa Task:", error);
      throw new Error(`[Supabase] Không thể xóa nhiệm vụ ${id}: ${error.message}`);
    }
  }

  async deleteTeam(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa Team:", error);
      throw new Error(`[Supabase] Không thể xóa đội ${id}: ${error.message}`);
    }
  }

  async deleteCitizenReport(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("citizen_reports").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa CitizenReport:", error);
      throw new Error(`[Supabase] Không thể xóa phản ánh ${id}: ${error.message}`);
    }
  }

  async deletePublishedAlert(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client chưa được cấu hình.");
    const { error } = await supabase.from("published_alerts").delete().eq("id", id);
    if (error) {
      console.error("[VNDMS/Supabase] Lỗi xóa PublishedAlert:", error);
      throw new Error(`[Supabase] Không thể xóa bản tin cảnh báo ${id}: ${error.message}`);
    }
  }
}

export const supabaseOperationalRepository = new SupabaseOperationalRepository();
