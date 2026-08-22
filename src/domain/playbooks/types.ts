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
  responsibleTeamType: string | null;
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
