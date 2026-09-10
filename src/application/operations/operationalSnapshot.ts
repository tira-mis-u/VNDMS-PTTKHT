import type { Incident, IncidentEvent } from "../../domain/incidents/types";
import type { IncidentTask, TaskUpdate } from "../../domain/tasks/types";
import type { RescueTeam, TeamEvent } from "../../domain/teams/types";
import type { Shelter, ShelterEvent } from "../../domain/shelters/types";
import type { SosEvent, SosRequest } from "../../domain/sos/types";
import type {
  AlertEvent,
  AlertInteraction,
} from "../../domain/alerts/types";
import type {
  CitizenReport,
  CitizenReportEvent,
} from "../../domain/reports/types";
import type {
  PublishedAlert,
  PublishedAlertEvent,
} from "../../domain/published-alerts/types";
import type { TaskReview } from "../../domain/tasks/types";

export interface OperationalSnapshot {
  /** Provenance của lát cắt dữ liệu; không phải đồng hồ thời gian thực. */
  metadata: {
    scenarioId: string;
    scenarioName: string;
    asOf: string;
    source: string;
  };
  incidents: Incident[];
  events: IncidentEvent[];
  tasks: IncidentTask[];
  taskUpdates: TaskUpdate[];
  /** Kết quả đơn vị cứu hộ báo cáo, chờ cán bộ xác nhận/từ chối. */
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
  alertInteractions: AlertInteraction[];
  alertEvents: AlertEvent[];
}
