import type { AuthUser } from "../../domain/auth/types";
import type { AiGroundingSnapshot } from "../../domain/ai/types";
import type { Permission } from "../../lib/permissions/permissions";
import { authorize } from "../../lib/security/authorization";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import { calculateFulfillment, isLowStock } from "../../domain/relief/rules";
import { operationalDate, openSos, openTask } from "../../domain/ai/rules";
const allowed = <T>(
  values: T[],
  user: AuthUser | null,
  permission: Permission,
  scope: (value: T) => string,
) =>
  values.filter((value) => authorize(user, permission, scope(value)).allowed);
export function authorizedOperationalSnapshot(
  snapshot: AiGroundingSnapshot,
  user: AuthUser | null,
): AiGroundingSnapshot {
  const incidents = allowed(
    snapshot.incidents,
    user,
    "view",
    (item) => item.location.name,
  );
  const incidentIds = new Set(incidents.map((item) => item.id));
  const tasks = allowed(
    snapshot.tasks,
    user,
    "task_view",
    (item) => item.location,
  );
  const teams = allowed(
    snapshot.teams,
    user,
    "team_view",
    (item) => item.region || item.operatingScope,
  );
  const shelters = allowed(
    snapshot.shelters,
    user,
    "shelter_view",
    (item) => item.administrativeArea,
  );
  const sosRequests = allowed(
    snapshot.sosRequests,
    user,
    "sos_view",
    (item) => item.location.administrativeArea,
  );
  const evacuationOperations = allowed(
    snapshot.evacuationOperations,
    user,
    "evacuation_view",
    (item) => item.sourceArea,
  ).filter((item) => incidentIds.has(item.incidentId));
  const warehouses = allowed(
    snapshot.warehouses,
    user,
    "warehouse_view",
    (item) => item.administrativeArea,
  );
  const warehouseIds = new Set(warehouses.map((item) => item.id));
  const inventory = snapshot.inventory.filter((item) =>
    warehouseIds.has(item.warehouseId),
  );
  const reliefRequests = allowed(
    snapshot.reliefRequests,
    user,
    "relief_view",
    (item) => item.destination,
  );
  const reliefIds = new Set(reliefRequests.map((item) => item.id));
  const reservations = snapshot.reservations.filter(
    (item) =>
      reliefIds.has(item.reliefRequestId) && warehouseIds.has(item.warehouseId),
  );
  const playbooks = allowed(
    snapshot.playbooks,
    user,
    "playbook_view",
    (item) => item.geographicScope,
  );
  const playbookIds = new Set(playbooks.map((item) => item.id));
  const playbookExecutions = snapshot.playbookExecutions.filter(
    (item) =>
      playbookIds.has(item.playbookId) && incidentIds.has(item.incidentId),
  );
  const damageAssessments = allowed(
    snapshot.damageAssessments,
    user,
    "damage_assessment_view",
    (item) => item.geographicScope,
  ).filter((item) => incidentIds.has(item.incidentId));
  const recoveryProjects = allowed(
    snapshot.recoveryProjects,
    user,
    "recovery_project_view",
    (item) => item.geographicScope,
  ).filter((item) => incidentIds.has(item.incidentId));
  return {
    ...snapshot,
    incidents,
    tasks,
    teams,
    shelters,
    sosRequests,
    evacuationOperations,
    warehouses,
    inventory,
    reliefRequests,
    reservations,
    playbooks,
    playbookExecutions,
    damageAssessments,
    recoveryProjects,
  };
}
export function overdueTasks(snapshot: AiGroundingSnapshot, now: Date) {
  return snapshot.tasks
    .filter(
      (item) =>
        openTask(item.status) &&
        Number.isFinite(operationalDate(item.dueAt)) &&
        operationalDate(item.dueAt) < now.getTime(),
    )
    .sort((a, b) => operationalDate(a.dueAt) - operationalDate(b.dueAt));
}
export function availableTeams(snapshot: AiGroundingSnapshot) {
  return snapshot.teams
    .filter(
      (item) =>
        item.status === "Sẵn sàng" &&
        item.availability === "Có thể điều phối" &&
        !item.currentTask &&
        !item.currentEvacuationOperation &&
        !item.currentReliefShipment,
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}
export function urgentUnassignedSos(snapshot: AiGroundingSnapshot) {
  return snapshot.sosRequests
    .filter(
      (item) =>
        item.priority.startsWith("P1") &&
        item.verificationStatus === "Đã xác minh" &&
        !item.assignedTeamId &&
        openSos(item.status),
    )
    .sort((a, b) => b.peopleAtRisk - a.peopleAtRisk);
}
export function pressuredShelters(snapshot: AiGroundingSnapshot) {
  return snapshot.shelters
    .map((shelter) => ({
      shelter,
      capacity: calculateShelterCapacity(shelter),
    }))
    .filter(
      (item) =>
        item.capacity.isNearCapacity ||
        item.capacity.isOverloaded ||
        item.capacity.availableCapacity === 0,
    )
    .sort(
      (a, b) => a.capacity.availableCapacity - b.capacity.availableCapacity,
    );
}
export function reliefShortages(snapshot: AiGroundingSnapshot) {
  return snapshot.reliefRequests
    .flatMap((request) =>
      calculateFulfillment(request, snapshot.reservations)
        .filter((line) => line.shortage > 0)
        .map((line) => ({ request, line })),
    )
    .sort((a, b) => b.line.shortage - a.line.shortage);
}
export function lowStockInventory(snapshot: AiGroundingSnapshot) {
  return snapshot.inventory
    .filter(isLowStock)
    .sort(
      (a, b) =>
        a.quantityOnHand -
        a.quantityReserved -
        (b.quantityOnHand - b.quantityReserved),
    );
}
export function blockedPlaybookSteps(snapshot: AiGroundingSnapshot) {
  return snapshot.playbookExecutions
    .flatMap((execution) =>
      execution.stepExecutions
        .filter((step) => step.status === "Bị chặn")
        .map((step) => ({
          execution,
          step,
          playbook: snapshot.playbooks.find(
            (item) => item.id === execution.playbookId,
          ),
        })),
    )
    .filter((item) => item.playbook);
}
