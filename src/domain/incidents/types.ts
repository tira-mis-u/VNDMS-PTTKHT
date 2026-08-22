export type IncidentSeverity = "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp";
export type IncidentStatus =
  | "Mới"
  | "Đánh giá"
  | "Đang xử lý"
  | "Đang điều phối"
  | "Đã kiểm soát"
  | "Đã đóng";

export interface Incident {
  id: string;
  code: string;
  title: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: { name: string; coordinates: [number, number] };
  affectedArea: string;
  affectedPopulation: number;
  affectedHouseholds: number;
  affectedBuildings: number;
  affectedRoads: number;
  floodDepth: string;
  areaHectares: number;
  assignedTeamId: string | null;
  lead: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  closedAt: string | null;
  source: string;
  description: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source?: string;
  metadata?: Record<string, string>;
}
