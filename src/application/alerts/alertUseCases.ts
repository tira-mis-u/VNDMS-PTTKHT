import type {
  AlertEvent,
  AlertInteraction,
  OperationalAlert,
} from "../../domain/alerts/types";
import {
  acknowledgeAlert,
  assertAlertCanAcknowledge,
  markAlertRead,
} from "../../domain/alerts/rules";

/**
 * Use case ghi nhận đã đọc. Không tạo audit nghiệp vụ — read receipt là
 * tương tác cá nhân, không phải quyết định tác nghiệp.
 */
export function markAlertReadReceipt(
  interactions: AlertInteraction[],
  alertKey: string,
  userId: string,
  at: string,
): AlertInteraction[] {
  if (!alertKey) throw new Error("Thiếu khóa cảnh báo cần đánh dấu đã đọc.");
  if (!userId) throw new Error("Không xác định được người dùng hiện tại.");
  return markAlertRead(interactions, alertKey, { userId, readAt: at });
}

/**
 * Use case xác nhận cảnh báo. Biểu diễn quyết định tác nghiệp
 * “đã tiếp nhận và sẽ xử lý” — tạo timeline event có attribution.
 */
export function acknowledgeOperationalAlert(
  interactions: AlertInteraction[],
  alert: OperationalAlert,
  actor: { id: string; name: string },
  at: string,
): { interactions: AlertInteraction[]; event: AlertEvent } {
  assertAlertCanAcknowledge(alert);
  const acknowledgement = { userId: actor.id, actor: actor.name, at };
  return {
    interactions: acknowledgeAlert(interactions, alert.key, acknowledgement),
    event: {
      id: `ALE-${Date.now()}-${interactions.length}`,
      alertKey: alert.key,
      type: "acknowledged",
      message: `${actor.name} đã xác nhận tiếp nhận cảnh báo “${alert.title}”.`,
      actor: actor.name,
      timestamp: at,
      source: "Trung tâm thông báo tác nghiệp",
    },
  };
}
