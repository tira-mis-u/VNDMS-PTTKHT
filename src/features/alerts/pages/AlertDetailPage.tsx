import { useState } from "react";
import {
  BellOff,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  alertCategoryLabels,
  alertConditionLabels,
  alertSeverityLabels,
  alertSeverityTones,
} from "@/domain/alerts/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button } from "@/components/ui";

export function AlertDetailPage({
  alertKey,
  navigate,
}: {
  alertKey: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [error, setError] = useState("");
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
  const alert = store.alerts.find((item) => item.key === alertKey);
  if (!alert)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <BellOff size={24} />
          <h2>Không tìm thấy cảnh báo</h2>
          <p>
            Cảnh báo không tồn tại, điều kiện tạo cảnh báo đã được xử lý hoặc
            nằm ngoài phạm vi truy cập của tài khoản hiện tại.
          </p>
          <Button variant="secondary" onClick={() => navigate("/alerts")}>
            Quay lại trung tâm thông báo
          </Button>
        </div>
      </div>
    );
  const events = store.alertEvents.filter(
    (event) => event.alertKey === alert.key,
  );
  const unread = alert.status === "Chưa đọc";
  return (
    <div className="workspace-content alerts-page alert-detail-page">
      <div className="page-header alerts-header">
        <div>
          <div className="breadcrumbs">
            <span>Quản lý &amp; điều hành</span>
            <ChevronRight size={13} />
            <span>Cảnh báo</span>
            <ChevronRight size={13} />
            <b>{alert.source.code}</b>
          </div>
          <h1>{alert.title}</h1>
          <p>{alertConditionLabels[alert.condition]}</p>
        </div>
        <div className="alerts-header-actions">
          <Badge tone={alertSeverityTones[alert.severity]}>
            {alertSeverityLabels[alert.severity]}
          </Badge>
          <Badge tone={alert.acknowledgedAt ? "green" : unread ? "amber" : "blue"}>
            {alert.status}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}
      <section className={`alert-detail-hero alert-severity-${alert.severity}`}>
        <div className="alert-detail-message">
          <p>{alert.message}</p>
          <div className="alert-detail-meta">
            <span>
              <Clock3 size={13} />
              Ghi nhận: <b>{alert.detectedAt}</b>
            </span>
            {alert.geographicScope && (
              <span>
                <MapPin size={13} />
                {alert.geographicScope}
              </span>
            )}
            <span>
              Nhóm: <b>{alertCategoryLabels[alert.category]}</b>
            </span>
          </div>
        </div>
        <div className="alert-detail-actions">
          {alert.requiresAcknowledgement && !alert.acknowledgedAt && (
            <Button
              onClick={() => run(() => store.acknowledgeAlert(alert.key))}
              disabled={!store.can("alert_acknowledge", alert.geographicScope)}
            >
              <Check size={15} />
              <span>Xác nhận đã tiếp nhận</span>
            </Button>
          )}
          {unread ? (
            <Button
              variant="secondary"
              onClick={() => run(() => store.markAlertRead(alert.key))}
            >
              Đánh dấu đã đọc
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => run(() => store.markAlertUnread(alert.key))}
            >
              Đánh dấu chưa đọc
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => navigate(alert.source.path)}
          >
            <ExternalLink size={15} />
            <span>
              Mở {alert.source.label} {alert.source.code}
            </span>
          </Button>
        </div>
      </section>

      <div className="alert-detail-grid">
        <section className="content-section alert-detail-facts">
          <h2>Thông tin cảnh báo</h2>
          <dl>
            <div>
              <dt>Mã cảnh báo</dt>
              <dd className="alert-key-cell">{alert.key}</dd>
            </div>
            <div>
              <dt>Nguồn tác nghiệp</dt>
              <dd>
                {alert.source.label} <b>{alert.source.code}</b>
              </dd>
            </div>
            <div>
              <dt>Điều kiện suy ra</dt>
              <dd>{alertConditionLabels[alert.condition]}</dd>
            </div>
            <div>
              <dt>Yêu cầu xác nhận</dt>
              <dd>{alert.requiresAcknowledgement ? "Có" : "Không"}</dd>
            </div>
            <div>
              <dt>Trạng thái hiện tại</dt>
              <dd>{alert.status}</dd>
            </div>
            {alert.readAt && (
              <div>
                <dt>Đã đọc lúc</dt>
                <dd>{alert.readAt}</dd>
              </div>
            )}
            {alert.acknowledgedAt && (
              <div>
                <dt>Xác nhận</dt>
                <dd>
                  {alert.acknowledgedBy} · {alert.acknowledgedAt}
                </dd>
              </div>
            )}
          </dl>
          <p className="alert-detail-note">
            Cảnh báo này được suy ra từ trạng thái canonical của{" "}
            {alert.source.label.toLowerCase()} và sẽ tự hết hiệu lực khi điều
            kiện nghiệp vụ không còn đúng — không phải bản ghi tĩnh.
          </p>
        </section>
        <section className="content-section alert-detail-timeline">
          <h2>Nhật ký cảnh báo</h2>
          {events.length === 0 ? (
            <p className="alert-timeline-empty">
              Chưa có hoạt động nào được ghi nhận cho cảnh báo này.
            </p>
          ) : (
            <ul className="alert-timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <span className="alert-timeline-dot" />
                  <div>
                    <p>{event.message}</p>
                    <small>
                      {event.timestamp} · {event.actor} · {event.source}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
