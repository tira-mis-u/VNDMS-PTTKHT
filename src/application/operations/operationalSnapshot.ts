import type { Incident, IncidentEvent } from "../../domain/incidents/types";
import type { IncidentTask, TaskUpdate } from "../../domain/tasks/types";
import type { RescueTeam, TeamEvent } from "../../domain/teams/types";
import type { Shelter, ShelterEvent } from "../../domain/shelters/types";
import type {
  EvacuationEvent,
  EvacuationOperation,
} from "../../domain/evacuations/types";
import type { SosEvent, SosRequest } from "../../domain/sos/types";
import type {
  DamageAssessment,
  RecoveryEvent,
  RecoveryProject,
} from "../../domain/recovery/types";
import type {
  Playbook,
  PlaybookExecution,
  PlaybookTimelineEvent,
} from "../../domain/playbooks/types";
import type {
  DistributionShipment,
  InventoryItem,
  ReliefEvent,
  ReliefRequest,
  StockReservation,
  Warehouse,
} from "../../domain/relief/types";
import type {
  AlertEvent,
  AlertInteraction,
} from "../../domain/alerts/types";

export interface OperationalSnapshot {
  incidents: Incident[];
  events: IncidentEvent[];
  tasks: IncidentTask[];
  taskUpdates: TaskUpdate[];
  teams: RescueTeam[];
  teamEvents: TeamEvent[];
  shelters: Shelter[];
  shelterEvents: ShelterEvent[];
  evacuationOperations: EvacuationOperation[];
  evacuationEvents: EvacuationEvent[];
  sosRequests: SosRequest[];
  sosEvents: SosEvent[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  reliefRequests: ReliefRequest[];
  reservations: StockReservation[];
  shipments: DistributionShipment[];
  reliefEvents: ReliefEvent[];
  playbooks: Playbook[];
  playbookExecutions: PlaybookExecution[];
  playbookEvents: PlaybookTimelineEvent[];
  damageAssessments: DamageAssessment[];
  recoveryProjects: RecoveryProject[];
  recoveryEvents: RecoveryEvent[];
  alertInteractions: AlertInteraction[];
  alertEvents: AlertEvent[];
}
