import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  BellRing,
  ChevronRight,
  Clock3,
  ExternalLink,
  Search,
  TriangleAlert,
  Truck,
  UserX,
  X,
} from "lucide-react";
import type { EvacuationOperation } from "@/domain/evacuations/types";
import {
  evacuationDetailPath,
  evacuationPriorityOptions,
  evacuationProgressOptions,
  evacuationRouteOptions,
  evacuationStatusOptions,
  filterAndSortEvacuations,
  getLinkedEvacuationAlerts,
  isActiveEvacuation,
  summarizeEvacuations,
  type EvacuationFilters,
} from "@/application/evacuations/evacuationQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, EmptyState, PageSectionHeader, Progress, Input } from "@/components/ui";

function statusTone(operation: EvacuationOperation) {
  if (operation.status === "Tạm dừng") return "amber";
  if (operation.status === "Hoàn thành") return "green";
  if (operation.status === "Đang triển khai") return "blue";
  if (operation.status === "Đã hủy") return "red";
  return "neutral";
}

function priorityTone(operation: EvacuationOperation) {
  if (operation.priority === "Khẩn cấp") return "red";
  if (operation.priority === "Cao") return "amber";
  if (operation.priority === "Trung bình") return "blue";
  return "neutral";
}

function routeTone(operation: EvacuationOperation) {
  if (operation.route.status === "Bị chặn") return "red";
  if (operation.route.status === "Hạn chế") return "amber";
  if (operation.route.status === "Đang dùng tuyến thay thế") return "blue";
  return "green";
}

function EvacuationSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="filter-select">
      <UiSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </UiSelect>
    </label>
  );
}

export function EvacuationListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const operations = store.evacuationOperations;
  const [filters, setFilters] = useState<EvacuationFilters>({
    search: "",
    status: "Tất cả trạng thái",
    priority: "Tất cả ưu tiên",
    route: "Tất cả tuyến",
    progress: "Tất cả tiến độ",
    sort: "Ưu tiên điều hành",
  });
  const patch = (key: keyof EvacuationFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterAndSortEvacuations(operations, filters),
    [operations, filters],
  );
  const summary = summarizeEvacuations(operations);
  const incidentById = useMemo(
    () => new Map(store.incidents.map((item) => [item.id, item])),
    [store.incidents],
  );
  const shelterById = useMemo(
    () => new Map(store.shelters.map((item) => [item.id, item])),
    [store.shelters],
  );
  return (
    <div className="workspace-content evac-page">
      <PageSectionHeader
        section="Ứng phó"
        title="Hoạt động sơ tán"
        description="Theo dõi hoạt động sơ tán dân cư trong phạm vi phân quyền từ dữ liệu nghiệp vụ chính thức."
        icon={Truck}
      />

      <section className="evac-summary-grid" aria-label="Tổng quan sơ tán">
        <div className="evac-summary-card">
          <span className="evac-summary-icon tone-blue">
            <Truck size={17} />
          </span>
          <div>
            <small>Đang mở</small>
            <b>
              {summary.active}
              <span className="evac-summary-total">/{summary.total}</span>
            </b>
            <p>Hoạt động chưa kết thúc</p>
          </div>
        </div>
        <div className={summary.delayed ? "evac-summary-card danger" : "evac-summary-card"}>
          <span className="evac-summary-icon tone-red">
            <TriangleAlert size={17} />
          </span>
          <div>
            <small>Trễ hoặc bị chặn</small>
            <b>{summary.delayed}</b>
            <p>Tạm dừng hoặc tuyến bị chặn</p>
          </div>
        </div>
        <div className={summary.noTeam ? "evac-summary-card warn" : "evac-summary-card"}>
          <span className="evac-summary-icon tone-amber">
            <UserX size={17} />
          </span>
          <div>
            <small>Chưa có đội</small>
            <b>{summary.noTeam}</b>
            <p>Cần phân công đội phụ trách</p>
          </div>
        </div>
        <div className="evac-summary-card">
          <span className="evac-summary-icon tone-green">
            <Clock3 size={17} />
          </span>
          <div>
            <small>Đã sơ tán</small>
            <b>
              {summary.evacuated.toLocaleString("vi-VN")}
              <span className="evac-summary-total">
                /{summary.estimated.toLocaleString("vi-VN")}
              </span>
            </b>
            <p>Người trong phạm vi phân quyền</p>
          </div>
        </div>
      </section>

      <section className="content-section evac-queue">
        <div className="evac-toolbar">
          <label className="ui-search incident-search evac-search">
            <Search size={14} />
            <Input
              aria-label="Tìm kiếm hoạt động sơ tán"
              placeholder="Tìm theo mã, khu vực nguồn, tuyến, đội, điểm đến…"
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
            />
            {filters.search && (
              <button aria-label="Xóa tìm kiếm" onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <EvacuationSelect
            label="Lọc theo trạng thái"
            value={filters.status}
            onChange={(value) => patch("status", value)}
            options={["Tất cả trạng thái", ...evacuationStatusOptions]}
          />
          <EvacuationSelect
            label="Lọc theo mức ưu tiên"
            value={filters.priority}
            onChange={(value) => patch("priority", value)}
            options={["Tất cả ưu tiên", ...evacuationPriorityOptions]}
          />
          <EvacuationSelect
            label="Lọc theo tình trạng tuyến"
            value={filters.route}
            onChange={(value) => patch("route", value)}
            options={["Tất cả tuyến", ...evacuationRouteOptions]}
          />
          <EvacuationSelect
            label="Lọc theo tiến độ"
            value={filters.progress}
            onChange={(value) => patch("progress", value)}
            options={evacuationProgressOptions}
          />
          <EvacuationSelect
            label="Sắp xếp"
            value={filters.sort}
            onChange={(value) =>
              patch("sort", value as EvacuationFilters["sort"])
            }
            options={[
              "Ưu tiên điều hành",
              "Tiến độ tăng dần",
              "Hoàn thành dự kiến",
            ]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> hoạt động phù hợp
          </span>
          <span>Ưu tiên hoạt động trễ, quá hạn hoặc cần can thiệp trước</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Không có hoạt động sơ tán phù hợp"
            description="Không có hoạt động sơ tán nào khớp bộ lọc trong phạm vi phân quyền hiện tại. Hoạt động mới được tạo từ chi tiết điểm sơ tán hoặc kế hoạch ứng phó."
          />
        ) : (
          <div className="evac-list">
            {rows.map((operation) => {
              const linkedAlerts = getLinkedEvacuationAlerts(
                store.alerts,
                operation,
              );
              const active = isActiveEvacuation(operation);
              return (
                <article
                  className={`evac-row ${active ? "" : "evac-row-closed"}`}
                  key={operation.id}
                >
                  <div
                    className="evac-row-main"
                    onClick={() => navigate(evacuationDetailPath(operation))}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        navigate(evacuationDetailPath(operation));
                    }}
                  >
                    <div className="evac-row-head">
                      <Badge tone={statusTone(operation)}>{operation.status}</Badge>
                      <Badge tone={priorityTone(operation)}>{operation.priority}</Badge>
                      <Badge tone={routeTone(operation)}>
                        {operation.route.status}
                      </Badge>
                      {linkedAlerts.length > 0 && (
                        <span
                          className="evac-alert-chip"
                          title={`${linkedAlerts.length} cảnh báo liên quan`}
                        >
                          <BellRing size={11} />
                          {linkedAlerts.length}
                        </span>
                      )}
                      <time>Hoàn thành dự kiến {operation.expectedCompletion}</time>
                    </div>
                    <h3>
                      {operation.id} · {operation.sourceArea}
                    </h3>
                    <div className="evac-row-progress">
                      <Progress
                        value={operation.progress}
                        tone={
                          operation.route.status === "Bị chặn"
                            ? "amber"
                            : operation.progress === 100
                              ? "green"
                              : "blue"
                        }
                      />
                      <span>
                        {operation.evacuatedPopulation.toLocaleString("vi-VN")}/
                        {operation.estimatedPopulation.toLocaleString("vi-VN")} người ·{" "}
                        {operation.progress}%
                      </span>
                    </div>
                    <div className="evac-row-meta">
                      <span>
                        Sự cố: <b>{operation.incidentId}</b>
                        {incidentById.get(operation.incidentId)
                          ? ` · ${incidentById.get(operation.incidentId)?.title}`
                          : ""}
                      </span>
                      <span>
                        Điểm tiếp nhận:{" "}
                        <b>
                          {shelterById.get(operation.destinationShelterId)?.name ??
                            operation.destinationShelterId}
                        </b>
                      </span>
                      <span>
                        Đội phụ trách:{" "}
                        <b>{operation.assignedTeamId ?? "Chưa phân công"}</b>
                      </span>
                      <span>Cập nhật {operation.updatedAt}</span>
                    </div>
                  </div>
                  <div className="evac-row-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Mở điểm tiếp nhận ${operation.destinationShelterId}`}
                      onClick={() =>
                        navigate(`/shelters/${operation.destinationShelterId}`)
                      }
                    >
                      <ExternalLink size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Xem chi tiết hoạt động"
                      onClick={() => navigate(evacuationDetailPath(operation))}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
