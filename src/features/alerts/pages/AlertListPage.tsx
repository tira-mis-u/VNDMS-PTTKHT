import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  BellRing,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  alertCategoryLabels,
  alertConditionLabels,
  alertSeverityLabels,
  alertSeverityTones,
  type OperationalAlert,
} from "@/domain/alerts/types";
import {
  alertStatusOptions,
  alertTimeOptions,
  filterAndSortAlerts,
  summarizeAlerts,
  type AlertFilters,
  alertDetailPath,
} from "@/application/alerts/alertQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, EmptyState, PageSectionHeader, Input } from "@/components/ui";


function AlertSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <UiSelect
        aria-label={options[0]}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </UiSelect>
    </label>
  );
}

export function AlertListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const alerts = store.alerts;
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
  const [filters, setFilters] = useState<AlertFilters>({
    search: "",
    severity: "Tất cả mức độ",
    category: "Tất cả nhóm",
    status: "Tất cả trạng thái",
    time: "Tất cả thời gian",
  });
  const patch = (key: keyof AlertFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterAndSortAlerts(alerts, filters),
    [alerts, filters],
  );
  const summary = summarizeAlerts(alerts);
  const canAcknowledge = (alert: OperationalAlert) =>
    alert.requiresAcknowledgement &&
    !alert.acknowledgedAt &&
    store.can("alert_acknowledge", alert.geographicScope);
  return (
    <div className="workspace-content alerts-page">
      <PageSectionHeader
        section="Quản lý và điều hành"
        title="Trung tâm cảnh báo tác nghiệp"
        description="Cảnh báo được suy ra trực tiếp từ dữ liệu nghiệp vụ thống nhất trong phạm vi phân quyền hiện tại."
        icon={BellRing}
        actions={
          <Button
            variant="secondary"
            onClick={() => run(() => store.markAllAlertsRead())}
            disabled={summary.unread === 0}
          >
            <CheckCheck size={15} />
            <span>Đánh dấu tất cả đã đọc</span>
          </Button>
        }
      />

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}
      <section className="alert-summary-grid" aria-label="Tổng quan cảnh báo">
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-blue">
            <BellRing size={17} />
          </span>
          <div>
            <small>Đang hiệu lực</small>
            <b>{summary.total}</b>
            <p>Cảnh báo suy ra từ dữ liệu nghiệp vụ</p>
          </div>
        </div>
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-amber">
            <Clock3 size={17} />
          </span>
          <div>
            <small>Chưa đọc</small>
            <b>{summary.unread}</b>
            <p>Cần rà soát trong ca trực</p>
          </div>
        </div>
        <div className={summary.critical ? "alert-summary-card danger" : "alert-summary-card"}>
          <span className="alert-summary-icon tone-red">
            <ShieldAlert size={17} />
          </span>
          <div>
            <small>Mức khẩn cấp</small>
            <b>{summary.critical}</b>
            <p>Ưu tiên xử lý ngay</p>
          </div>
        </div>
        <div
          className={
            summary.pendingAcknowledgement
              ? "alert-summary-card danger"
              : "alert-summary-card"
          }
        >
          <span className="alert-summary-icon tone-red">
            <Check size={17} />
          </span>
          <div>
            <small>Chờ xác nhận</small>
            <b>{summary.pendingAcknowledgement}</b>
            <p>Cần xác nhận đã tiếp nhận</p>
          </div>
        </div>
      </section>

      <section className="content-section alert-queue">
        <div className="alerts-toolbar">
          <label className="ui-search incident-search alerts-search">
            <Search size={14} />
            <Input
              aria-label="Tìm kiếm cảnh báo"
              placeholder="Tìm theo tiêu đề, nội dung, mã nguồn…"
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
            />
            {filters.search && (
              <button
                aria-label="Xóa tìm kiếm"
                onClick={() => patch("search", "")}
              >
                <X size={13} />
              </button>
            )}
          </label>
          <AlertSelect
            value={filters.severity}
            onChange={(value) => patch("severity", value)}
            options={[
              "Tất cả mức độ",
              "Khẩn cấp",
              "Cao",
              "Trung bình",
              "Thấp",
            ]}
          />
          <AlertSelect
            value={filters.category}
            onChange={(value) => patch("category", value)}
            options={["Tất cả nhóm", ...Object.values(alertCategoryLabels)]}
          />
          <AlertSelect
            value={filters.status}
            onChange={(value) => patch("status", value)}
            options={["Tất cả trạng thái", ...alertStatusOptions]}
          />
          <AlertSelect
            value={filters.time}
            onChange={(value) => patch("time", value)}
            options={alertTimeOptions}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> cảnh báo phù hợp
          </span>
          <span>Sắp xếp theo mức độ nghiêm trọng và thời điểm ghi nhận</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Không có cảnh báo phù hợp"
            description="Không có cảnh báo tác nghiệp nào khớp bộ lọc trong phạm vi phân quyền hiện tại."
          />
        ) : (
          <div className="alert-list">
            {rows.map((alert) => (
              <article
                className={`alert-row alert-severity-${alert.severity} ${
                  alert.status === "Chưa đọc" ? "alert-unread" : ""
                }`}
                key={alert.key}
              >
                <div
                  className="alert-row-main"
                  onClick={() => navigate(alertDetailPath(alert))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      navigate(alertDetailPath(alert));
                  }}
                >
                  <div className="alert-row-head">
                    <Badge tone={alertSeverityTones[alert.severity]}>
                      {alertSeverityLabels[alert.severity]}
                    </Badge>
                    <span className="alert-row-category">
                      {alertCategoryLabels[alert.category]}
                    </span>
                    <span className="alert-row-condition">
                      {alertConditionLabels[alert.condition]}
                    </span>
                    <time>{alert.detectedAt}</time>
                  </div>
                  <h3>{alert.title}</h3>
                  <p>{alert.message}</p>
                  <div className="alert-row-meta">
                    <span>
                      Nguồn: <b>{alert.source.code}</b> · {alert.source.label}
                    </span>
                    <span>
                      Trạng thái: <b>{alert.status}</b>
                    </span>
                    {alert.acknowledgedBy && (
                      <span>
                        Xác nhận bởi: <b>{alert.acknowledgedBy}</b> ·{" "}
                        {alert.acknowledgedAt}
                      </span>
                    )}
                  </div>
                </div>
                <div className="alert-row-actions">
                  {canAcknowledge(alert) && (
                    <Button
                      size="sm"
                      onClick={() => run(() => store.acknowledgeAlert(alert.key))}
                    >
                      Xác nhận
                    </Button>
                  )}
                  {alert.status === "Chưa đọc" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => run(() => store.markAlertRead(alert.key))}
                    >
                      Đánh dấu đã đọc
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => run(() => store.markAlertUnread(alert.key))}
                    >
                      Đánh dấu chưa đọc
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`Mở ${alert.source.label} ${alert.source.code}`}
                    onClick={() => navigate(alert.source.path)}
                  >
                    <ExternalLink size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Xem chi tiết cảnh báo"
                    onClick={() => navigate(alertDetailPath(alert))}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
