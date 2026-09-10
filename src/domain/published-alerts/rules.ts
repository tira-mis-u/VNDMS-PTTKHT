import type { PublishedAlert, PublishedAlertStatus } from "./types";

export const publishedAlertTransitions: Record<
  PublishedAlertStatus,
  PublishedAlertStatus[]
> = {
  Nháp: ["Đã công bố"],
  "Đã công bố": ["Đã thu hồi"],
  "Đã thu hồi": [],
};

export function isPublicAlert(alert: PublishedAlert) {
  return alert.status === "Đã công bố";
}

export function assertPublishedAlertTransition(
  alert: PublishedAlert,
  next: PublishedAlertStatus,
) {
  if (!publishedAlertTransitions[alert.status].includes(next))
    throw new Error(
      `Không thể chuyển cảnh báo ${alert.code} từ ${alert.status} sang ${next}.`,
    );
}

export function assertPublishedAlertEditable(alert: PublishedAlert) {
  if (alert.status === "Đã thu hồi")
    throw new Error(`Cảnh báo ${alert.code} đã thu hồi, không thể chỉnh sửa.`);
}
