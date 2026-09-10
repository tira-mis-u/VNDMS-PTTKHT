export type AnalyticsPeriod = {
  from?: string;
  to?: string;
  geographicScope?: string;
  incidentId?: string;
  referenceTime?: string;
};
export type MetricBasis = "Ghi nhận" | "Dẫn xuất";
export interface CountMetric {
  label: string;
  value: number;
  basis: MetricBasis;
  description: string;
}
export interface DistributionRow {
  label: string;
  value: number;
  percentage: number;
}
export interface OperationalException {
  severity: "Khẩn cấp" | "Cao" | "Trung bình";
  module:
    | "Sự cố"
    | "Nhiệm vụ"
    | "Đội cứu hộ"
    | "Điểm sơ tán"
    | "SOS"
    | "Phản ánh";
  entityId: string;
  entityCode: string;
  title: string;
  reason: string;
  path: string;
}
export interface IncidentTiming {
  id: string;
  code: string;
  title: string;
  area: string;
  responseMinutes: number | null;
  acknowledgementMinutes: number | null;
  dispatchMinutes: number | null;
  resolutionMinutes: number | null;
  basis: MetricBasis;
  overdue: boolean;
}
export interface OperationalSummary {
  metrics: CountMetric[];
  exceptions: OperationalException[];
}
export interface IncidentAnalytics {
  bySeverity: DistributionRow[];
  byStatus: DistributionRow[];
  byArea: DistributionRow[];
  timings: IncidentTiming[];
  averageAcknowledgementMinutes: number | null;
  averageDispatchMinutes: number | null;
  averageResolutionMinutes: number | null;
  overdueCount: number;
  affectedPopulation: number;
  /** Số người ghi nhận trong các SOS đã đóng thuộc phạm vi (canonical). */
  rescuedPopulation: number;
  /** Số người trong SOS còn mở (kể cả SOS đã xử lý nhưng chờ cán bộ duyệt đóng). */
  pendingPopulation: number;
}
export interface TaskAnalytics {
  byStatus: DistributionRow[];
  byPriority: DistributionRow[];
  overdueCount: number;
  completionRate: number;
  averageCompletionMinutes: number | null;
  unassignedCount: number;
  progressBands: DistributionRow[];
  byIncident: Array<{
    incidentId: string;
    code: string;
    title: string;
    total: number;
    open: number;
    overdue: number;
  }>;
  dispatchToStartMinutes: number | null;
  /** Nhiệm vụ đơn vị đã báo xong, đang chờ cán bộ xác nhận. */
  awaitingReviewCount: number;
  /** Số lần cán bộ từ chối kết quả (từ TaskReview canonical). */
  rejectedReviewCount: number;
  /** Số lần phân công lại có lý do (từ assignmentHistory). */
  reassignmentCount: number;
}
export interface TeamAnalytics {
  total: number;
  available: number;
  deployed: number;
  unavailable: number;
  utilizationRate: number;
  workload: Array<{
    teamId: string;
    code: string;
    name: string;
    activeTasks: number;
    incidentId: string | null;
    assignment: string;
  }>;
  capability: Array<{
    capability: string;
    available: number;
    deployed: number;
    demand: number;
  }>;
}
export interface ShelterAnalytics {
  total: number;
  occupancy: number;
  capacity: number;
  utilizationRate: number;
  overloaded: number;
  rows: Array<{
    id: string;
    code: string;
    name: string;
    area: string;
    occupancy: number;
    capacity: number;
    reserved: number;
    utilization: number;
    status: string;
  }>;
}
export interface SosAnalytics {
  byPriority: DistributionRow[];
  byStatus: DistributionRow[];
  byVerification: DistributionRow[];
  byArea: DistributionRow[];
  averageWaitingMinutes: number | null;
  averageResolutionMinutes: number | null;
  unassigned: number;
  vulnerableCases: number;
  incidentConversionRate: number;
  rescueChainCompleted: number;
  rows: Array<{
    id: string;
    code: string;
    priority: string;
    status: string;
    area: string;
    waitingMinutes: number;
    linkedIncidentId: string | null;
    linkedTaskId: string | null;
    assignedTeamId: string | null;
    bottleneck: string | null;
  }>;
}
export interface CitizenReportAnalytics {
  total: number;
  pending: number;
  valid: number;
  invalid: number;
  duplicate: number;
  byCategory: DistributionRow[];
  byStatus: DistributionRow[];
  averageReviewMinutes: number | null;
  rows: Array<{
    id: string;
    code: string;
    category: string;
    status: string;
    area: string;
    createdAt: string;
    waitingMinutes: number | null;
  }>;
}
export type OperationalReportType =
  | "Báo cáo tình hình tác chiến"
  | "Báo cáo sự cố"
  | "Báo cáo cứu hộ"
  | "Báo cáo SOS"
  | "Báo cáo phản ánh";
export interface OperationalReport {
  type: OperationalReportType;
  title: string;
  period: string;
  scope: string;
  incidentScope: string;
  situationSummary: string;
  findings: string[];
  responseStatistics: Array<{
    label: string;
    value: string;
    basis: MetricBasis;
  }>;
  resourceUtilization: string[];
  majorExceptions: OperationalException[];
  completedActions: string[];
  outstandingActions: string[];
  /** Kết quả chờ xác nhận: nhiệm vụ đơn vị đã báo xong, SOS đã xử lý chờ đóng. */
  pendingConfirmation: string[];
  audit: {
    generatedAt: string;
    generatedById: string;
    generatedBy: string;
    source: string;
    dataPolicy: string;
    invalidTimestamps: Array<{ entityId: string; field: string; value: string }>;
  };
}
