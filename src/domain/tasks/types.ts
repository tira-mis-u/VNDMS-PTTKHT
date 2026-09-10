export type TaskStatus =
  | "Chờ giao"
  | "Đã giao"
  | "Đã tiếp nhận"
  | "Đang thực hiện"
  /** Đơn vị cứu hộ đã báo xong; chờ cán bộ xác nhận kết quả. */
  | "Chờ xác nhận"
  | "Hoàn thành"
  | "Đã hủy";
export type TaskPriority = "Thấp" | "Trung bình" | "Cao" | "Khẩn cấp";

export interface IncidentTask {
  id: string;
  incidentId: string;
  title: string;
  type: string;
  priority: TaskPriority;
  teamId: string;
  teamLeader: string;
  assignee: string;
  location: string;
  coordinates: [number, number];
  dueAt: string;
  description: string;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Lịch sử phân công/phân công lại (có lý do). */
  assignmentHistory?: TaskAssignmentRecord[];
}

export interface TaskAssignmentRecord {
  at: string;
  fromTeamId: string | null;
  toTeamId: string;
  actor: string;
  reason: string;
}

/** Báo cáo kết quả của đơn vị cứu hộ và quyết định của cán bộ. */
export interface TaskReview {
  id: string;
  taskId: string;
  incidentId: string;
  reportedBy: string;
  reportedAt: string;
  reportNote: string;
  decision: "Chờ xác nhận" | "Chấp nhận" | "Từ chối";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  incidentId: string;
  timestamp: string;
  actor: string;
  teamId: string;
  message: string;
  location?: string;
  source: string;
  networkStatus: "Đã đồng bộ" | "Chờ đồng bộ";
}
