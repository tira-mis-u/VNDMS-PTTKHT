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
    | "Cứu trợ"
    | "Phục hồi";
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
  evacuatedPopulation: number;
  remainingPopulation: number;
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
export interface EvacuationAnalytics {
  total: number;
  active: number;
  evacuated: number;
  remaining: number;
  completionRate: number;
  averageProgress: number;
  blockedRoutes: number;
  rows: Array<{
    id: string;
    code: string;
    incidentId: string;
    shelterId: string;
    status: string;
    progress: number;
    evacuated: number;
    remaining: number;
    routeStatus: string;
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
export interface ReliefAnalytics {
  byStatus: DistributionRow[];
  byPriority: DistributionRow[];
  pendingApprovals: number;
  shortStockRequests: number;
  overdueDeliveries: number;
  warehouseAvailability: number;
  reservedStock: number;
  availableStock: number;
  distributionProgress: number;
  failedShipments: number;
  lowStockItems: number;
  requestRows: Array<{
    id: string;
    code: string;
    status: string;
    priority: string;
    shortage: number;
    overdue: boolean;
  }>;
  warehouseRows: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    utilization: number;
    lowStock: number;
  }>;
}
export interface RecoveryAnalytics {
  assessmentByStatus: DistributionRow[];
  damageByCategory: Array<{ category: string; value: number }>;
  estimatedDamage: number;
  verifiedDamage: number;
  unverifiedDamage: number;
  projectByStatus: DistributionRow[];
  averageProjectProgress: number;
  budgetUtilization: number;
  delayedMilestones: number;
  projectsRequiringAttention: number;
  projectRows: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    progress: number;
    budgetUtilization: number;
    delayedMilestones: number;
  }>;
}
export type OperationalReportType =
  | "Báo cáo tình hình tác chiến"
  | "Báo cáo sự cố"
  | "Báo cáo cứu hộ"
  | "Báo cáo sơ tán"
  | "Báo cáo cứu trợ"
  | "Báo cáo phục hồi";
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
  recoveryStatus: string[];
  audit: {
    generatedAt: string;
    generatedById: string;
    generatedBy: string;
    source: string;
    dataPolicy: string;
    invalidTimestamps: Array<{ entityId: string; field: string; value: string }>;
  };
}
