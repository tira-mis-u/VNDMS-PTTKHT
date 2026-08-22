import type { AuthUser } from "../auth/types";
import type { OperationalAlert } from "../alerts/types";
import type { EvacuationOperation } from "../evacuations/types";
import type { Incident } from "../incidents/types";
import type { Playbook, PlaybookExecution } from "../playbooks/types";
import type { DamageAssessment, RecoveryProject } from "../recovery/types";
import type {
  InventoryItem,
  ReliefRequest,
  StockReservation,
  Warehouse,
} from "../relief/types";
import type { Shelter } from "../shelters/types";
import type { SimulationState } from "../simulation/types";
import type { SosRequest } from "../sos/types";
import type { IncidentTask } from "../tasks/types";
import type { RescueTeam } from "../teams/types";
import type { Permission } from "../../lib/permissions/permissions";

export type AiStatementClass =
  "FACT" | "INFERENCE" | "RECOMMENDATION" | "UNKNOWN";
export type AiIntent =
  | "current_situation"
  | "incident_analysis"
  | "task_analysis"
  | "team_availability"
  | "shelter_capacity"
  | "sos_prioritization"
  | "evacuation_status"
  | "relief_shortage"
  | "recovery_status"
  | "playbook_status"
  | "alert_overview"
  | "operational_exceptions"
  | "recommendation_request"
  | "entity_lookup"
  | "unknown";
export type AiEntityType =
  | "Incident"
  | "Task"
  | "Team"
  | "Shelter"
  | "SOS"
  | "Evacuation"
  | "ReliefRequest"
  | "Warehouse"
  | "Inventory"
  | "Shipment"
  | "OperationalAlert"
  | "Playbook"
  | "PlaybookExecution"
  | "Recovery"
  | "DamageAssessment"
  | "Simulation"
  | "Analytics";
export type AiContext = { entityType?: AiEntityType; entityId?: string };
export interface AiIntentClassification {
  intent: AiIntent;
  confidence: "high" | "medium" | "low";
  entityId?: string;
  clarification?: string;
}
export interface AiEvidence {
  id: string;
  source: string;
  entityType: AiEntityType;
  entityId: string;
  field: string;
  value: string;
  timestamp?: string;
  valueKind: "recorded" | "derived";
}
export interface AiStatement {
  id: string;
  classification: AiStatementClass;
  text: string;
  evidenceIds: string[];
}
export type AiActionType =
  | "ASSIGN_TASK"
  | "DISPATCH_SOS"
  | "START_TASK"
  | "REDIRECT_EVACUATION"
  | "CREATE_TASK";
export interface AiActionProposal {
  id: string;
  type: AiActionType;
  label: string;
  reason: string;
  permission: Permission;
  targetType: AiEntityType;
  targetId: string;
  resourceScope: string;
  affectedResources: string[];
  currentState: string[];
  payload: Record<string, string>;
}
export interface AiResponse {
  id: string;
  question: string;
  intent: AiIntent;
  conclusion: string;
  statements: AiStatement[];
  evidence: AiEvidence[];
  actions: AiActionProposal[];
  simulationAware: boolean;
  simulationNotice?: string;
  clarification?: string;
  generatedAt: string;
}
export interface AiGroundingSnapshot {
  incidents: Incident[];
  tasks: IncidentTask[];
  teams: RescueTeam[];
  shelters: Shelter[];
  evacuationOperations: EvacuationOperation[];
  sosRequests: SosRequest[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  reliefRequests: ReliefRequest[];
  reservations: StockReservation[];
  playbooks: Playbook[];
  playbookExecutions: PlaybookExecution[];
  damageAssessments: DamageAssessment[];
  recoveryProjects: RecoveryProject[];
  simulation: SimulationState;
}
export interface AiGroundingRequest {
  question: string;
  user: AuthUser | null;
  snapshot: AiGroundingSnapshot;
  /**
   * Authorized Alert View hiện tại (đã qua authorization ở provider).
   * AI chỉ đọc; không tự xác nhận hoặc giải quyết cảnh báo.
   */
  alerts?: OperationalAlert[];
  context?: AiContext;
  now?: Date;
}
export interface AiActionRequest {
  proposal: AiActionProposal;
  confirmed: boolean;
  user: AuthUser | null;
  snapshot: AiGroundingSnapshot;
}
export interface AiActionExecutor {
  assignTask: (taskId: string, teamId: string) => void;
  dispatchSos: (sosId: string, teamId: string) => string;
  startTask: (taskId: string) => void;
  redirectEvacuation: (operationId: string, shelterId: string) => void;
  createTask: (input: {
    incidentId: string;
    title: string;
    type: string;
    priority: "Thấp" | "Trung bình" | "Cao" | "Khẩn cấp";
    teamId: string;
    assignee: string;
    location: string;
    dueAt: string;
    description: string;
    coordinates?: [number, number];
  }) => string;
}
export interface AiActionResult {
  status: "confirmation_required" | "executed" | "denied" | "stale" | "failed";
  message: string;
  entityId?: string;
}
