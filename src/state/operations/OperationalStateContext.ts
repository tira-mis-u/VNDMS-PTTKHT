import { createContext, useContext } from "react";
import type { OperationalSnapshot } from "@/application/operations/operationalSnapshot";
import type {
  Incident,
  IncidentEvent,
  IncidentSeverity,
  IncidentStatus,
} from "@/domain/incidents/types";
import type {
  IncidentTask,
  TaskPriority,
  TaskStatus,
  TaskUpdate,
} from "@/domain/tasks/types";
import type {
  RescueTeam,
  TeamEvent,
  TeamLocation,
  TeamStatus,
} from "@/domain/teams/types";
import type { UserRole } from "@/domain/shared/auth";
import type { CreateIncidentInput } from "@/application/incidents/incidentUseCases";
import type { NewTaskInput } from "@/application/tasks/taskUseCases";
import type { TeamProfileInput } from "@/application/teams/teamUseCases";
import type { Permission } from "@/lib/permissions/permissions";
import type { Shelter, ShelterEvent } from "@/domain/shelters/types";
import type {
  EvacuationEvent,
  EvacuationOperation,
  EvacuationStatus,
  RouteStatus,
} from "@/domain/evacuations/types";
import type { ShelterResourceInput } from "@/application/shelters/shelterUseCases";
import type { NewEvacuationInput } from "@/application/evacuations/evacuationUseCases";
import type {
  SosEvent,
  SosLocation,
  SosPriority,
  SosRequest,
} from "@/domain/sos/types";
import type {
  DistributionShipment,
  InventoryItem,
  ReliefEvent,
  ReliefRequest,
  ReliefRequestStatus,
  ShipmentStatus,
  StockReservation,
  Warehouse,
  WarehouseStatus,
} from "@/domain/relief/types";
import type {
  DamageAssessment,
  DamageItem,
  RecoveryEvidence,
  RecoveryEvent,
  RecoveryMilestone,
  RecoveryProject,
} from "@/domain/recovery/types";
import type {
  NewDamageAssessmentInput,
  NewRecoveryProjectInput,
} from "@/application/recovery/recoveryUseCases";
import type {
  Playbook,
  PlaybookExecution,
  PlaybookStep,
  PlaybookStepExecution,
  PlaybookTimelineEvent,
} from "@/domain/playbooks/types";
import type { NewPlaybookInput } from "@/application/playbooks/playbookUseCases";
import type { NewReliefRequestInput } from "@/application/relief/reliefUseCases";
import type {
  SimulationSpeed,
  SimulationState,
} from "@/domain/simulation/types";
import type {
  AuthUser,
  GeographicScope,
  Role,
  SecurityAuditEvent,
  Session,
} from "@/domain/auth/types";
import type {
  AlertEvent,
  AlertInteraction,
  OperationalAlert,
} from "@/domain/alerts/types";

export interface OperationalStore {
  metadata: OperationalSnapshot["metadata"];
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
  /** Read receipt/acknowledgement tối thiểu của alert (canonical snapshot). */
  alertInteractions: AlertInteraction[];
  /** Authorized Alert View — suy ra từ canonical state đã qua lọc quyền. */
  alerts: OperationalAlert[];
  /** Timeline của các alert đang hiển thị với người dùng hiện tại. */
  alertEvents: AlertEvent[];
  simulation: SimulationState;
  session: Session | null;
  currentUser: AuthUser | null;
  users: AuthUser[];
  securityAuditEvents: SecurityAuditEvent[];
  role: UserRole;
  can: (
    permission: Permission,
    resourceScope?: string,
    ownerId?: string,
  ) => boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error: string; user?: AuthUser }>;
  register: (
    input: import("@/domain/auth/types").RegisterInput,
  ) => Promise<{ ok: boolean; error: string; user?: AuthUser }>;
  logout: () => void;
  updateUserActive: (userId: string, active: boolean) => void;
  updateUserRole: (userId: string, role: Role) => void;
  updateUserScope: (userId: string, scope: GeographicScope) => void;
  updateSelfProfile: (input: {
    displayName?: string;
    geographicScope?: GeographicScope;
    organization?: string;
  }) => void;
  createIncident: (data: CreateIncidentInput) => string;
  updateStatus: (id: string, status: IncidentStatus) => void;
  updateSeverity: (id: string, severity: IncidentSeverity) => void;
  dispatchTeam: (incidentId: string, teamId: string) => void;
  createTask: (data: NewTaskInput) => string;
  assignTaskTeam: (taskId: string, teamId: string) => void;
  transitionTask: (taskId: string, status: TaskStatus) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  addTaskUpdate: (
    taskId: string,
    message: string,
    location?: string,
    networkStatus?: TaskUpdate["networkStatus"],
  ) => void;
  dispatchTeamToTask: (
    teamId: string,
    taskId: string,
    incidentId: string,
    priority: TaskPriority,
    destination: string,
    note: string,
  ) => void;
  updateTeamStatus: (teamId: string, status: TeamStatus) => void;
  updateTeamLocation: (teamId: string, location: TeamLocation) => void;
  updateTeamProfile: (teamId: string, input: TeamProfileInput) => void;
  updateTeamCapabilities: (teamId: string, capabilities: string[]) => void;
  releaseTeamFromTask: (teamId: string) => void;
  updateShelterCapacity: (
    shelterId: string,
    capacity: number,
    reservedCapacity: number,
  ) => void;
  updateShelterOccupancy: (shelterId: string, occupancy: number) => void;
  setShelterOpen: (shelterId: string, open: boolean) => void;
  updateShelterResources: (
    shelterId: string,
    input: ShelterResourceInput,
  ) => void;
  createEvacuation: (input: NewEvacuationInput) => string;
  transitionEvacuation: (operationId: string, status: EvacuationStatus) => void;
  assignEvacuationTeam: (operationId: string, teamId: string) => void;
  updateEvacuationProgress: (operationId: string, evacuated: number) => void;
  updateEvacuationRoute: (operationId: string, status: RouteStatus) => void;
  redirectEvacuation: (operationId: string, shelterId: string) => void;
  verifySos: (sosId: string) => void;
  rejectSos: (sosId: string) => void;
  linkSosToIncident: (sosId: string, incidentId: string) => void;
  createIncidentFromSos: (sosId: string) => string;
  createRescueTaskFromSos: (sosId: string, teamId: string) => string;
  updateSosPriority: (sosId: string, priority: SosPriority) => void;
  updateSosLocation: (sosId: string, location: SosLocation) => void;
  addSosUpdate: (sosId: string, message: string) => void;
  markSosNoContact: (sosId: string) => void;
  routeSosToShelter: (sosId: string, shelterId: string) => string;
  createSos: (
    input: import("@/application/sos/sosUseCases").NewSosInput,
  ) => string;
  resolveSos: (sosId: string, summary: string) => void;
  closeSos: (sosId: string) => void;
  cancelSos: (sosId: string) => void;
  createReliefRequest: (input: NewReliefRequestInput) => string;
  transitionReliefRequest: (
    requestId: string,
    status: ReliefRequestStatus,
  ) => void;
  approveReliefRequest: (
    requestId: string,
    approved: Record<string, number>,
  ) => void;
  reserveReliefStock: (
    requestId: string,
    warehouseId: string,
    allocations: Array<{ itemCode: string; quantity: number }>,
  ) => string;
  dispatchReliefReservation: (
    reservationId: string,
    teamId?: string | null,
  ) => string;
  updateShipmentStatus: (
    shipmentId: string,
    status: ShipmentStatus,
    note?: string,
  ) => void;
  confirmShipmentReceipt: (
    shipmentId: string,
    receiver: string,
    role: string,
    note: string,
  ) => void;
  adjustWarehouseInventory: (itemId: string, quantityOnHand: number) => void;
  setWarehouseStatus: (warehouseId: string, status: WarehouseStatus) => void;
  createPlaybook: (input: NewPlaybookInput) => string;
  updatePlaybook: (
    playbookId: string,
    changes: Partial<
      Pick<
        Playbook,
        | "name"
        | "description"
        | "disasterType"
        | "triggerConditions"
        | "severityThreshold"
        | "geographicScope"
        | "owner"
        | "estimatedDuration"
      >
    >,
  ) => void;
  publishPlaybook: (playbookId: string) => void;
  archivePlaybook: (playbookId: string) => void;
  addPlaybookStep: (
    playbookId: string,
    step: Omit<
      PlaybookStep,
      | "playbookId"
      | "order"
      | "status"
      | "startedAt"
      | "completedAt"
      | "completedBy"
    >,
  ) => void;
  reorderPlaybookSteps: (playbookId: string, stepIds: string[]) => void;
  activatePlaybook: (playbookId: string, incidentId: string) => string;
  pausePlaybookExecution: (executionId: string) => void;
  resumePlaybookExecution: (executionId: string) => void;
  cancelPlaybookExecution: (executionId: string) => void;
  completePlaybookExecution: (executionId: string) => void;
  startPlaybookStep: (executionId: string, stepId: string) => void;
  completePlaybookStep: (executionId: string, stepId: string) => void;
  skipPlaybookStep: (executionId: string, stepId: string) => void;
  assignPlaybookStepOwner: (
    executionId: string,
    stepId: string,
    owner: string,
  ) => void;
  createTaskFromPlaybookStep: (executionId: string, stepId: string) => string;
  createRecoveryProjectFromPlaybook: (executionId: string) => string;
  updatePlaybookStepEvidence: (
    executionId: string,
    stepId: string,
    changes: Partial<
      Pick<
        PlaybookStepExecution,
        | "notes"
        | "verificationNote"
        | "linkedTaskIds"
        | "linkedTeamIds"
        | "linkedShelterIds"
        | "linkedEvacuationIds"
        | "linkedSosIds"
        | "linkedReliefRequestIds"
      >
    >,
  ) => void;
  createDamageAssessment: (input: NewDamageAssessmentInput) => string;
  updateDamageAssessment: (
    id: string,
    changes: Partial<
      Omit<
        DamageAssessment,
        | "id"
        | "code"
        | "incidentId"
        | "status"
        | "verification"
        | "verifiedAt"
        | "createdAt"
        | "updatedAt"
      >
    >,
  ) => void;
  submitDamageAssessment: (id: string) => void;
  reviewDamageAssessment: (id: string) => void;
  verifyDamageAssessment: (
    id: string,
    evidenceIds: string[],
    note: string,
  ) => void;
  rejectDamageAssessment: (id: string, reason: string) => void;
  addDamageItem: (assessmentId: string, item: DamageItem) => void;
  attachDamageEvidence: (
    assessmentId: string,
    evidence: RecoveryEvidence,
  ) => void;
  createDamageRevision: (assessmentId: string) => string;
  createRecoveryProject: (input: NewRecoveryProjectInput) => string;
  updateRecoveryProject: (
    id: string,
    changes: Partial<
      Pick<
        RecoveryProject,
        | "name"
        | "category"
        | "priority"
        | "owner"
        | "geographicScope"
        | "estimatedBudget"
        | "targetDate"
        | "notes"
        | "assessmentIds"
        | "assignedTeamIds"
        | "relatedReliefRequestIds"
      >
    >,
  ) => void;
  approveRecoveryProject: (id: string, budget: number) => void;
  rejectRecoveryProject: (id: string, reason: string) => void;
  startRecoveryProject: (id: string) => void;
  pauseRecoveryProject: (id: string) => void;
  resumeRecoveryProject: (id: string) => void;
  cancelRecoveryProject: (id: string) => void;
  updateRecoveryBudget: (
    id: string,
    spent: number,
    overrideNote?: string | null,
  ) => void;
  verifyRecoveryCompletion: (
    id: string,
    note: string,
    evidence: string[],
  ) => void;
  completeRecoveryProject: (id: string) => void;
  addRecoveryMilestone: (
    projectId: string,
    milestone: Omit<
      RecoveryMilestone,
      "projectId" | "order" | "status" | "progress" | "completedAt"
    >,
  ) => void;
  startRecoveryMilestone: (projectId: string, milestoneId: string) => void;
  completeRecoveryMilestone: (projectId: string, milestoneId: string) => void;
  skipRecoveryMilestone: (projectId: string, milestoneId: string) => void;
  createTaskFromRecoveryProject: (projectId: string) => string;
  playSimulation: () => void;
  pauseSimulation: () => void;
  stepSimulation: () => void;
  resetSimulation: () => void;
  setSimulationSpeed: (speed: SimulationSpeed) => void;
  addEvent: (incidentId: string, message: string, actor?: string) => void;
  closeIncident: (id: string) => void;
  markAlertRead: (alertKey: string) => void;
  markAlertUnread: (alertKey: string) => void;
  markAllAlertsRead: () => void;
  acknowledgeAlert: (alertKey: string) => void;
}
export const OperationalStateContext = createContext<OperationalStore | null>(
  null,
);
export function useOperationalState() {
  const context = useContext(OperationalStateContext);
  if (!context)
    throw new Error(
      "useOperationalState phải được dùng trong OperationalProvider",
    );
  return context;
}
