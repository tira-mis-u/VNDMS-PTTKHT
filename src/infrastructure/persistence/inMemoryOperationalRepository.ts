import type { OperationalSnapshot } from "../../application/operations/operationalSnapshot";
import {
  initialEvents,
  initialIncidents,
  initialTasks,
  initialTaskUpdates,
  initialTeamEvents,
  initialTeams,
} from "../../data/scenarios/red-river-flood/operationalSeed";
import {
  initialEvacuationEvents,
  initialEvacuationOperations,
  initialShelterEvents,
  initialShelters,
} from "../../data/scenarios/red-river-flood/shelterEvacuationSeed";
import {
  initialSosEvents,
  initialSosRequests,
} from "../../data/scenarios/red-river-flood/sosSeed";
import {
  initialDamageAssessments,
  initialRecoveryEvents,
  initialRecoveryProjects,
} from "../../data/scenarios/red-river-flood/recoverySeed";
import {
  initialPlaybookEvents,
  initialPlaybookExecutions,
  initialPlaybooks,
} from "../../data/scenarios/red-river-flood/playbookSeed";
import {
  initialInventory,
  initialReliefEvents,
  initialReliefRequests,
  initialReservations,
  initialShipments,
  initialWarehouses,
} from "../../data/scenarios/red-river-flood/reliefSeed";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const inMemoryOperationalRepository = {
  load(): OperationalSnapshot {
    return clone({
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
