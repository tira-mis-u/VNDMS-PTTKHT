import { AlertTriangle, ArrowRight, Clock3, Database, MapPinned, Waves } from "lucide-react";
import { PageSectionHeader } from "@/components/ui";
import { getOperationalSituation, type OperationalInsightsData } from "@/application/operations/operationalInsightsQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function OperationalSituationPage({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const situation = getOperationalSituation(store as OperationalInsightsData);
  return (
    <main className="workspace-content insights-page">
      <PageSectionHeader
        section="Quản lý & điều hành"
        title="Tình hình tác nghiệp thiên tai"
        description={`Tổng hợp từ hồ sơ nghiệp vụ trong phạm vi được phân quyền. Thời điểm dữ liệu: ${situation.asOf}.`}
        icon={Waves}
      />
      {situation.simulationActive && (
        <div className="insights-notice simulation"><AlertTriangle size={17} /><div><b>Dữ liệu mô phỏng được tách biệt</b><p>{situation.simulationLabel}</p></div></div>
      )}
      <section aria-labelledby="situation-summary-title">
        <div className="insights-section-head"><div><h2 id="situation-summary-title">Tổng quan tình hình</h2><p>Mỗi chỉ số dẫn tới hồ sơ nguồn tương ứng.</p></div></div>
        <div className="situation-metrics">
          {situation.metrics.map((item) => (
            <button key={item.id} className="situation-metric" onClick={() => navigate(item.path)}>
              <span>{item.label}</span><strong>{item.value.toLocaleString("vi-VN")}</strong><p>{item.description}</p>
              <small><Database size={13} />{item.source} · {item.asOf}</small><ArrowRight size={16} className="metric-arrow" />
            </button>
          ))}
        </div>
      </section>
      <div className="insights-columns">
        <section className="insights-card" aria-labelledby="area-title">
          <div className="insights-section-head"><div><h2 id="area-title">Tình hình theo địa bàn</h2><p>Địa danh lấy trực tiếp từ hồ sơ nghiệp vụ; không dựng vùng địa lý mới.</p></div><MapPinned size={18} /></div>
          <div className="area-list">
            {situation.areas.map((area) => <button key={area.area} onClick={() => navigate(area.incidentPath)}><span><b>{area.area}</b><small>{area.activeIncidents} sự cố · {area.urgentSos} SOS khẩn cấp · {area.evacuations} hoạt động sơ tán</small></span><ArrowRight size={15} /></button>)}
            {!situation.areas.length && <p className="insights-empty">Chưa có bản ghi tác nghiệp theo địa bàn trong phạm vi hiện tại.</p>}
          </div>
        </section>
        <section className="insights-card" aria-labelledby="event-title">
          <div className="insights-section-head"><div><h2 id="event-title">Diễn biến gần nhất</h2><p>Chỉ hiển thị sự kiện có dấu thời gian hợp lệ.</p></div><Clock3 size={18} /></div>
          <ol className="situation-events">
            {situation.events.map((event, index) => <li key={`${event.entityId}-${event.timestamp}-${index}`}><button onClick={() => navigate(event.path)}><time>{event.timestamp}</time><b>{event.entityType} · {event.entityId}</b><p>{event.message}</p><small>{event.source}</small></button></li>)}
            {!situation.events.length && <li className="insights-empty">Chưa có diễn biến hợp lệ trong nguồn dữ liệu hiện tại.</li>}
          </ol>
        </section>
      </div>
      <section className="insights-unavailable" aria-labelledby="observation-title">
        <Waves size={20} /><div><h2 id="observation-title">Quan trắc và dự báo</h2><p>Chưa có dữ liệu quan trắc hoặc dự báo trong nguồn dữ liệu hiện tại.</p><small>Hệ thống không sử dụng dữ liệu mô phỏng để thay thế quan trắc thực tế.</small></div>
      </section>
    </main>
  );
}
