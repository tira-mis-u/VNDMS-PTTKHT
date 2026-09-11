import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
    referenceTime: store.metadata.asOf,
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
        description="Các mốc thời gian lấy từ nhật ký xử lý của từng sự cố và nhiệm vụ."
      />
      <AnalyticsFilters
        value={filter}
        onChange={setFilter}
        incidents={store.incidents}
        asOf={store.metadata.asOf}
        source={store.metadata.source}
      />
      <div className="analytics-metric-grid compact">
        <MetricCard
          label="Dân số bị ảnh hưởng"
          value={incident.affectedPopulation}
          basis="Ghi nhận"
          description="Tổng trên các sự cố trong phạm vi"
        />
        <MetricCard
          label="Người đã cứu hộ (SOS đã đóng)"
          value={incident.rescuedPopulation}
          basis="Ghi nhận"
          description={`${incident.pendingPopulation.toLocaleString("vi-VN")} người trong SOS còn mở hoặc chờ duyệt đóng`}
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
          description="Từ lúc tạo sự cố đến khi có người xác nhận"
        />
        <MetricCard
          label="Điều phối trung bình"
          value={incident.averageDispatchMinutes ?? "Chưa đủ dữ liệu"}
          unit={incident.averageDispatchMinutes !== null ? " phút" : undefined}
          basis="Dẫn xuất"
          description="Từ lúc xác nhận đến khi điều đội đầu tiên"
        />
        <MetricCard
          label="Sự cố quá hạn"
          value={incident.overdueCount}
          basis="Dẫn xuất"
          description="Sự cố đã mở quá 2 giờ mà chưa đóng"
        />
        <MetricCard
          label="Tỷ lệ nhiệm vụ hoàn thành"
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
        description="Số có dấu “Dẫn xuất” là số hệ thống tự tính từ nhật ký; ô nào thiếu dữ liệu hiện “—”."
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
                      <span className="muted-cell">Đúng hạn</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section
        title="Phân bố tiến độ nhiệm vụ"
        description="Theo % tiến độ từng nhiệm vụ báo về. Khối lượng nhiệm vụ theo từng sự cố xem ở tab “Nguồn lực”."
        action={
          <EntityLink path="/analytics/resources" navigate={navigate}>
            Sang tab Nguồn lực
          </EntityLink>
        }
      >
        <Distribution rows={task.progressBands} />
      </Section>
      {incident.overdueCount > 0 && (
        <div className="analytics-method-note">
          <AlertTriangle size={16} />
          <div>
            <b>Lưu ý phương pháp</b>
            <p>
              Trang này tạm coi sự cố mở quá 2 giờ là quá hạn để tiện theo dõi;
              cách tính này không làm đổi trạng thái thật của sự cố.
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
