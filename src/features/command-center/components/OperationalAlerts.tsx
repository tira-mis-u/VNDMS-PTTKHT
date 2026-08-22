import { ChevronRight, ExternalLink } from "lucide-react";
import {
  alertCategoryLabels,
  alertSeverityLabels,
  alertSeverityTones,
} from "@/domain/alerts/types";
import {
  alertDetailPath,
  summarizeAlerts,
} from "@/application/alerts/alertQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, SectionHeader } from "@/components/ui";

/**
 * Bảng cảnh báo tác nghiệp của Command Center — đọc cùng một
 * Authorized Alert View với trang Cảnh báo và header; không có dataset riêng.
 */
export function OperationalAlerts({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const alerts = useOperationalState().alerts;
  const summary = summarizeAlerts(alerts);
  const top = alerts.slice(0, 5);
  return (
    <section
      className="content-section cc-operational-alerts"
      aria-label="Cảnh báo tác nghiệp"
    >
      <SectionHeader
        title="Cảnh báo tác nghiệp"
        description={`${summary.unread} chưa đọc · ${summary.pendingAcknowledgement} cần xác nhận · Suy ra từ canonical state`}
        action="Mở trung tâm thông báo"
        onAction={() => navigate("/alerts")}
      />
      {alerts.length === 0 ? (
        <p className="cc-alerts-empty">
          Không có cảnh báo tác nghiệp nào trong phạm vi phân quyền hiện tại.
        </p>
      ) : (
        <>
          <div className="cc-alert-chips">
            {summary.byCategory.map((entry) => (
              <span className="cc-alert-chip" key={entry.category}>
                {entry.label} <b>{entry.count}</b>
              </span>
            ))}
          </div>
          <div className="cc-alert-list">
            {top.map((alert) => (
              <div className="cc-alert-item" key={alert.key}>
                <span
                  className={`cc-severity-line cc-severity-${alertSeverityTones[alert.severity]}`}
                />
                <div
                  className="cc-alert-item-body"
                  onClick={() => navigate(alertDetailPath(alert))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      navigate(alertDetailPath(alert));
                  }}
                >
                  <div className="cc-alert-item-head">
                    <Badge tone={alertSeverityTones[alert.severity]}>
                      {alertSeverityLabels[alert.severity]}
                    </Badge>
                    <small>{alertCategoryLabels[alert.category]}</small>
                    <b>{alert.source.code}</b>
                    {alert.status === "Chưa đọc" && (
                      <i className="alert-unread-mark" aria-label="Chưa đọc" />
                    )}
                  </div>
                  <p>{alert.title}</p>
                  <small>
                    {alert.detectedAt} · {alert.status}
                  </small>
                </div>
                <div className="cc-alert-item-actions">
                  <button
                    title={`Mở ${alert.source.label} ${alert.source.code}`}
                    aria-label={`Mở nguồn ${alert.source.code}`}
                    onClick={() => navigate(alert.source.path)}
                  >
                    <ExternalLink size={14} />
                  </button>
                  <ChevronRight size={15} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
