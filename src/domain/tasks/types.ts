export type TaskStatus =
  | "Chờ giao"
  | "Đã giao"
  | "Đã tiếp nhận"
  | "Đang thực hiện"
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
