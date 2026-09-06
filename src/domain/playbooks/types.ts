import type { UserRole } from "../shared/auth";

export type PlaybookStatus = "Nháp" | "Đã xuất bản" | "Lưu trữ";
export type PlaybookExecutionStatus =
  "Nháp" | "Đang hoạt động" | "Tạm dừng" | "Hoàn thành" | "Đã hủy";
export type PlaybookStepType =
  | "Đánh giá"
  | "Thông báo"
  | "Quyết định"
  | "Nhiệm vụ"
  | "Điều động"
  | "Sơ tán"
  | "Điểm sơ tán"
  | "Cứu trợ"
  | "Xác minh";
export type PlaybookStepStatus =
  "Chờ" | "Sẵn sàng" | "Đang thực hiện" | "Hoàn thành" | "Bỏ qua" | "Bị chặn";
export type SeverityThreshold = "Thấp" | "Trung bình" | "Cao" | "Khẩn cấp";

/**
 * Giai đoạn của một bước trong phương án, suy ra từ `leadTimeHours`.
 * "Giờ 0" = thời điểm dự kiến bão đổ bộ / mực nước đạt báo động III.
 */
export type PlaybookPhase = "Trước thiên tai" | "Trong thiên tai" | "Sau thiên tai";

/**
 * Sáu nội dung bắt buộc của phương án ứng phó thiên tai — Điều 22 Luật Phòng,
 * chống thiên tai. Ghi vào từng bước để kiểm tra được độ phủ pháp lý thay vì
 * chỉ nói "đã có phương án".
 */
export type PlaybookLegalBasis =
  | "Đ22.a — Bảo vệ công trình"
  | "Đ22.b — Sơ tán, bảo vệ người, tài sản, sản xuất"
  | "Đ22.c — An ninh trật tự, giao thông, thông tin liên lạc"
  | "Đ22.d — Phối hợp chỉ huy và tìm kiếm cứu nạn"
  | "Đ22.đ — Nguồn nhân lực"
  | "Đ22.e — Dự trữ vật tư, phương tiện, nhu yếu phẩm"
  | "Kết thúc ứng phó & rút kinh nghiệm";
export interface PlaybookOwner {
  name: string;
  role: string;
  organization: string;
}
export interface PlaybookStep {
  id: string;
  playbookId: string;
  order: number;
  name: string;
  description: string;
  objective: string;
  type: PlaybookStepType;
  status: PlaybookStepStatus;
  required: boolean;
  estimatedDuration: string;
  responsibleRole: string;
  /**
   * Vai đăng nhập chịu trách nhiệm — ràng buộc vào bảng phân quyền có thật,
   * thay cho chữ tự do. Nhờ đó bước hiện được trong danh sách việc của đúng
   * người, và có thể kiểm tra "vai này có quyền làm bước này không".
   */
  responsibleUserRole: UserRole;
  responsibleTeamType: string | null;
  /**
   * Mốc thời gian tương đối so với "giờ 0" (giờ). Âm = làm TRƯỚC khi thiên tai
   * xảy ra, 0 = ngay tại thời điểm tác động, dương = sau tác động.
   * Chuẩn tham chiếu: timeline phòng thiên tai Nhật Bản (MLIT), FEMA Phase 1
   * pre-landfall, tín hiệu bão PAGASA 36/24/18/12 giờ.
   */
  leadTimeHours: number;
  /**
   * Bước áp dụng cho cấp độ rủi ro thiên tai nào (1–5, QĐ 18/2021/QĐ-TTg).
   * Rỗng = áp dụng cho mọi cấp.
   */
  riskLevels: number[];
  /** Nội dung bắt buộc của Điều 22 mà bước này đáp ứng. */
  legalBasis: PlaybookLegalBasis;
  prerequisites: string[];
  completionCriteria: string[];
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
}
export interface Playbook {
  id: string;
  code: string;
  name: string;
  description: string;
  disasterType: string;
  triggerConditions: string[];
  severityThreshold: SeverityThreshold;
  geographicScope: string;
  status: PlaybookStatus;
  version: string;
  owner: PlaybookOwner;
  estimatedDuration: string;
  steps: PlaybookStep[];
  createdAt: string;
  updatedAt: string;
}
export interface PlaybookStepExecution {
  id: string;
  stepId: string;
  order: number;
  status: PlaybookStepStatus;
  owner: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  notes: string;
  blockedReason: string | null;
  linkedTaskIds: string[];
  linkedTeamIds: string[];
  linkedShelterIds: string[];
  linkedEvacuationIds: string[];
  linkedSosIds: string[];
  linkedReliefRequestIds: string[];
  verificationNote: string | null;
}
export interface PlaybookTimelineEvent {
  id: string;
  executionId: string | null;
  playbookId: string;
  incidentId: string | null;
  stepId: string | null;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
export interface PlaybookExecution {
  id: string;
  playbookId: string;
  incidentId: string;
  status: PlaybookExecutionStatus;
  currentStep: string | null;
  startedAt: string | null;
  completedAt: string | null;
  activatedBy: string;
  executionNotes: string;
  stepExecutions: PlaybookStepExecution[];
  linkedTaskIds: string[];
  linkedTeamIds: string[];
  linkedShelterIds: string[];
  linkedReliefRequestIds: string[];
  timeline: PlaybookTimelineEvent[];
  updatedAt: string;
}
export interface StepOperationalContext {
  tasks: Array<{ id: string; status: string }>;
  teams: Array<{ id: string; status: string; currentIncident: string | null }>;
  shelters: Array<{ id: string; status: string }>;
  evacuations: Array<{ id: string; status: string }>;
  sosRequests: Array<{ id: string; status: string }>;
  reliefRequests: Array<{ id: string; status: string }>;
}
