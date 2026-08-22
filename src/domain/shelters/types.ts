export type ShelterStatus =
  | "Sẵn sàng"
  | "Đang tiếp nhận"
  | "Gần đầy"
  | "Quá tải"
  | "Tạm đóng"
  | "Không thể tiếp cận";
export type ShelterReadiness = "Sẵn sàng" | "Hạn chế" | "Không sẵn sàng";
export type ShelterAccessibility =
  "Tiếp cận bình thường" | "Tiếp cận hạn chế" | "Không thể tiếp cận";
export type ResourceAvailability = "Đầy đủ" | "Hạn chế" | "Thiếu";
export interface ShelterFacility {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: "Sẵn sàng" | "Hạn chế" | "Không khả dụng";
}
export interface ShelterOfficer {
  name: string;
  role: string;
  organization: string;
  phone: string;
}
export interface Shelter {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  administrativeArea: string;
  coordinates: [number, number];
  capacity: number;
  currentOccupancy: number;
  reservedCapacity: number;
  status: ShelterStatus;
  readiness: ShelterReadiness;
  accessibility: ShelterAccessibility;
  responsibleOfficer: ShelterOfficer;
  contact: string;
  facilities: ShelterFacility[];
  medicalCapability: "Có đội y tế" | "Sơ cứu cơ bản" | "Không có";
  waterAvailability: ResourceAvailability;
  foodAvailability: ResourceAvailability;
  powerAvailability: ResourceAvailability;
  sanitationStatus: ResourceAvailability;
  accessibleForVulnerablePeople: boolean;
  openingTime: string | null;
  closingTime: string | null;
  linkedIncidentIds: string[];
  activeEvacuationOperationIds: string[];
  notes: string;
  updatedAt: string;
}
export interface ShelterEvent {
  id: string;
  shelterId: string;
  type: string;
  message: string;
  actor: string;
  timestamp: string;
  source: string;
}
export interface ShelterCapacitySnapshot {
  availableCapacity: number;
  occupancyPercentage: number;
  isNearCapacity: boolean;
  isOverloaded: boolean;
}
