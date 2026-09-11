/**
 * Phản ánh của người dân (không phải SOS): thông tin hiện trường cần cán bộ
 * đánh giá trước khi trở thành sự cố/nhiệm vụ. Gắn ownerUserId để công dân
 * chỉ theo dõi được phản ánh của chính mình.
 */
export type CitizenReportStatus = "Mới" | "Hợp lệ" | "Không hợp lệ" | "Trùng";
export type CitizenReportCategory =
  | "Ngập lụt"
  | "Sạt lở"
  | "Cây đổ / công trình hư hại"
  | "Mất điện / mất nước"
  | "Giao thông chia cắt"
  | "Đề nghị cứu trợ"
  | "Khác";

export interface CitizenReportLocation {
  address: string;
  administrativeArea: string;
  /** null khi người dân không cấp GPS; KHÔNG dùng tọa độ mặc định. */
  coordinates: [number, number] | null;
}

export interface CitizenReport {
  id: string;
  code: string;
  ownerUserId: string;
  reporterName: string;
  contact: string;
  category: CitizenReportCategory;
  description: string;
  location: CitizenReportLocation;
  status: CitizenReportStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  duplicateOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitizenReportEvent {
  id: string;
  reportId: string;
  type: "created" | "reviewed";
  message: string;
  actor: string;
  timestamp: string;
}

export const citizenReportCategories: readonly CitizenReportCategory[] = [
  "Ngập lụt",
  "Sạt lở",
  "Cây đổ / công trình hư hại",
  "Mất điện / mất nước",
  "Giao thông chia cắt",
  "Đề nghị cứu trợ",
  "Khác",
];
