import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CircleGauge,
  ClipboardList,
  Radio,
  RotateCcw,
} from "lucide-react";
import {
  getOperationalSummary,
  getRecoveryAnalytics,
  getSosAnalytics,
  getTaskAnalytics,
  type AnalyticsData,
} from "@/application/analytics/analyticsQueries";
import { getAlertAnalytics } from "@/application/alerts/alertQueries";
import type { AnalyticsPeriod } from "@/domain/analytics/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  AnalyticsFilters,
  AnalyticsHeader,
  Distribution,
  EntityLink,
  MetricCard,
  Section,
  StatusPill,
} from "../components/AnalyticsCommon";
export function OperationalAnalyticsPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [filter, setFilter] = useState<AnalyticsPeriod>({
    geographicScope: "Toàn bộ Hà Nội",
    referenceTime: "21/08/2026 10:45",
  });
  const data = store as AnalyticsData;
  const summary = useMemo(
    () => getOperationalSummary(data, filter),
    [data, filter],
  );
  const tasks = useMemo(() => getTaskAnalytics(data, filter), [data, filter]);
  const sos = useMemo(() => getSosAnalytics(data, filter), [data, filter]);
  const recovery = useMemo(
    () => getRecoveryAnalytics(data, filter),
    [data, filter],
  );
  const alertAnalytics = useMemo(
    () => getAlertAnalytics(store.alerts),
    [store.alerts],
  );
  return (
    <main className="analytics-page">
      <AnalyticsHeader
        active="/analytics/operations"
        navigate={navigate}
        title="Tổng quan tác nghiệp"
        description="Tổng hợp có truy vết từ dữ liệu điều hành canonical; không mô phỏng dữ liệu thời gian thực."
        actions={
          <button
            className="analytics-secondary"
            onClick={() =>
              setFilter({
                geographicScope: "Toàn bộ Hà Nội",
                referenceTime: "21/08/2026 10:45",
              })
            }
          >
            <RotateCcw size={14} />
            Đặt lại
          </button>
        }
      />
      <AnalyticsFilters
        value={filter}
        onChange={setFilter}
        incidents={store.incidents}
      />
      <div className="analytics-metric-grid">
        {summary.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            {...metric}
            unit={metric.label === "Sức chứa điểm sơ tán" ? "%" : undefined}
          />
        ))}
      </div>
      <div className="analytics-layout-2">
        <Section
          title="Cảnh báo tác nghiệp"
          description="Aggregation từ Authorized Alert View; Analytics không phải nguồn cảnh báo."
          action={
            <span className="analytics-section-count">
              <BellRing size={14} />
              {alertAnalytics.unresolved} chưa giải quyết
            </span>
          }
        >
          <Distribution
            rows={alertAnalytics.bySeverity.map((row) => ({
              label: row.label,
              value: row.count,
              percentage: store.alerts.length
                ? Math.round((row.count / store.alerts.length) * 100)
                : 0,
            }))}
          />
          <div className="analytics-inline-facts">
            <span>
              <b>{alertAnalytics.byCategory.length}</b> nhóm có cảnh báo
            </span>
            <span>
              <b>
                {alertAnalytics.acknowledgementRate === null
                  ? "—"
                  : `${alertAnalytics.acknowledgementRate}%`}
              </b>{" "}
              tỷ lệ xác nhận
            </span>
            <span className="analytics-entity-link">
              <EntityLink path="/alerts" navigate={navigate}>
                Mở trung tâm thông báo
              </EntityLink>
            </span>
          </div>
        </Section>
        <Section
          title="Ngoại lệ cần xử lý"
          description="Xếp theo mức độ khẩn; chọn bản ghi để xử lý ở phân hệ gốc."
          action={
            <span className="analytics-section-count">
              <AlertTriangle size={14} />
              {summary.exceptions.length}
            </span>
          }
        >
          <div className="analytics-exception-list">
            {summary.exceptions.slice(0, 9).map((item) => (
              <button
                key={`${item.module}-${item.entityId}`}
                onClick={() => navigate(item.path)}
              >
                <span
                  className={`exception-mark ${item.severity === "Khẩn cấp" ? "danger" : "warning"}`}
                />
                <div>
                  <b>
                    {item.entityCode} · {item.title}
                  </b>
                  <p>{item.reason}</p>
                </div>
                <StatusPill value={item.module} />
                <ArrowRight size={15} />
              </button>
            ))}
            {!summary.exceptions.length && (
              <p className="analytics-empty">
                Không có ngoại lệ trong phạm vi đã chọn.
              </p>
            )}
          </div>
        </Section>
        <Section
          title="Nhiệm vụ theo trạng thái"
          description="Trạng thái ghi nhận; tỷ lệ hoàn thành và quá hạn được dẫn xuất."
        >
          <Distribution rows={tasks.byStatus} />
          <div className="analytics-inline-facts">
            <span>
              <ClipboardList size={15} />
              <b>{tasks.completionRate}%</b> hoàn thành
            </span>
            <span>
              <AlertTriangle size={15} />
              <b>{tasks.overdueCount}</b> quá hạn
            </span>
            <span>
              <CircleGauge size={15} />
              <b>{tasks.dispatchToStartMinutes ?? "—"}</b> phút điều phối → bắt
              đầu
            </span>
          </div>
        </Section>
      </div>
      <div className="analytics-layout-2">
        <Section
          title="Điểm nghẽn SOS"
          description="Chờ xác minh, chưa phân công hoặc Task chưa được giao."
        >
          <div className="analytics-compact-table">
            <table>
              <thead>
                <tr>
                  <th>SOS</th>
                  <th>Ưu tiên</th>
                  <th>Chờ</th>
                  <th>Điểm nghẽn</th>
                </tr>
              </thead>
              <tbody>
                {sos.rows.slice(0, 6).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <EntityLink path={`/sos/${item.id}`} navigate={navigate}>
                        {item.code}
                      </EntityLink>
                    </td>
                    <td>
                      <StatusPill value={item.priority} />
                    </td>
                    <td>{item.waitingMinutes} phút</td>
                    <td>{item.bottleneck ?? "Đang xử lý theo luồng"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="analytics-inline-facts">
            <span>
              <Radio size={15} />
              <b>{sos.unassigned}</b> chưa phân công
            </span>
            <span>
              <b>{sos.incidentConversionRate}%</b> chuyển thành Incident
            </span>
          </div>
        </Section>
        <Section
          title="Phục hồi cần chú ý"
          description="Tiến độ, ngân sách và milestone từ Recovery canonical."
        >
          <div className="analytics-project-list">
            {recovery.projectRows.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/recovery/projects/${item.id}`)}
              >
                <div>
                  <b>
                    {item.code} · {item.name}
                  </b>
                  <span>
                    {item.progress}% tiến độ · {item.budgetUtilization}% ngân
                    sách
                  </span>
                </div>
                <div className="mini-progress">
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                {item.delayedMilestones > 0 && (
                  <em>{item.delayedMilestones} mốc quá hạn</em>
                )}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
