import type { Permission } from "../../lib/permissions/permissions";

/**
 * Cảnh báo tác nghiệp được SUY RA từ canonical operational state.
 * Alert không sao chép entity nguồn; chỉ giữ reference và tối thiểu
 * ngữ cảnh cần cho hiển thị + authorization phòng thủ lớp hai.
 */
export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type AlertCategory =
  | "incident"
  | "sos"
  | "task"
  | "team"
  | "shelter"
  | "evacuation"
  | "relief"
  | "playbook"
  | "recovery";

export type AlertSourceType =
  | "Incident"
  | "SOS"
  | "Task"
  | "Team"
  | "Shelter"
  | "Evacuation"
  | "ReliefRequest"
  | "Inventory"
  | "Shipment"
  | "PlaybookExecution"
  | "DamageAssessment"
  | "RecoveryProject";

export type AlertStatus = "Chưa đọc" | "Đã đọc" | "Đã xác nhận";

export type AlertCondition =
  | "incident_critical_active"
  | "incident_high_early_stage"
  | "incident_no_team"
  | "sos_p1_verified_unassigned"
  | "sos_waiting_too_long"
  | "sos_contact_lost"
  | "task_overdue"
  | "task_high_priority_unassigned"
  | "task_stalled"
  | "team_communication_lost"
  | "team_unavailable_during_response"
  | "shelter_overloaded"
  | "shelter_near_capacity"
  | "shelter_inaccessible"
  | "evacuation_blocked_or_paused"
  | "evacuation_slow"
  | "relief_request_shortage"
  | "inventory_out_of_stock"
  | "inventory_low_stock"
  | "shipment_delayed"
  | "shipment_incident"
  | "playbook_required_steps_blocked"
  | "assessment_verification_stalled"
  | "recovery_milestone_overdue"
  | "recovery_budget_exceeded"
  | "recovery_budget_risk";

export interface AlertSourceRef {
  type: AlertSourceType;
  id: string;
  code: string;
  /** Route canonical hiện hữu của entity nguồn. */
  path: string;
  label: string;
}

/** Cảnh báo thuần, chưa gắn trạng thái đọc/xác nhận theo người dùng. */
export interface DerivedAlert {
  /** Khóa deterministic: <category>:<sourceType>:<sourceId>:<condition>. */
  key: string;
  category: AlertCategory;
  condition: AlertCondition;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: AlertSourceRef;
  /** Quyền đọc entity nguồn — dùng lại permission matrix hiện hữu. */
  readPermission: Permission;
  geographicScope?: string;
  ownerTeamId?: string | null;
  ownerWarehouseId?: string | null;
  requiresAcknowledgement: boolean;
  /** Mốc thời gian nghiệp vụ tạo ra điều kiện cảnh báo (deterministic). */
  detectedAt: string;
}

/** Cảnh báo đã resolve theo người dùng hiện tại. */
export interface OperationalAlert extends DerivedAlert {
  status: AlertStatus;
  readAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

/**
 * Trạng thái tương tác tối thiểu được lưu trong canonical snapshot.
 * Không chứa bản sao dữ liệu entity; chỉ là read receipt + acknowledgement
 * gắn với alert key deterministic.
 */
export interface AlertReadReceipt {
  userId: string;
  readAt: string;
}

export interface AlertAcknowledgement {
  userId: string;
  actor: string;
  at: string;
}

export interface AlertInteraction {
  alertKey: string;
  readBy: AlertReadReceipt[];
  acknowledgement: AlertAcknowledgement | null;
}

/** Timeline/audit nghiệp vụ của alert (chỉ ghi mutation có ý nghĩa). */
export interface AlertEvent {
  id: string;
  alertKey: string;
  type: "acknowledged";
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}

export const alertSeverityRank: Record<AlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const alertSeverityLabels: Record<AlertSeverity, string> = {
  critical: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

export const alertSeverityTones: Record<
  AlertSeverity,
  "red" | "amber" | "blue" | "neutral"
> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "neutral",
};

export const alertCategoryLabels: Record<AlertCategory, string> = {
  incident: "Sự cố",
  sos: "SOS",
  task: "Nhiệm vụ",
  team: "Đội cứu hộ",
  shelter: "Điểm sơ tán",
  evacuation: "Sơ tán",
  relief: "Cứu trợ & kho",
  playbook: "Kế hoạch ứng phó",
  recovery: "Phục hồi",
};

export const alertConditionLabels: Record<AlertCondition, string> = {
  incident_critical_active: "Sự cố khẩn cấp đang xử lý",
  incident_high_early_stage: "Sự cố mức cao còn ở giai đoạn đầu",
  incident_no_team: "Sự cố chưa có đội phụ trách",
  sos_p1_verified_unassigned: "SOS P1 đã xác minh chưa điều phối",
  sos_waiting_too_long: "SOS chờ xử lý quá lâu",
  sos_contact_lost: "SOS mất liên lạc",
  task_overdue: "Nhiệm vụ quá hạn",
  task_high_priority_unassigned: "Nhiệm vụ ưu tiên cao chưa giao đội",
  task_stalled: "Nhiệm vụ đang đình trệ",
  team_communication_lost: "Đội cứu hộ mất liên lạc",
  team_unavailable_during_response: "Đội không khả dụng khi đang ứng phó",
  shelter_overloaded: "Điểm sơ tán quá tải",
  shelter_near_capacity: "Điểm sơ tán gần đầy",
  shelter_inaccessible: "Điểm sơ tán không thể tiếp cận",
  evacuation_blocked_or_paused: "Hoạt động sơ tán bị chặn hoặc tạm dừng",
  evacuation_slow: "Hoạt động sơ tán đang chậm",
  relief_request_shortage: "Yêu cầu cứu trợ thiếu hàng",
  inventory_out_of_stock: "Kho đã hết hàng",
  inventory_low_stock: "Tồn kho dưới mức đặt hàng lại",
  shipment_delayed: "Chuyến hàng quá giờ dự kiến",
  shipment_incident: "Chuyến hàng gặp sự cố",
  playbook_required_steps_blocked: "Bước bắt buộc của quy trình bị chặn",
  assessment_verification_stalled: "Đánh giá thiệt hại chờ xác minh quá lâu",
  recovery_milestone_overdue: "Mốc phục hồi quá hạn",
  recovery_budget_exceeded: "Ngân sách phục hồi vượt phê duyệt",
  recovery_budget_risk: "Ngân sách phục hồi sắp chạm hạn mức",
};
