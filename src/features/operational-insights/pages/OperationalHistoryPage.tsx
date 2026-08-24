import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Database, History, Search } from "lucide-react";
import { Input, PageSectionHeader } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import { getOperationalHistory } from "@/application/operations/operationalInsightsQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export function OperationalHistoryPage({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [area, setArea] = useState("");
  const types = useMemo(() => [...new Set(store.incidents.map((item) => item.type))].sort((a, b) => a.localeCompare(b, "vi")), [store.incidents]);
  const result = getOperationalHistory(store, { from: from || undefined, to: to || undefined, type: type || undefined, severity: severity || undefined, area: area || undefined });
  return (
    <main className="workspace-content insights-page">
      <PageSectionHeader section="Phân tích" title="Lịch sử sự cố trong dữ liệu vận hành hiện tại" description={`Chỉ gồm sự cố đã đóng trong lát cắt dữ liệu hiện tại, không phải kho lịch sử thiên tai nhiều năm. Thời điểm dữ liệu: ${result.asOf}.`} icon={History} />
      <section className="insights-filters" aria-label="Bộ lọc lịch sử sự cố">
        <label><span>Từ ngày</span><Input aria-label="Từ ngày lịch sử" inputMode="numeric" placeholder="dd/mm/yyyy" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>Đến ngày</span><Input aria-label="Đến ngày lịch sử" inputMode="numeric" placeholder="dd/mm/yyyy" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label><span>Loại sự cố</span><UiSelect aria-label="Lọc loại sự cố" value={type} onChange={(event) => setType(event.target.value)}><option value="">Tất cả loại</option>{types.map((item) => <option key={item}>{item}</option>)}</UiSelect></label>
        <label><span>Mức độ</span><UiSelect aria-label="Lọc mức độ sự cố" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">Tất cả mức độ</option>{["Khẩn cấp", "Cao", "Trung bình", "Thấp"].map((item) => <option key={item}>{item}</option>)}</UiSelect></label>
        <label className="history-area"><span>Địa bàn</span><div className="input-with-icon"><Search size={14} /><Input aria-label="Lọc địa bàn lịch sử" placeholder="Nhập địa danh" value={area} onChange={(event) => setArea(event.target.value)} /></div></label>
      </section>
      {result.invalidRecords.length > 0 && <div className="insights-notice warning"><CalendarDays size={17} /><div><b>Có dữ liệu thời gian không hợp lệ</b><p>{result.invalidRecords.length} hồ sơ đã bị loại khỏi kết quả; hệ thống không tự sửa dấu thời gian.</p></div></div>}
      <section className="history-list" aria-label="Danh sách lịch sử sự cố">
        {result.rows.map((row) => <article key={row.id} className="history-record"><header><div><span>{row.code}</span><h2>{row.title}</h2><p>{row.type} · {row.severity} · {row.area}</p></div><button onClick={() => navigate(row.path)}>Mở hồ sơ <ArrowRight size={14} /></button></header><dl><div><dt>Bắt đầu</dt><dd>{row.createdAt}</dd></div><div><dt>Đóng hồ sơ</dt><dd>{row.closedAt}</dd></div><div><dt>Nguồn</dt><dd>{row.source}</dd></div><div><dt>Trạng thái</dt><dd>{row.status}</dd></div></dl><div className="history-timeline"><h3>Diễn biến hồ sơ</h3>{row.events.length ? <ol>{row.events.map((event, index) => <li key={`${event.timestamp}-${index}`}><time>{event.timestamp}</time><p>{event.message}</p><small><Database size={12} />{event.source}</small></li>)}</ol> : <p className="insights-empty">Chưa có sự kiện có dấu thời gian hợp lệ cho hồ sơ này.</p>}</div></article>)}
        {!result.rows.length && <div className="insights-unavailable"><History size={20} /><div><h2>Chưa có dữ liệu lịch sử phù hợp</h2><p>Chưa có dữ liệu lịch sử sự cố trong tập dữ liệu vận hành hiện tại hoặc không có hồ sơ khớp bộ lọc.</p></div></div>}
      </section>
    </main>
  );
}
