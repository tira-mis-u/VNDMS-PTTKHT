export type TeamStatus =
  | "Sẵn sàng"
  | "Đang điều động"
  | "Đang thực hiện"
  | "Tạm nghỉ"
  | "Mất liên lạc"
  | "Không khả dụng";
export type TeamAvailability =
  "Có thể điều phối" | "Đang bận" | "Hạn chế" | "Không sẵn sàng";
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  responsibility?: string;
  status: "Sẵn sàng" | "Đang nhiệm vụ" | "Tạm nghỉ";
  contact: string;
}
export interface TeamVehicle {
  id: string;
  name: string;
  type: string;
  status: "Sẵn sàng" | "Đang sử dụng" | "Bảo dưỡng" | "Không khả dụng";
}
export interface TeamLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  source: "GPS" | "Thiết bị di động" | "Điều hành viên";
  communicationStatus: "Kết nối" | "Gián đoạn" | "Mất liên lạc";
}
export interface RescueTeam {
  id: string;
  code: string;
  name: string;
  type: string;
  status: TeamStatus;
  leader: string;
  members: number;
  personnel: TeamMember[];
  capabilities: string[];
  capability: string;
  vehicles: TeamVehicle[];
  currentTask: string | null;
  currentIncident: string | null;
  currentEvacuationOperation: string | null;
  currentReliefShipment: string | null;
  location: TeamLocation;
  coordinates: [number, number];
  lastLocationUpdate: string;
  lastOperationalUpdate: string;
  communicationStatus: TeamLocation["communicationStatus"];
  availability: TeamAvailability;
  region: string;
  operatingScope: string;
  contact: string;
  notes: string;
  distance: string;
  createdAt: string;
  updatedAt: string;
}
export interface TeamEvent {
  id: string;
  teamId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
