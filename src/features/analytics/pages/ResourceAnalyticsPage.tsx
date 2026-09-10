import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";
import {
  getCitizenReportAnalytics,
  getShelterAnalytics,
  getTaskAnalytics,
  getTeamAnalytics,
  type AnalyticsData,
} from "@/application/analytics/analyticsQueries";
import type { AnalyticsPeriod } from "@/domain/analytics/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  AnalyticsFilters,
  AnalyticsHeader,
  EntityLink,
  MetricCard,
  Section,
  StatusPill,
} from "../components/AnalyticsCommon";
export function ResourceAnalyticsPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [filter, setFilter] = useState<AnalyticsPeriod>({
    geographicScope: "Toàn bộ Hà Nội",
    referenceTime: store.metadata.asOf,
  });
  const data = store as AnalyticsData;
  const team = useMemo(() => getTeamAnalytics(data, filter), [data, filter]);
  const shelter = useMemo(
    () => getShelterAnalytics(data, filter),
    [data, filter],
  );
  const tasks = useMemo(() => getTaskAnalytics(data, filter), [data, filter]);
  const reports = useMemo(
    () => getCitizenReportAnalytics(data, filter),
    [data, filter],
  );
  return (
    <main className="analytics-page">
      <AnalyticsHeader
        active="/analytics/resources"
        navigate={navigate}
        title="Phân tích nguồn lực"
        description="Năng lực cứu hộ, điểm sơ tán, kết quả chờ xác nhận và phản ánh của người dân từ các phân hệ nghiệp vụ hiện hành."
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
          label="Đội đang triển khai"
          value={`${team.deployed}/${team.total}`}
          basis="Dẫn xuất"
          description={`${team.available} đội có thể điều phối`}
        />
        <MetricCard
          label="Mức sử dụng lực lượng"
          value={team.utilizationRate}
          unit="%"
          basis="Dẫn xuất"
          description={`${team.unavailable} đội không sẵn sàng`}
        />
        <MetricCard
          label="Sử dụng điểm sơ tán"
          value={shelter.utilizationRate}
          unit="%"
          basis="Dẫn xuất"
          description={`${shelter.overloaded} điểm quá tải`}
        />
        <MetricCard
          label="Nhiệm vụ chờ xác nhận"
          value={tasks.awaitingReviewCount}
          basis="Ghi nhận"
          description={`${tasks.rejectedReviewCount} lần bị từ chối kết quả`}
        />
        <MetricCard
          label="Phân công lại"
          value={tasks.reassignmentCount}
          basis="Dẫn xuất"
          description="Số lần đổi đội có lý do"
        />
        <MetricCard
          label="Phản ánh chờ đánh giá"
          value={reports.pending}
          basis="Ghi nhận"
          description={`${reports.valid} hợp lệ · ${reports.duplicate} trùng`}
        />
      </div>
      <div className="analytics-layout-2">
        <Section
          title="Tải công việc đội cứu hộ"
          description="Phân công lấy từ nhiệm vụ và sự cố hiện hữu."
          action={<ShieldCheck size={17} />}
        >
          <div className="analytics-compact-table">
            <table>
              <thead>
                <tr>
                  <th>Đội</th>
                  <th>Nhiệm vụ đang mở</th>
                  <th>Phân công hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {team.workload.map((item) => (
                  <tr key={item.teamId}>
                    <td>
                      <EntityLink
                        path={`/teams/${item.teamId}`}
                        navigate={navigate}
                      >
                        <span>
                          <b>{item.code}</b>
                          <small>{item.name}</small>
                        </span>
                      </EntityLink>
                    </td>
                    <td>{item.activeTasks}</td>
                    <td>{item.assignment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section
          title="Nhu cầu năng lực"
          description="Nhu cầu được dẫn xuất từ loại Nhiệm vụ đang mở."
        >
          <div className="analytics-capability-list">
            {team.capability.slice(0, 8).map((item) => (
              <div key={item.capability}>
                <b>{item.capability}</b>
                <span>
                  <em>{item.available}</em> sẵn sàng
                </span>
                <span>
                  <em>{item.deployed}</em> triển khai
                </span>
                <span
                  className={item.demand > item.available ? "danger-text" : ""}
                >
                  <em>{item.demand}</em> nhu cầu
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Section
        title="Điểm sơ tán & sức chứa"
        description="Số người đang lưu trú là dữ liệu ghi nhận; tỷ lệ sử dụng được tính từ số người hiện có và sức chứa."
        action={<Building2 size={17} />}
      >
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Điểm sơ tán</th>
                <th>Khu vực</th>
                <th>Đang tiếp nhận</th>
                <th>Dự phòng</th>
                <th>Sức chứa</th>
                <th>Sử dụng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {shelter.rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <EntityLink
                      path={`/shelters/${item.id}`}
                      navigate={navigate}
                    >
                      {item.code} · {item.name}
                    </EntityLink>
                  </td>
                  <td>{item.area}</td>
                  <td>{item.occupancy}</td>
                  <td>{item.reserved}</td>
                  <td>{item.capacity}</td>
                  <td>
                    <div className="table-progress">
                      <span
                        style={{ width: `${Math.min(item.utilization, 100)}%` }}
                      />
                      <b>{item.utilization}%</b>
                    </div>
                  </td>
                  <td>
                    <StatusPill value={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="analytics-layout-2">
        <Section
          title="Nhiệm vụ theo sự cố"
          description={`${tasks.completionRate}% hoàn thành · ${tasks.overdueCount} quá hạn`}
          action={<ClipboardCheck size={17} />}
        >
          <div className="analytics-compact-table">
            <table>
              <thead>
                <tr>
                  <th>Sự cố</th>
                  <th>Tổng</th>
                  <th>Đang mở</th>
                  <th>Quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {tasks.byIncident.map((item) => (
                  <tr key={item.incidentId}>
                    <td>
                      <EntityLink
                        path={`/incidents/${item.incidentId}`}
                        navigate={navigate}
                      >
                        {item.code}
                      </EntityLink>
                      <small>{item.title}</small>
                    </td>
                    <td>{item.total}</td>
                    <td>{item.open}</td>
                    <td className={item.overdue ? "danger-text" : ""}>
                      {item.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section
          title="Phản ánh theo loại"
          description={`${reports.total} phản ánh trong kỳ · ${reports.averageReviewMinutes ?? "—"} phút đánh giá trung bình`}
          action={<MessageSquareWarning size={17} />}
        >
          <div className="analytics-list-rows warehouses">
            {reports.byCategory.map((item) => (
              <button key={item.label} onClick={() => navigate("/reports")}>
                <div>
                  <b>{item.label}</b>
                  <span>{item.percentage}% tổng phản ánh</span>
                </div>
                <span>
                  <strong>{item.value}</strong> phản ánh
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>
      <Section
        title="Phản ánh chờ đánh giá"
        description="Thời gian chờ tính từ lúc người dân gửi đến thời điểm tham chiếu; chỉ phản ánh chưa được cán bộ đánh giá mới có thời gian chờ."
      >
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Phản ánh</th>
                <th>Loại</th>
                <th>Khu vực</th>
                <th>Trạng thái</th>
                <th>Chờ đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {reports.rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <EntityLink path="/reports" navigate={navigate}>
                      {item.code}
                    </EntityLink>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.area}</td>
                  <td>
                    <StatusPill value={item.status} />
                  </td>
                  <td>
                    {item.waitingMinutes !== null && item.waitingMinutes > 120 ? (
                      <span className="danger-text">
                        <AlertTriangle size={13} /> {item.waitingMinutes} phút
                      </span>
                    ) : item.waitingMinutes !== null ? (
                      `${item.waitingMinutes} phút`
                    ) : (
                      "Đã đánh giá"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
