import { PageSectionHeader, Input } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileText,
  MapPinned,
  PackageSearch,
} from "lucide-react";
import type {
  AnalyticsPeriod,
  DistributionRow,
  MetricBasis,
} from "@/domain/analytics/types";

const analyticsTabs = [
  {
    label: "Tổng quan tác nghiệp",
    path: "/analytics/operations",
    icon: BarChart3,
  },
  {
    label: "Sự cố & đáp ứng",
    path: "/analytics/incidents",
    icon: CalendarDays,
  },
  { label: "Nguồn lực", path: "/analytics/resources", icon: PackageSearch },
  { label: "Báo cáo", path: "/analytics/reports", icon: FileText },
];
export function AnalyticsHeader({
  active,
  navigate,
  title,
  description,
  actions,
}: {
  active: string;
  navigate: (path: string) => void;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageSectionHeader
        section="Phân tích & báo cáo tác nghiệp"
        title={title}
        description={description}
        icon={BarChart3}
        actions={actions}
        className="analytics-page-head"
      />
      <nav className="analytics-tabs" aria-label="Phân hệ phân tích">
        {analyticsTabs.map((item) => (
          <button
            key={item.path}
            className={active === item.path ? "active" : ""}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={15} />
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
export function AnalyticsFilters({
  value,
  onChange,
  incidents,
  asOf,
  source,
  showIncident = true,
}: {
  value: AnalyticsPeriod;
  onChange: (value: AnalyticsPeriod) => void;
  incidents: Array<{ id: string; code: string; title: string }>;
  asOf: string;
  source: string;
  showIncident?: boolean;
}) {
  return (
    <>
    <div className="analytics-filters">
      <label>
        <CalendarDays size={14} />
        <span>Từ ngày</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-label="Từ ngày, định dạng ngày tháng năm"
          pattern="\d{2}/\d{2}/\d{4}"
          value={value.from ?? ""}
          onChange={(event) =>
            onChange({ ...value, from: event.target.value || undefined })
          }
        />
      </label>
      <label>
        <CalendarDays size={14} />
        <span>Đến ngày</span>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-label="Đến ngày, định dạng ngày tháng năm"
          pattern="\d{2}/\d{2}/\d{4}"
          value={value.to ?? ""}
          onChange={(event) =>
            onChange({ ...value, to: event.target.value || undefined })
          }
        />
      </label>
      <label>
        <MapPinned size={14} />
        <span>Phạm vi</span>
        <UiSelect
          value={value.geographicScope ?? "Toàn bộ Hà Nội"}
          onChange={(event) =>
            onChange({ ...value, geographicScope: event.target.value })
          }
        >
          <option>Toàn bộ Hà Nội</option>
          <option>Tây Hồ, Hà Nội</option>
          <option>Hoàn Kiếm, Hà Nội</option>
          <option>Long Biên, Hà Nội</option>
          <option>Ba Đình, Hà Nội</option>
        </UiSelect>
      </label>
      {showIncident && (
        <label>
          <span>Sự cố</span>
          <UiSelect
            value={value.incidentId ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                incidentId: event.target.value || undefined,
              })
            }
          >
            <option value="">Tất cả sự cố</option>
            {incidents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.title}
              </option>
            ))}
          </UiSelect>
        </label>
      )}
    </div>
    <p className="analytics-provenance" role="note">
      <CalendarDays size={14} aria-hidden="true" />
      Mốc dữ liệu: <b>{asOf}</b>
      <span aria-hidden="true">·</span>
      Nguồn: <b>{source}</b>
      <span aria-hidden="true">·</span>
      Không phải dữ liệu thời gian thực.
    </p>
    </>
  );
}
export function Basis({ value }: { value: MetricBasis }) {
  return (
    <span
      className={`metric-basis ${value === "Ghi nhận" ? "recorded" : "derived"}`}
    >
      {value}
    </span>
  );
}
export function MetricCard({
  label,
  value,
  description,
  basis,
  unit,
}: {
  label: string;
  value: number | string;
  description: string;
  basis: MetricBasis;
  unit?: string;
}) {
  return (
    <article className="analytics-metric">
      <div>
        <span>{label}</span>
        <Basis value={basis} />
      </div>
      <strong>
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
        {unit && <small>{unit}</small>}
      </strong>
      <p>{description}</p>
    </article>
  );
}
export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`analytics-section ${className}`}>
      <header>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Distribution({
  rows,
  format,
}: {
  rows: DistributionRow[];
  format?: (value: number) => string;
}) {
  if (!rows.length)
    return (
      <p className="analytics-empty">Không có dữ liệu trong phạm vi đã chọn.</p>
    );
  const max = Math.max(...rows.map((item) => item.value), 1);
  return (
    <div className="analytics-bars">
      {rows.map((item) => (
        <div className="analytics-bar-row" key={item.label}>
          <div>
            <span>{item.label}</span>
            <b>
              {format ? format(item.value) : item.value.toLocaleString("vi-VN")}{" "}
              <small>{item.percentage}%</small>
            </b>
          </div>
          <div className="analytics-bar-track">
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
export function EntityLink({
  path,
  navigate,
  children,
}: {
  path: string;
  navigate: (path: string) => void;
  children: ReactNode;
}) {
  return (
    <button className="analytics-entity-link" onClick={() => navigate(path)}>
      {children}
      <ChevronRight size={14} />
    </button>
  );
}
const toneFor = (value: string) =>
  value.includes("Khẩn") ||
  value.includes("Quá tải") ||
  value.includes("Có sự cố")
    ? "danger"
    : value.includes("Cao") ||
        value.includes("Tạm") ||
        value.includes("Hạn chế")
      ? "warning"
      : value.includes("Hoàn") ||
          value.includes("Sẵn sàng") ||
          value.includes("Đã xác minh")
        ? "success"
        : "neutral";
export function StatusPill({ value }: { value: string }) {
  return <span className={`analytics-status ${toneFor(value)}`}>{value}</span>;
}
