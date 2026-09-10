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
  initialShelterEvents,
  initialShelters,
} from "../../data/scenarios/yagi-2024-national/shelterSeed";
import {
  initialSosEvents,
  initialSosRequests,
} from "../../data/scenarios/yagi-2024-national/sosSeed";
import { initialPublishedAlerts } from "../../data/scenarios/yagi-2024-national/publishedAlertSeed";

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
      taskReviews: [],
      teams: initialTeams,
      teamEvents: initialTeamEvents,
      shelters: initialShelters,
      shelterEvents: initialShelterEvents,
      sosRequests: initialSosRequests,
      sosEvents: initialSosEvents,
      citizenReports: [],
      citizenReportEvents: [],
      publishedAlerts: initialPublishedAlerts,
      publishedAlertEvents: [],
      alertInteractions: [],
      alertEvents: [],
    });
  },
};
