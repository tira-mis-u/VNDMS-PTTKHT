import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  getAvailablePlaybooks,
  type PlaybookFilters,
} from "@/application/playbooks/playbookQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge } from "@/components/ui";
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <select
        aria-label={options[0]}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <ChevronDown size={12} />
    </label>
  );
}
export function PlaybookListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { playbooks, playbookExecutions } = useOperationalState();
  const [filters, setFilters] = useState<PlaybookFilters>({
    search: "",
    disasterType: "Tất cả loại thiên tai",
    status: "Tất cả trạng thái",
    geographicScope: "Tất cả phạm vi",
    sort: "Liên quan tác nghiệp",
  });
  const patch = (key: keyof PlaybookFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => getAvailablePlaybooks(playbooks, filters),
    [playbooks, filters],
  );
  const active = playbookExecutions.filter(
    (item) => item.status === "Đang hoạt động",
  ).length;
  return (
    <div className="workspace-content playbook-page">
      <div className="page-header playbook-header">
        <div>
          <div className="breadcrumbs">
            <span>Ứng phó</span>
            <ChevronRight size={13} />
            <b>Playbooks / SOP tác chiến</b>
          </div>
          <h1>Playbooks / SOP tác chiến</h1>
          <p>
            Quy trình chuẩn hóa gắn với Incident và hồ sơ nghiệp vụ canonical
          </p>
        </div>
      </div>
      <section className="playbook-status-strip">
        <span>
          <BookOpenCheck size={16} />
          <b>
            {playbooks.filter((item) => item.status === "Đã xuất bản").length}
          </b>{" "}
          playbook đã xuất bản
        </span>
        <span>
          <ShieldCheck size={16} />
          <b>{active}</b> execution đang hoạt động
        </span>
        <p>Sắp xếp theo mức độ và khả năng áp dụng tác nghiệp.</p>
      </section>
      <section className="relief-worklist">
        <div className="relief-filters">
          <label className="incident-search">
            <Search size={15} />
            <input
              placeholder="Tìm mã, tên hoặc mô tả playbook…"
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
            />
            {filters.search && (
              <button onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <Select
            value={filters.disasterType}
            onChange={(value) => patch("disasterType", value)}
            options={[
              "Tất cả loại thiên tai",
              ...new Set(playbooks.map((item) => item.disasterType)),
            ]}
          />
          <Select
            value={filters.status}
            onChange={(value) => patch("status", value)}
            options={["Tất cả trạng thái", "Nháp", "Đã xuất bản", "Lưu trữ"]}
          />
          <Select
            value={filters.geographicScope}
            onChange={(value) => patch("geographicScope", value)}
            options={[
              "Tất cả phạm vi",
              ...new Set(playbooks.map((item) => item.geographicScope)),
            ]}
          />
          <Select
            value={filters.sort}
            onChange={(value) => patch("sort", value)}
            options={["Liên quan tác nghiệp", "Cập nhật gần nhất"]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> playbook phù hợp
          </span>
          <span>Template và execution được quản lý riêng biệt</span>
        </div>
        <div className="playbook-table">
          <div className="playbook-table-head">
            <span>Playbook</span>
            <span>Loại thiên tai</span>
            <span>Phạm vi</span>
            <span>Phiên bản</span>
            <span>Trạng thái</span>
            <span>Số bước</span>
            <span>Thời lượng</span>
            <span>Cập nhật</span>
            <span />
          </div>
          {rows.map((item) => {
            const execution = playbookExecutions.find(
              (value) =>
                value.playbookId === item.id &&
                ["Đang hoạt động", "Tạm dừng"].includes(value.status),
            );
            return (
              <button
                className="playbook-row"
                key={item.id}
                onClick={() => navigate(`/playbooks/${item.id}`)}
              >
                <span>
                  <b>{item.code}</b>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
                <span>
                  {item.disasterType}
                  <small>Ngưỡng {item.severityThreshold}</small>
                </span>
                <span>{item.geographicScope}</span>
                <span>
                  <Badge tone="blue">v{item.version}</Badge>
                </span>
                <span>
                  <Badge
                    tone={
                      item.status === "Đã xuất bản"
                        ? "green"
                        : item.status === "Nháp"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {item.status}
                  </Badge>
                  {execution && (
                    <small className="execution-active">
                      {execution.status}
                    </small>
                  )}
                </span>
                <span>
                  <b>{item.steps.length}</b>
                  <small>
                    {item.steps.filter((step) => step.required).length} bắt buộc
                  </small>
                </span>
                <span>
                  <Clock3 size={12} />
                  {item.estimatedDuration}
                </span>
                <span>{item.updatedAt}</span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
