import type { AlertSeverity } from "../alerts/types";

/**
 * Cảnh báo do cán bộ phòng chống thiên tai CÔNG BỐ tới người dân.
 * Khác với cảnh báo tác nghiệp (suy ra từ dữ liệu nội bộ), đây là bản tin
 * có vòng đời biên tập: Nháp → Đã công bố → (cập nhật) → Đã thu hồi.
 */
export type PublishedAlertStatus = "Nháp" | "Đã công bố" | "Đã thu hồi";

export interface PublishedAlert {
  id: string;
  code: string;
  title: string;
  content: string;
  severity: AlertSeverity;
  areaName: string;
  status: PublishedAlertStatus;
  /** Tăng mỗi lần cập nhật sau công bố để người dân biết bản tin mới. */
  revision: number;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
}

export interface PublishedAlertEvent {
  id: string;
  alertId: string;
  type: "drafted" | "published" | "updated" | "withdrawn";
  message: string;
  actor: string;
  timestamp: string;
}
