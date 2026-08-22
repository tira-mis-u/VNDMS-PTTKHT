import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock3,
  MapPin,
  Radio,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  filterAndSortSos,
  type SosQueueFilters,
} from "@/application/sos/sosQueries";
import { isSosWaitingTooLong } from "@/domain/sos/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge } from "@/components/ui";
const priorityTone = (priority: string) =>
  priority.startsWith("P1")
    ? "red"
    : priority.startsWith("P2")
      ? "amber"
      : priority.startsWith("P3")
        ? "blue"
        : "neutral";
const statusTone = (status: string) =>
  status === "Đã đóng" || status === "Đã xử lý"
    ? "green"
    : status === "Từ chối" || status === "Hủy"
      ? "neutral"
      : status === "Không liên lạc được"
        ? "red"
        : "blue";
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
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={12} />
    </label>
  );
}
export function SosListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { sosRequests, incidents } = useOperationalState();
  const [filters, setFilters] = useState<SosQueueFilters>({
    search: "",
    priority: "Tất cả ưu tiên",
    status: "Tất cả trạng thái",
    verification: "Tất cả xác minh",
    area: "Tất cả khu vực",
    assignment: "Tất cả phân công",
    incident: "Tất cả sự cố",
    time: "Tất cả thời gian",
  });
  const patch = (key: keyof SosQueueFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterAndSortSos(sosRequests, filters),
    [sosRequests, filters],
  );
  const areas = [
    ...new Set(
      sosRequests.map((sos) => sos.location.administrativeArea.split(",")[0]),
    ),
  ];
  const p1 = sosRequests.filter(
    (sos) =>
      sos.priority.startsWith("P1") &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(sos.status),
  ).length;
  const unverified = sosRequests.filter(
    (sos) =>
      sos.verificationStatus !== "Đã xác minh" &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(sos.status),
  ).length;
  const unassigned = sosRequests.filter(
    (sos) =>
      !sos.assignedTeamId &&
      ["Đã xác minh", "Đã điều phối"].includes(sos.status),
  ).length;
  return (
    <div className="workspace-content sos-page">
      <div className="page-header sos-header">
        <div>
          <div className="breadcrumbs">
            <span>Ứng phó</span>
            <ChevronRight size={13} />
            <b>SOS</b>
          </div>
          <h1>SOS & Yêu cầu khẩn cấp</h1>
          <p>
            Tiếp nhận, xác minh, phân loại và điều phối cứu hộ từ một hàng đợi
            tác nghiệp thống nhất
          </p>
        </div>
      </div>
      <section className="sos-queue-summary">
        <div className={p1 ? "danger" : ""}>
          <AlertTriangle size={16} />
          <span>
            <b>{p1}</b> SOS P1 đang mở
          </span>
        </div>
        <div>
          <ShieldCheck size={16} />
          <span>
            <b>{unverified}</b> chờ xác minh
          </span>
        </div>
        <div>
          <Radio size={16} />
          <span>
            <b>{unassigned}</b> chưa giao đội
          </span>
        </div>
        <p>
          Ưu tiên mặc định: P1/P2 → chờ lâu → chưa xác minh → chưa phân công.
        </p>
      </section>
      <section className="sos-worklist">
        <div className="sos-filters">
          <label className="incident-search">
            <Search size={15} />
            <input
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
              placeholder="Tìm mã SOS, người báo, số liên hệ hoặc địa chỉ…"
            />
            {filters.search && (
              <button onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <Select
            value={filters.priority}
            onChange={(value) => patch("priority", value)}
            options={[
              "Tất cả ưu tiên",
              "P1 — Khẩn cấp",
              "P2 — Cao",
              "P3 — Trung bình",
              "P4 — Thấp",
            ]}
          />
          <Select
            value={filters.status}
            onChange={(value) => patch("status", value)}
            options={[
              "Tất cả trạng thái",
              "Mới tiếp nhận",
              "Đang xác minh",
              "Đã xác minh",
              "Đã điều phối",
              "Đang cứu hộ",
              "Đã xử lý",
              "Đã đóng",
              "Từ chối",
              "Không liên lạc được",
              "Hủy",
            ]}
          />
          <Select
            value={filters.verification}
            onChange={(value) => patch("verification", value)}
            options={[
              "Tất cả xác minh",
              "Chưa xác minh",
              "Đang xác minh",
              "Đã xác minh",
              "Không hợp lệ",
            ]}
          />
          <Select
            value={filters.area}
            onChange={(value) => patch("area", value)}
            options={["Tất cả khu vực", ...areas]}
          />
          <Select
            value={filters.assignment}
            onChange={(value) => patch("assignment", value)}
            options={["Tất cả phân công", "Đã giao đội", "Chưa giao đội"]}
          />
          <Select
            value={filters.incident}
            onChange={(value) => patch("incident", value)}
            options={[
              "Tất cả sự cố",
              "Chưa liên kết",
              ...incidents.map((incident) => incident.id),
            ]}
          />
          <Select
            value={filters.time}
            onChange={(value) => patch("time", value)}
            options={["Tất cả thời gian", "Hôm nay", "Đang chờ lâu"]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> yêu cầu trong hàng đợi
          </span>
          <span>Sắp xếp theo mức cần can thiệp</span>
        </div>
        <div className="sos-table">
          <div className="sos-table-head">
            <span>Yêu cầu khẩn cấp</span>
            <span>Ưu tiên</span>
            <span>Trạng thái</span>
            <span>Người bị ảnh hưởng</span>
            <span>Xác minh</span>
            <span>Liên kết tác nghiệp</span>
            <span>Cập nhật</span>
            <span />
          </div>
          {rows.map((sos) => (
            <button
              className={`sos-row ${sos.priority.startsWith("P1") ? "sos-critical" : ""}`}
              key={sos.id}
              onClick={() => navigate(`/sos/${sos.id}`)}
            >
              <span className="sos-primary">
                <b>
                  {sos.code} · {sos.location.name}
                </b>
                <small>
                  <MapPin size={11} />
                  {sos.location.administrativeArea}
                </small>
                <small>{sos.description}</small>
              </span>
              <span className="sos-priority">
                <Badge tone={priorityTone(sos.priority)}>{sos.priority}</Badge>
                <small>{sos.triageReasons[0]}</small>
              </span>
              <span>
                <Badge tone={statusTone(sos.status)}>{sos.status}</Badge>
                {isSosWaitingTooLong(sos) && (
                  <small className="waiting">
                    <Clock3 size={11} />
                    Chờ xử lý lâu
                  </small>
                )}
              </span>
              <span className="sos-people">
                <Users size={13} />
                <b>{sos.peopleAtRisk}</b>
                <small>
                  {sos.injuredCount} bị thương ·{" "}
                  {sos.childrenCount + sos.elderlyCount + sos.disabledCount} dễ
                  tổn thương
                </small>
              </span>
              <span className="sos-verification">
                <b>{sos.verificationStatus}</b>
                <small>{sos.reporter.source}</small>
              </span>
              <span className="sos-links">
                <b>{sos.linkedIncidentId ?? "Chưa có Incident"}</b>
                <small>
                  {sos.assignedTeamId ?? "Chưa giao đội"}
                  {sos.linkedTaskId ? ` · ${sos.linkedTaskId}` : ""}
                </small>
              </span>
              <span className="sos-time">
                <b>{sos.receivedAt.split(" ")[1]}</b>
                <small>Nhận {sos.receivedAt.split(" ")[0]}</small>
                <small>Cập nhật {sos.lastUpdatedAt.split(" ")[1]}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
