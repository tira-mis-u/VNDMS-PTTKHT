import { ArrowRight, Database, MapPinned, Waves } from "lucide-react";
import { PageSectionHeader } from "@/components/ui";
import { getOperationalSituation, type OperationalInsightsData } from "@/application/operations/operationalInsightsQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { HydrologyPanel } from "../components/HydrologyPanel";
import { CommandSectionTabs } from "@/components/navigation/GroupedSectionTabs";
import { SITUATION_WORKSPACE_PATH } from "@/app/routes/router";

export function OperationalSituationPage({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const situation = getOperationalSituation(store as OperationalInsightsData);
  return (
    <main className="workspace-content insights-page">
      <PageSectionHeader
        section="Điều hành"
        title="Tình hình tác nghiệp thiên tai"
        description={`Tổng hợp từ hồ sơ nghiệp vụ trong phạm vi được phân quyền. Thời điểm dữ liệu: ${situation.asOf}.`}
        icon={Waves}
      />
      <CommandSectionTabs active={SITUATION_WORKSPACE_PATH} navigate={navigate} />
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
      {/* Card "Diễn biến gần nhất" đã bỏ: dòng thời gian tác nghiệp sống trong
          Sổ trực ban (dòng hệ thống) — một nguồn diễn biến duy nhất, không nuôi
          hai feed trùng nhau. Giữ lại "Theo địa bàn" (góc nhìn không gian mà sổ
          trực ban không có). */}
      <section className="insights-card" aria-labelledby="area-title">
        <div className="insights-section-head"><div><h2 id="area-title">Tình hình theo địa bàn</h2><p>Địa danh lấy trực tiếp từ hồ sơ nghiệp vụ; không dựng vùng địa lý mới.</p></div><MapPinned size={18} /></div>
        <div className="area-list">
          {situation.areas.map((area) => <button key={area.area} onClick={() => navigate(area.incidentPath)}><span><b>{area.area}</b><small>{area.activeIncidents} sự cố · {area.urgentSos} SOS khẩn cấp · {area.pendingReports} phản ánh chờ đánh giá</small></span><ArrowRight size={15} /></button>)}
          {!situation.areas.length && <p className="insights-empty">Chưa có bản ghi tác nghiệp theo địa bàn trong phạm vi hiện tại.</p>}
        </div>
      </section>
      {/* Quan trắc thật (mưa ECMWF-IFS + dòng chảy GloFAS) thay cho khối
          "chưa có dữ liệu" trước đây. */}
      <HydrologyPanel />
    </main>
  );
}
