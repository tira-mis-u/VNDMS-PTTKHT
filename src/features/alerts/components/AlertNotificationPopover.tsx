import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import {
  alertCategoryLabels,
  alertSeverityLabels,
  alertSeverityTones,
  type OperationalAlert,
} from "@/domain/alerts/types";
import {
  alertDetailPath,
  summarizeAlerts,
} from "@/application/alerts/alertQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function AlertNotificationBell({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { alerts } = useOperationalState();
  const summary = summarizeAlerts(alerts);
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Thông báo tác nghiệp"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onToggle}
    >
      <Bell size={26} />
      {summary.unread > 0 && (
        <span
          className="unread-dot notification-count"
          aria-label={`${summary.unread} cảnh báo chưa đọc`}
        >
          {summary.unread}
        </span>
      )}
    </Button>
  );
}

export function AlertNotificationPopover({
  navigate,
  onClose,
}: {
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const { alerts } = store;
  const [error, setError] = useState("");
  const summary = summarizeAlerts(alerts);
  const top = alerts.slice(0, 6);
  const run = (action: () => unknown) => {
    try {
      setError("");
      action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể thực hiện thao tác.",
      );
    }
  };
  const openAlert = (alert: OperationalAlert) => {
    if (alert.status === "Chưa đọc")
      try {
        store.markAlertRead(alert.key);
      } catch {
        /* read receipt chỉ là tương tác cá nhân */
      }
    onClose();
    navigate(alertDetailPath(alert));
  };
  const canAcknowledge = (alert: OperationalAlert) =>
    alert.requiresAcknowledgement &&
    !alert.acknowledgedAt &&
    store.can("alert_acknowledge", alert.geographicScope);
  const severityIcons = {
    critical: ShieldAlert,
    high: AlertTriangle,
    medium: CircleAlert,
    low: Info,
  } as const;
  return (
    <div
      className="notification-popover alert-popover"
      role="dialog"
      aria-label="Trung tâm thông báo tác nghiệp"
    >
      <div className="popover-title">
        <strong>Cảnh báo tác nghiệp</strong>
        <button onClick={onClose}>Đóng</button>
      </div>
      {alerts.length === 0 ? (
        <p className="alert-popover-empty">
          Không có cảnh báo tác nghiệp nào trong phạm vi phân quyền hiện tại.
        </p>
      ) : (
        <>
          <p className="alert-popover-summary">
            <b>{summary.unread}</b> chưa đọc · <b>{summary.pendingAcknowledgement}</b>{" "}
            cần xác nhận · <b>{summary.total}</b> đang hiệu lực
          </p>
          {error && (
            <p className="alert-popover-error" role="alert">
              {error}
            </p>
          )}
          <ul className="alert-popover-list">
            {top.map((alert) => {
              const SeverityIcon = severityIcons[alert.severity];
              return (
                <li
                  key={alert.key}
                  className={`alert-popover-card severity-${alert.severity} ${alert.status === "Chưa đọc" ? "is-unread" : ""}`}
                >
                  <span className="alert-popover-severity-icon" aria-hidden="true">
                    <SeverityIcon size={17} />
                  </span>
                  <div className="alert-popover-card-content">
                    <button
                      className="alert-popover-item"
                      onClick={() => openAlert(alert)}
                    >
                      <span className="alert-popover-head">
                        <Badge tone={alertSeverityTones[alert.severity]}>
                          {alertSeverityLabels[alert.severity]}
                        </Badge>
                        <small>{alertCategoryLabels[alert.category]}</small>
                        <time title={`Thời điểm phát hiện: ${alert.detectedAt}`}>
                          {alert.detectedAt}
                        </time>
                      </span>
                      <span className="alert-popover-title">
                        {alert.status === "Chưa đọc" && (
                          <i className="alert-unread-mark" aria-label="Chưa đọc" />
                        )}
                        {alert.title}
                      </span>
                      <span className="alert-popover-message">{alert.message}</span>
                    </button>
                    <div className="alert-popover-card-footer">
                      <span className="alert-popover-source">
                        {alert.source.label} · {alert.source.code}
                      </span>
                      <span className="alert-popover-actions">
                        {alert.status === "Chưa đọc" && (
                          <button
                            title="Đánh dấu đã đọc"
                            aria-label={`Đánh dấu đã đọc ${alert.source.code}`}
                            onClick={() => run(() => store.markAlertRead(alert.key))}
                          >
                            <Check size={14} />
                            <span>Đã đọc</span>
                          </button>
                        )}
                        {canAcknowledge(alert) && (
                          <button
                            className="alert-ack-action"
                            onClick={() => run(() => store.acknowledgeAlert(alert.key))}
                          >
                            Xác nhận
                          </button>
                        )}
                        <button
                          title={`Mở ${alert.source.label} ${alert.source.code}`}
                          aria-label={`Mở nguồn ${alert.source.code}`}
                          onClick={() => {
                            onClose();
                            navigate(alert.source.path);
                          }}
                        >
                          <ExternalLink size={14} />
                        </button>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="alert-popover-footer">
            <button
              className="popover-link"
              onClick={() => run(() => store.markAllAlertsRead())}
              disabled={summary.unread === 0}
            >
              Đánh dấu tất cả đã đọc
            </button>
            <button
              className="popover-link alert-view-all"
              onClick={() => {
                onClose();
                navigate("/alerts");
              }}
            >
              Xem tất cả
              <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
