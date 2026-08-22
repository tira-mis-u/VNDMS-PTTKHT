import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, Route, Users } from "lucide-react";
import {
  getIncidentAnalytics,
  getTaskAnalytics,
  type AnalyticsData,
} from "@/application/analytics/analyticsQueries";
import type { AnalyticsPeriod } from "@/domain/analytics/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  AnalyticsFilters,
  AnalyticsHeader,
  Basis,
  Distribution,
  EntityLink,
  MetricCard,
  Section,
  StatusPill,
} from "../components/AnalyticsCommon";
export function IncidentAnalyticsPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [filter, setFilter] = useState<AnalyticsPeriod>({
    geographicScope: "Toàn bộ Hà Nội",
    referenceTime: "21/08/2026 10:45",
  });
  const incident = useMemo(
    () => getIncidentAnalytics(store as AnalyticsData, filter),
    [store, filter],
  );
  const task = useMemo(
    () => getTaskAnalytics(store as AnalyticsData, filter),
    [store, filter],
  );
  return (
    <main className="analytics-page">
      <AnalyticsHeader
        active="/analytics/incidents"
        navigate={navigate}
        title="Phân tích sự cố & đáp ứng"
        description="Thời gian phản ứng được dẫn xuất từ dấu thời gian Incident, timeline và Task đã ghi nhận."
      />
      <AnalyticsFilters
        value={filter}
        onChange={setFilter}
        incidents={store.incidents}
      />
      <div className="analytics-metric-grid compact">
        <MetricCard
          label="Dân số bị ảnh hưởng"
          value={incident.affectedPopulation}
          basis="Ghi nhận"
          description="Tổng trên Incident trong phạm vi"
        />
        <MetricCard
          label="Đã sơ tán"
          value={incident.evacuatedPopulation}
          basis="Ghi nhận"
          description={`${incident.remainingPopulation.toLocaleString("vi-VN")} người còn lại trong phạm vi ảnh hưởng`}
        />
        <MetricCard
          label="Xác nhận trung bình"
          value={incident.averageAcknowledgementMinutes ?? "Chưa đủ dữ liệu"}
          unit={
            incident.averageAcknowledgementMinutes !== null
              ? " phút"
              : undefined
          }
          basis="Dẫn xuất"
          description="Tạo Incident → event đánh giá/xác nhận"
        />
        <MetricCard
          label="Điều phối trung bình"
          value={incident.averageDispatchMinutes ?? "Chưa đủ dữ liệu"}
          unit={incident.averageDispatchMinutes !== null ? " phút" : undefined}
          basis="Dẫn xuất"
          description="Xác nhận → event điều phối đầu tiên"
        />
        <MetricCard
          label="Sự cố quá hạn"
          value={incident.overdueCount}
          basis="Dẫn xuất"
          description="Đang mở quá ngưỡng 120 phút"
        />
        <MetricCard
          label="Tỷ lệ Task hoàn thành"
          value={task.completionRate}
          unit="%"
          basis="Dẫn xuất"
          description={`${task.overdueCount} nhiệm vụ quá hạn`}
        />
      </div>
      <div className="analytics-layout-3">
        <Section title="Theo mức độ">
          <Distribution rows={incident.bySeverity} />
        </Section>
        <Section title="Theo vòng đời">
          <Distribution rows={incident.byStatus} />
        </Section>
        <Section title="Theo khu vực">
          <Distribution rows={incident.byArea} />
        </Section>
      </div>
      <Section
        title="Thời gian xử lý sự cố"
        description="Dấu 'Dẫn xuất' cho biết số liệu được tính từ timeline; dấu thời gian thiếu được hiển thị ‘—’."
        action={<Basis value="Dẫn xuất" />}
      >
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Sự cố</th>
                <th>Khu vực</th>
                <th>Tạo → xác nhận</th>
                <th>Xác nhận → điều phối</th>
                <th>Điều phối → kết thúc</th>
                <th>Thời gian đáp ứng</th>
                <th>Ngoại lệ</th>
              </tr>
            </thead>
            <tbody>
              {incident.timings.map((item) => (
                <tr key={item.id}>
                  <td>
                    <EntityLink
                      path={`/incidents/${item.id}`}
                      navigate={navigate}
                    >
                      <span>
                        <b>{item.code}</b>
                        <small>{item.title}</small>
                      </span>
                    </EntityLink>
                  </td>
                  <td>{item.area}</td>
                  <td>{formatMinutes(item.acknowledgementMinutes)}</td>
                  <td>{formatMinutes(item.dispatchMinutes)}</td>
                  <td>{formatMinutes(item.resolutionMinutes)}</td>
                  <td>{formatMinutes(item.responseMinutes)}</td>
                  <td>
                    {item.overdue ? (
                      <StatusPill value="Quá hạn" />
                    ) : (
                      <span className="muted-cell">Trong ngưỡng</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="analytics-layout-2">
        <Section
          title="Khối lượng nhiệm vụ theo sự cố"
          description="Drill-down về Incident canonical."
        >
          <div className="analytics-list-rows">
            {task.byIncident.map((item) => (
              <button
                key={item.incidentId}
                onClick={() => navigate(`/incidents/${item.incidentId}`)}
              >
                <div>
                  <b>
                    {item.code} · {item.title}
                  </b>
                  <span>{item.total} nhiệm vụ</span>
                </div>
                <span>
                  <strong>{item.open}</strong> đang mở
                </span>
                <span className={item.overdue ? "danger-text" : ""}>
                  <strong>{item.overdue}</strong> quá hạn
                </span>
              </button>
            ))}
          </div>
        </Section>
        <Section
          title="Phân bố tiến độ Task"
          description="Giá trị progress ghi nhận trên Task canonical."
        >
          <Distribution rows={task.progressBands} />
          <div className="analytics-inline-facts">
            <span>
              <Users size={15} />
              <b>{task.unassignedCount}</b> chưa giao đội
            </span>
            <span>
              <Clock3 size={15} />
              <b>{task.averageCompletionMinutes ?? "—"}</b> phút hoàn thành TB
            </span>
            <span>
              <Route size={15} />
              <b>{task.dispatchToStartMinutes ?? "—"}</b> phút tới cập nhật đầu
              tiên
            </span>
          </div>
        </Section>
      </div>
      {incident.overdueCount > 0 && (
        <div className="analytics-method-note">
          <AlertTriangle size={16} />
          <div>
            <b>Lưu ý phương pháp</b>
            <p>
              Ngưỡng quá hạn sự cố trong Analytics là quy ước báo cáo 120 phút,
              không thay đổi lifecycle hay trạng thái Incident canonical.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
function formatMinutes(value: number | null) {
  return value === null ? "—" : `${value} phút`;
}
