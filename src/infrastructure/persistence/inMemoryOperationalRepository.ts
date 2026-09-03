import type { OperationalSnapshot } from "../../application/operations/operationalSnapshot";
import {
  initialEvents,
  initialIncidents,
  initialTasks,
  initialTaskUpdates,
  initialTeamEvents,
  initialTeams,
  scenarioMetadata,
} from "../../data/scenarios/yagi-2024-national/operationalSeed";
import {
  initialEvacuationEvents,
  initialEvacuationOperations,
  initialShelterEvents,
  initialShelters,
} from "../../data/scenarios/yagi-2024-national/shelterEvacuationSeed";
import {
  initialSosEvents,
  initialSosRequests,
} from "../../data/scenarios/yagi-2024-national/sosSeed";
import {
  initialDamageAssessments,
  initialRecoveryEvents,
  initialRecoveryProjects,
} from "../../data/scenarios/yagi-2024-national/recoverySeed";
import {
  initialPlaybookEvents,
  initialPlaybookExecutions,
  initialPlaybooks,
} from "../../data/scenarios/yagi-2024-national/playbookSeed";
import {
  initialInventory,
  initialReliefEvents,
  initialReliefRequests,
  initialReservations,
  initialShipments,
  initialWarehouses,
} from "../../data/scenarios/yagi-2024-national/reliefSeed";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const inMemoryOperationalRepository = {
  load(): OperationalSnapshot {
    return clone({
      metadata: {
        scenarioId: scenarioMetadata.id,
        scenarioName: scenarioMetadata.name,
        asOf: scenarioMetadata.referenceTime,
        source: "Kịch bản dữ liệu vận hành xác định trước",
      },
      incidents: initialIncidents,
      events: initialEvents,
      tasks: initialTasks,
      taskUpdates: initialTaskUpdates,
      teams: initialTeams,
      teamEvents: initialTeamEvents,
      shelters: initialShelters,
      shelterEvents: initialShelterEvents,
      evacuationOperations: initialEvacuationOperations,
      evacuationEvents: initialEvacuationEvents,
      sosRequests: initialSosRequests,
      sosEvents: initialSosEvents,
      warehouses: initialWarehouses,
      inventory: initialInventory,
      reliefRequests: initialReliefRequests,
      reservations: initialReservations,
      shipments: initialShipments,
      reliefEvents: initialReliefEvents,
      playbooks: initialPlaybooks,
      playbookExecutions: initialPlaybookExecutions,
      playbookEvents: initialPlaybookEvents,
      damageAssessments: initialDamageAssessments,
      recoveryProjects: initialRecoveryProjects,
      recoveryEvents: initialRecoveryEvents,
      alertInteractions: [],
      alertEvents: [],
    });
  },
};
