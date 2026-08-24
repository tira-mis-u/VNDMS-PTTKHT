import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Database } from "lucide-react";
import { PageSectionHeader } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import { getOperationalTrend, type OperationalInsightsData, type TrendMetric } from "@/application/operations/operationalInsightsQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

const labels: Record<TrendMetric, string> = { incidents: "Sự cố được ghi nhận", alerts: "Cảnh báo tác nghiệp", sos: "Yêu cầu SOS", tasks: "Nhiệm vụ được tạo", evacuations: "Hoạt động sơ tán", relief: "Yêu cầu cứu trợ", events: "Sự kiện xử lý" };
export function OperationalTrendsPage({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const [metric, setMetric] = useState<TrendMetric>("incidents");
  const result = useMemo(() => getOperationalTrend(store as OperationalInsightsData, metric), [store, metric]);
  const max = Math.max(1, ...result.points.map((point) => point.value));
  return (
    <main className="workspace-content insights-page">
      <PageSectionHeader section="Phân tích" title="Xu hướng từ dữ liệu tác nghiệp" description={`Chuỗi số liệu chỉ được nhóm từ dấu thời gian của hồ sơ nguồn. Không nội suy, dự báo hoặc tạo đường cơ sở giả. Thời điểm dữ liệu: ${result.asOf}.`} icon={Activity} />
      <section className="trend-toolbar" aria-label="Bộ lọc xu hướng"><label><span>Chỉ số</span><UiSelect aria-label="Chọn chỉ số xu hướng" value={metric} onChange={(event) => setMetric(event.target.value as TrendMetric)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</UiSelect></label><div><Database size={15} /><span>{result.points.reduce((sum, point) => sum + point.value, 0)} bản ghi nguồn hợp lệ</span></div></section>
      {result.invalidSources.length > 0 && <div className="insights-notice warning"><AlertTriangle size={17} /><div><b>Dấu thời gian không hợp lệ đã bị loại</b><p>{result.invalidSources.length} bản ghi không được đưa vào chuỗi số liệu và không được tự sửa.</p></div></div>}
      {!result.sufficient ? <section className="insights-unavailable"><Activity size={20} /><div><h2>Chưa đủ dữ liệu để xác định xu hướng</h2><p>Cần ít nhất hai kỳ có dấu thời gian hợp lệ. Hiện có {result.points.length} kỳ cho chỉ số “{labels[metric]}”.</p><small>Không hiển thị phần trăm tăng hoặc giảm khi chưa có đường cơ sở.</small></div></section> : <section className="trend-chart" aria-labelledby="trend-title"><div className="insights-section-head"><div><h2 id="trend-title">{labels[metric]} theo ngày</h2><p>Mỗi cột có thể mở danh sách hồ sơ nguồn.</p></div></div><div className="trend-bars" role="list" aria-label={`${labels[metric]} theo ngày`}>{result.points.map((point) => <div className="trend-bar-row" role="listitem" key={point.period}><time>{point.period}</time><div className="trend-track"><span style={{ width: `${Math.max(5, point.value / max * 100)}%` }} /></div><b>{point.value}</b><button onClick={() => point.sources[0] && navigate(point.sources[0].path)} aria-label={`Mở nguồn của kỳ ${point.period}`}>Nguồn <ArrowRight size={13} /></button></div>)}</div><details className="trend-sources"><summary>Đối chiếu nguồn dữ liệu</summary>{result.points.flatMap((point) => point.sources.map((source) => <button key={`${point.period}-${source.entityId}-${source.timestamp}`} onClick={() => navigate(source.path)}><span>{source.entityType} · {source.entityId}</span><time>{source.timestamp}</time><ArrowRight size={13} /></button>))}</details></section>}
    </main>
  );
}
