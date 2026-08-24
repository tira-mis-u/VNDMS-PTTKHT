import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  Search,
  X,
} from "lucide-react";
import {
  filterRecoveryProjects,
  type ProjectFilters,
} from "@/application/recovery/recoveryQueries";
import {
  budgetUsage,
  isBudgetRisk,
  isProjectOverdue,
} from "@/domain/recovery/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, PageSectionHeader, Progress, Input } from "@/components/ui";
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <UiSelect value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </UiSelect>
    </label>
  );
}
const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1e9)} tỷ ₫`;
export function RecoveryProjectListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { recoveryProjects, incidents } = useOperationalState();
  const [filters, setFilters] = useState<ProjectFilters>({
    search: "",
    status: "Tất cả trạng thái",
    priority: "Tất cả ưu tiên",
    category: "Tất cả nhóm dự án",
    area: "Tất cả khu vực",
    incident: "Tất cả sự cố",
    owner: "Tất cả phụ trách",
    overdue: "Tất cả tiến độ",
  });
  const patch = (key: keyof ProjectFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterRecoveryProjects(recoveryProjects, filters),
    [recoveryProjects, filters],
  );
  return (
    <div className="workspace-content recovery-page">
      <PageSectionHeader
        section="Phục hồi"
        title="Dự án khôi phục"
        description="Triển khai từ đánh giá đã xác minh tới mốc tiến độ, nguồn lực và hoàn thành."
        icon={Clock3}
        className="recovery-header"
        actions={
          <Button variant="secondary" onClick={() => navigate("/recovery/assessments")}>
            Đánh giá thiệt hại
          </Button>
        }
      />
      <section className="recovery-strip">
        <span
          className={
            recoveryProjects.some((item) => isProjectOverdue(item))
              ? "danger"
              : ""
          }
        >
          <Clock3 size={16} />
          <b>
            {recoveryProjects.filter((item) => isProjectOverdue(item)).length}
          </b>{" "}
          dự án quá hạn
        </span>
        <span className={recoveryProjects.some(isBudgetRisk) ? "warning" : ""}>
          <AlertTriangle size={16} />
          <b>{recoveryProjects.filter(isBudgetRisk).length}</b> rủi ro ngân sách
        </span>
        <p>Ưu tiên quá hạn → mức ưu tiên → ngân sách → tiến độ thấp.</p>
      </section>
      <section className="relief-worklist">
        <div className="relief-filters">
          <label className="ui-search incident-search">
            <Search size={15} />
            <Input
              value={filters.search}
              onChange={(e) => patch("search", e.target.value)}
              placeholder="Tìm mã, tên, khu vực hoặc phụ trách…"
            />
            {filters.search && (
              <button onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <Select
            value={filters.status}
            onChange={(v) => patch("status", v)}
            options={[
              "Tất cả trạng thái",
              "Đề xuất",
              "Đã phê duyệt",
              "Đang thực hiện",
              "Tạm dừng",
              "Hoàn thành",
              "Từ chối",
              "Đã hủy",
            ]}
          />
          <Select
            value={filters.priority}
            onChange={(v) => patch("priority", v)}
            options={[
              "Tất cả ưu tiên",
              "Khẩn cấp",
              "Cao",
              "Trung bình",
              "Thấp",
            ]}
          />
          <Select
            value={filters.category}
            onChange={(v) => patch("category", v)}
            options={[
              "Tất cả nhóm dự án",
              ...new Set(recoveryProjects.map((item) => item.category)),
            ]}
          />
          <Select
            value={filters.area}
            onChange={(v) => patch("area", v)}
            options={[
              "Tất cả khu vực",
              ...new Set(recoveryProjects.map((item) => item.geographicScope)),
            ]}
          />
          <Select
            value={filters.incident}
            onChange={(v) => patch("incident", v)}
            options={["Tất cả sự cố", ...incidents.map((item) => item.id)]}
          />
          <Select
            value={filters.owner}
            onChange={(v) => patch("owner", v)}
            options={[
              "Tất cả phụ trách",
              ...new Set(recoveryProjects.map((item) => item.owner)),
            ]}
          />
          <Select
            value={filters.overdue}
            onChange={(v) => patch("overdue", v)}
            options={["Tất cả tiến độ", "Quá hạn", "Đúng hạn"]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> dự án
          </span>
          <span>Tiến độ được tính từ các mốc công việc và nhiệm vụ chính thức</span>
        </div>
        <div className="recovery-project-table">
          <div className="project-table-head">
            <span>Dự án</span>
            <span>Ưu tiên</span>
            <span>Trạng thái</span>
            <span>Khu vực</span>
            <span>Ngân sách</span>
            <span>Đã chi</span>
            <span>Tiến độ</span>
            <span>Hạn</span>
            <span>Phụ trách</span>
            <span />
          </div>
          {rows.map((item) => (
            <button
              className="project-row"
              key={item.id}
              onClick={() => navigate(`/recovery/projects/${item.id}`)}
            >
              <span>
                <b>
                  {item.code} · {item.name}
                </b>
                <small>
                  {item.category} · {item.incidentId}
                </small>
              </span>
              <span>
                <small className="project-mobile-label">Ưu tiên</small>
                <Badge
                  tone={
                    item.priority === "Khẩn cấp"
                      ? "red"
                      : item.priority === "Cao"
                        ? "amber"
                        : "blue"
                  }
                >
                  {item.priority}
                </Badge>
              </span>
              <span>
                <small className="project-mobile-label">Trạng thái</small>
                <Badge
                  tone={
                    item.status === "Hoàn thành"
                      ? "green"
                      : item.status === "Tạm dừng"
                        ? "amber"
                        : item.status === "Từ chối" || item.status === "Đã hủy"
                          ? "neutral"
                          : "blue"
                  }
                >
                  {item.status}
                </Badge>
              </span>
              <span>
                <small className="project-mobile-label">Khu vực</small>
                {item.geographicScope}
              </span>
              <span>
                <small className="project-mobile-label">Ngân sách</small>
                <b>{money(item.approvedBudget || item.estimatedBudget)}</b>
                <small>{budgetUsage(item)}% đã sử dụng</small>
              </span>
              <span className={isBudgetRisk(item) ? "budget-risk" : ""}>
                <small className="project-mobile-label">Đã chi</small>
                <b>{money(item.spentBudget)}</b>
              </span>
              <span>
                <small className="project-mobile-label">Tiến độ</small>
                <b>{item.progress}%</b>
                <Progress
                  value={item.progress}
                  tone={item.progress >= 80 ? "green" : "blue"}
                />
              </span>
              <span className={isProjectOverdue(item) ? "overdue" : ""}>
                <small className="project-mobile-label">Ngày mục tiêu</small>
                <Clock3 size={12} />
                {item.targetDate}
                <small>{isProjectOverdue(item) ? "Quá hạn" : "Mục tiêu"}</small>
              </span>
              <span>
                <small className="project-mobile-label">Phụ trách</small>
                <b>{item.owner || "Chưa có đơn vị phụ trách"}</b>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
