import { BellRing, ChevronRight } from "lucide-react";
import { alertSeverityTones } from "@/domain/alerts/types";
import { summarizeAlerts } from "@/application/alerts/alertQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

/**
 * DÒNG ĐẾM CẢNH BÁO (thay cho bảng "Cảnh báo tác nghiệp" cũ)
 * ─────────────────────────────────────────────────────────────────────────
 * Bảng cũ liệt kê 5 cảnh báo đầu tiên trong tổng số 44 — một lát cắt tuỳ tiện
 * của trang `/alerts`, và **không dẫn tới hành động nào** ngoài việc bấm sang
 * chính trang đó. Ở phòng chỉ huy, thứ cần biết chỉ là: còn bao nhiêu chưa
 * đọc, bao nhiêu phải xác nhận, mức cao nhất đang là gì — rồi mở trang cảnh
 * báo nếu muốn đọc.
 *
 * Khối tự ẩn khi trong phạm vi phân quyền không có cảnh báo nào, thay vì hiện
 * một bảng rỗng.
 */
export function OperationalAlerts({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const alerts = useOperationalState().alerts;
  if (!alerts.length) return null;

  const summary = summarizeAlerts(alerts);
  const highest =
    alerts.find((alert) => alertSeverityTones[alert.severity] === "red") ??
    alerts.find((alert) => alertSeverityTones[alert.severity] === "amber") ??
    alerts[0];

  return (
    <button
      type="button"
      className="cc-alert-counter"
      onClick={() => navigate("/alerts")}
      aria-label="Mở trung tâm cảnh báo"
    >
      <BellRing size={15} />
      <span className="cc-alert-counter-main">
        <b>{alerts.length}</b> cảnh báo trong phạm vi phụ trách ·{" "}
        <b>{summary.unread}</b> chưa đọc · <b>{summary.pendingAcknowledgement}</b> cần xác nhận
      </span>
      <span
        className={`cc-alert-counter-top cc-severity-${alertSeverityTones[highest.severity]}`}
      >
        Mới nhất: {highest.title}
      </span>
      <ChevronRight size={15} />
    </button>
  );
}
