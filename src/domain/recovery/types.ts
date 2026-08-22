export type AssessmentType =
  | "Nhà ở"
  | "Hạ tầng"
  | "Giao thông"
  | "Nông nghiệp"
  | "Công trình công cộng"
  | "Tiện ích"
  | "Môi trường";
export type DamageAssessmentStatus =
  "Nháp" | "Đã gửi" | "Đang thẩm định" | "Đã xác minh" | "Từ chối";
export type DamageSeverity = "Nhẹ" | "Trung bình" | "Nghiêm trọng" | "Phá hủy";
export type RecoveryProjectStatus =
  | "Đề xuất"
  | "Đã phê duyệt"
  | "Đang thực hiện"
  | "Tạm dừng"
  | "Hoàn thành"
  | "Từ chối"
  | "Đã hủy";
export type RecoveryPriority = "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp";
export type RecoveryMilestoneStatus =
  "Chờ" | "Đang thực hiện" | "Hoàn thành" | "Bỏ qua";
export interface RecoveryLocation {
  name: string;
  coordinates: [number, number];
}
export interface RecoveryEvidence {
  id: string;
  name: string;
  source: string;
  timestamp: string;
  verificationStatus: "Chưa xác minh" | "Đã xác minh" | "Không hợp lệ";
  note: string;
  url?: string;
}
export interface AssessmentVerification {
  actor: string;
  timestamp: string;
  decision: "Xác minh" | "Từ chối";
  evidence: string[];
  note: string;
}
export interface DamageItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  damageLevel: DamageSeverity;
  estimatedCost: number;
  affectedArea: string;
  location: RecoveryLocation;
  evidence: string[];
  notes: string;
}
export interface DamageAssessment {
  id: string;
  incidentId: string;
  code: string;
  area: string;
  assessmentType: AssessmentType;
  status: DamageAssessmentStatus;
  severity: DamageSeverity;
  assessor: string;
  assessedAt: string;
  verifiedAt: string | null;
  summary: string;
  affectedPopulation: number;
  affectedHouseholds: number;
  damagedBuildings: number;
  damagedInfrastructure: number;
  damagedRoads: number;
  damagedAgriculture: number;
  damagedUtilities: number;
  estimatedLoss: number;
  evidence: RecoveryEvidence[];
  items: DamageItem[];
  verification: AssessmentVerification | null;
  rejectionReason: string | null;
  revisionOf: string | null;
  revision: number;
  geographicScope: string;
  location: RecoveryLocation;
  affectedAreaCoordinates: [number, number][];
  createdAt: string;
  updatedAt: string;
}
export interface RecoveryMilestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
  status: RecoveryMilestoneStatus;
  progress: number;
  dueDate: string;
  completedAt: string | null;
  owner: string;
  completionCriteria: string;
}
export interface RecoveryCompletionVerification {
  actor: string;
  timestamp: string;
  note: string;
  evidence: string[];
}
export interface RecoveryProject {
  id: string;
  code: string;
  name: string;
  incidentId: string;
  assessmentIds: string[];
  category: string;
  priority: RecoveryPriority;
  status: RecoveryProjectStatus;
  owner: string;
  geographicScope: string;
  estimatedBudget: number;
  approvedBudget: number;
  spentBudget: number;
  budgetOverrideNote: string | null;
  startDate: string | null;
  targetDate: string;
  completedAt: string | null;
  progress: number;
  milestones: RecoveryMilestone[];
  taskIds: string[];
  requiredTaskIds: string[];
  assignedTeamIds: string[];
  relatedReliefRequestIds: string[];
  location: RecoveryLocation;
  affectedAreaCoordinates: [number, number][];
  completionVerification: RecoveryCompletionVerification | null;
  rejectionReason: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface RecoveryEvent {
  id: string;
  entityType: "assessment" | "project";
  entityId: string;
  incidentId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
export interface RecoveryProgressContext {
  tasks: Array<{ id: string; status: string; progress: number }>;
  assessments: Array<{ id: string; status: DamageAssessmentStatus }>;
}
