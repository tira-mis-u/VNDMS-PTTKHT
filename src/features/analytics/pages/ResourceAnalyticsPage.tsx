import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  PackageOpen,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  getEvacuationAnalytics,
  getReliefAnalytics,
  getShelterAnalytics,
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
    referenceTime: "21/08/2026 10:45",
  });
  const data = store as AnalyticsData;
  const team = useMemo(() => getTeamAnalytics(data, filter), [data, filter]);
  const shelter = useMemo(
    () => getShelterAnalytics(data, filter),
    [data, filter],
  );
  const evacuation = useMemo(
    () => getEvacuationAnalytics(data, filter),
    [data, filter],
  );
  const relief = useMemo(
    () => getReliefAnalytics(data, filter),
    [data, filter],
  );
  return (
    <main className="analytics-page">
      <AnalyticsHeader
        active="/analytics/resources"
        navigate={navigate}
        title="Phân tích nguồn lực"
        description="Năng lực cứu hộ, điểm sơ tán, vận chuyển cứu trợ và tồn kho từ các phân hệ canonical."
      />
      <AnalyticsFilters
        value={filter}
        onChange={setFilter}
        incidents={store.incidents}
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
          label="Dân số đã sơ tán"
          value={evacuation.evacuated}
          basis="Ghi nhận"
          description={`${evacuation.remaining} người còn lại`}
        />
        <MetricCard
          label="Tồn khả dụng"
          value={relief.availableStock}
          basis="Dẫn xuất"
          description={`${relief.reservedStock} đơn vị đang giữ`}
        />
        <MetricCard
          label="Yêu cầu thiếu hàng"
          value={relief.shortStockRequests}
          basis="Dẫn xuất"
          description={`${relief.failedShipments} chuyến có sự cố`}
        />
      </div>
      <div className="analytics-layout-2">
        <Section
          title="Tải công việc đội cứu hộ"
          description="Assignment lấy từ Task, Incident, Evacuation và Shipment hiện hữu."
          action={<ShieldCheck size={17} />}
        >
          <div className="analytics-compact-table">
            <table>
              <thead>
                <tr>
                  <th>Đội</th>
                  <th>Task mở</th>
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
          description="Nhu cầu được dẫn xuất từ loại Task mở và hoạt động sơ tán chưa có đội."
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
        description="Occupancy là ghi nhận; utilization được dẫn xuất từ currentOccupancy/capacity."
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
          title="Hoạt động sơ tán"
          description={`${evacuation.completionRate}% hoàn thành · tiến độ trung bình ${evacuation.averageProgress}%`}
          action={<Truck size={17} />}
        >
          <div className="analytics-compact-table">
            <table>
              <thead>
                <tr>
                  <th>Hoạt động</th>
                  <th>Dân số</th>
                  <th>Tiến độ</th>
                  <th>Tuyến</th>
                </tr>
              </thead>
              <tbody>
                {evacuation.rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <EntityLink
                        path={`/incidents/${item.incidentId}`}
                        navigate={navigate}
                      >
                        {item.code}
                      </EntityLink>
                      <small>{item.status}</small>
                    </td>
                    <td>
                      {item.evacuated} / {item.evacuated + item.remaining}
                    </td>
                    <td>{item.progress}%</td>
                    <td>
                      <StatusPill value={item.routeStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section
          title="Áp lực kho"
          description={`${relief.lowStockItems} mặt hàng dưới ngưỡng · ${relief.distributionProgress}% chuyến hoàn tất`}
          action={<PackageOpen size={17} />}
        >
          <div className="analytics-list-rows warehouses">
            {relief.warehouseRows.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/relief/warehouses/${item.id}`)}
              >
                <div>
                  <b>
                    {item.code} · {item.name}
                  </b>
                  <span>{item.status}</span>
                </div>
                <span>
                  <strong>{item.utilization}%</strong> sử dụng
                </span>
                <span className={item.lowStock ? "danger-text" : ""}>
                  <strong>{item.lowStock}</strong> dưới ngưỡng
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>
      <Section
        title="Yêu cầu cứu trợ có áp lực"
        description="Shortage tính từ lượng đã duyệt trừ reservation chưa giải phóng."
      >
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Yêu cầu</th>
                <th>Ưu tiên</th>
                <th>Vòng đời</th>
                <th>Thiếu</th>
                <th>Giao nhận</th>
              </tr>
            </thead>
            <tbody>
              {relief.requestRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <EntityLink
                      path={`/relief/requests/${item.id}`}
                      navigate={navigate}
                    >
                      {item.code}
                    </EntityLink>
                  </td>
                  <td>
                    <StatusPill value={item.priority} />
                  </td>
                  <td>{item.status}</td>
                  <td className={item.shortage ? "danger-text" : ""}>
                    {item.shortage.toLocaleString("vi-VN")} đơn vị
                  </td>
                  <td>
                    {item.overdue ? (
                      <span className="danger-text">
                        <AlertTriangle size={13} /> Quá hạn
                      </span>
                    ) : (
                      "Trong hạn"
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
