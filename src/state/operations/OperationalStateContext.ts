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
  TaskReview,
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
import type { ShelterResourceInput } from "@/application/shelters/shelterUseCases";
import type {
  SosEvent,
  SosLocation,
  SosPriority,
  SosRequest,
} from "@/domain/sos/types";
import type {
  CitizenReport,
  CitizenReportEvent,
  CitizenReportStatus,
} from "@/domain/reports/types";
import type { NewCitizenReportInput } from "@/application/reports/reportUseCases";
import type {
  PublishedAlert,
  PublishedAlertEvent,
} from "@/domain/published-alerts/types";
import type { PublishedAlertDraftInput } from "@/application/published-alerts/publishedAlertUseCases";
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
  taskReviews: TaskReview[];
  teams: RescueTeam[];
  teamEvents: TeamEvent[];
  shelters: Shelter[];
  shelterEvents: ShelterEvent[];
  sosRequests: SosRequest[];
  sosEvents: SosEvent[];
  citizenReports: CitizenReport[];
  citizenReportEvents: CitizenReportEvent[];
  publishedAlerts: PublishedAlert[];
  publishedAlertEvents: PublishedAlertEvent[];
  /** Read receipt/acknowledgement tối thiểu của alert (canonical snapshot). */
  alertInteractions: AlertInteraction[];
  /** Authorized Alert View — suy ra từ canonical state đã qua lọc quyền. */
  alerts: OperationalAlert[];
  /** Timeline của các alert đang hiển thị với người dùng hiện tại. */
  alertEvents: AlertEvent[];
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
  resetPassword: (
    usernameOrPhone: string,
    newPassword: string,
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
  recordSecurityAudit: (
    action: import("@/domain/auth/types").AuditAction,
    reason: string,
    resourceType?: string,
    resourceId?: string | null,
  ) => void;
  createIncident: (data: CreateIncidentInput) => string;
  updateStatus: (id: string, status: IncidentStatus) => void;
  updateSeverity: (id: string, severity: IncidentSeverity) => void;
  dispatchTeam: (incidentId: string, teamId: string) => void;
  createTask: (data: NewTaskInput) => string;
  assignTaskTeam: (taskId: string, teamId: string) => void;
  transitionTask: (taskId: string, status: TaskStatus) => void;
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
  verifySos: (sosId: string) => void;
  rejectSos: (sosId: string) => void;
  linkSosToIncident: (sosId: string, incidentId: string) => void;
  createIncidentFromSos: (sosId: string) => string;
  createRescueTaskFromSos: (sosId: string, teamId: string) => string;
  updateSosPriority: (sosId: string, priority: SosPriority) => void;
  updateSosLocation: (sosId: string, location: SosLocation) => void;
  addSosUpdate: (sosId: string, message: string) => void;
  markSosNoContact: (sosId: string) => void;
  createSos: (
    input: import("@/application/sos/sosUseCases").NewSosInput,
    /** Caller đã tự ghi dòng nhật ký chuyên biệt (SOS Panic) → store bỏ dòng
     * generic, MỘT hành động = MỘT dòng audit (owner request 2026-09). */
    options?: { securityAudited?: boolean },
  ) => string;
  resolveSos: (sosId: string, summary: string) => void;
  closeSos: (sosId: string) => void;
  cancelSos: (sosId: string) => void;
  /** Người gửi rút lại chính SOS của mình khi còn ở trạng thái sớm (kèm nút Hoàn tác 5 giây). */
  cancelOwnSos: (sosId: string) => void;
  /** Đơn vị cứu hộ báo xong — nhiệm vụ chuyển "Chờ xác nhận", KHÔNG tự đóng. */
  reportTaskDone: (taskId: string, note: string) => void;
  /** Cán bộ chấp nhận (→ Hoàn thành) hoặc từ chối (→ Đang thực hiện) kết quả. */
  reviewTaskResult: (taskId: string, accepted: boolean, note: string) => void;
  /** Phân công lại đội cho nhiệm vụ, bắt buộc có lý do; ghi lịch sử. */
  reassignTask: (taskId: string, teamId: string, reason: string) => void;
  createCitizenReport: (input: NewCitizenReportInput) => string;
  reviewCitizenReport: (
    reportId: string,
    decision: Exclude<CitizenReportStatus, "Mới">,
    note: string,
    duplicateOfId?: string | null,
  ) => void;
  draftPublishedAlert: (input: PublishedAlertDraftInput) => string;
  updatePublishedAlert: (alertId: string, input: PublishedAlertDraftInput) => void;
  publishAlert: (alertId: string) => void;
  withdrawPublishedAlert: (alertId: string, reason: string) => void;
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
