import type { OperationalSnapshot } from "@/application/operations/operationalSnapshot";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask, TaskReview, TaskUpdate } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { SosRequest } from "@/domain/sos/types";
import type { CitizenReport } from "@/domain/reports/types";
import type { PublishedAlert } from "@/domain/published-alerts/types";

export interface IOperationalRepository {
  /** Nạp toàn bộ dữ liệu tác nghiệp hiện hành */
  load(): Promise<OperationalSnapshot>;

  /** Lưu / Cập nhật sự cố thiên tai */
  saveIncident(incident: Incident): Promise<void>;

  /** Lưu / Cập nhật điểm sơ tán */
  saveShelter(shelter: Shelter): Promise<void>;

  /** Lưu / Cập nhật yêu cầu cứu nạn SOS */
  saveSosRequest(sos: SosRequest): Promise<void>;

  /** Lưu / Cập nhật nhiệm vụ tác nghiệp */
  saveTask(task: IncidentTask): Promise<void>;

  /** Lưu / Cập nhật kết quả đánh giá nhiệm vụ */
  saveTaskReview(review: TaskReview): Promise<void>;

  /** Lưu cập nhật tiến độ nhiệm vụ */
  saveTaskUpdate(update: TaskUpdate): Promise<void>;

  /** Lưu / Cập nhật lực lượng / đội cứu hộ */
  saveTeam(team: RescueTeam): Promise<void>;

  /** Lưu / Cập nhật phản ánh của người dân */
  saveCitizenReport(report: CitizenReport): Promise<void>;

  /** Lưu / Cập nhật bản tin cảnh báo công bố */
  savePublishedAlert(alert: PublishedAlert): Promise<void>;

  /** Xóa sự cố */
  deleteIncident?(id: string): Promise<void>;

  /** Xóa điểm sơ tán */
  deleteShelter?(id: string): Promise<void>;

  /** Xóa yêu cầu cứu nạn */
  deleteSosRequest?(id: string): Promise<void>;

  /** Xóa nhiệm vụ */
  deleteTask?(id: string): Promise<void>;

  /** Xóa đội cứu hộ */
  deleteTeam?(id: string): Promise<void>;

  /** Xóa phản ánh */
  deleteCitizenReport?(id: string): Promise<void>;

  /** Xóa bản tin cảnh báo */
  deletePublishedAlert?(id: string): Promise<void>;
}
