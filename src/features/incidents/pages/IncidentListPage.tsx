import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Filter,
  MapPin,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { IncidentSeverity } from "@/domain/incidents/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress } from "@/components/ui";

const tabs = ["Tất cả", "Mới", "Đang xử lý", "Khẩn cấp", "Đã kiểm soát"];
const severityTone = (severity: string) =>
  severity === "Khẩn cấp"
    ? "red"
    : severity === "Cao"
      ? "amber"
      : severity === "Thấp"
        ? "green"
        : "blue";
const statusTone = (status: string) =>
  status === "Đã đóng"
    ? "neutral"
    : status === "Đã kiểm soát"
      ? "green"
      : status === "Đang xử lý"
        ? "blue"
        : "amber";

export function IncidentListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { incidents, teams, createIncident, can } = useOperationalState();
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("Tất cả mức độ");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [area, setArea] = useState("Tất cả khu vực");
  const [team, setTeam] = useState("Tất cả đội");
  const [createOpen, setCreateOpen] = useState(false);
  const filtered = useMemo(
    () =>
      incidents.filter((item) => {
        const query = search.toLowerCase();
        const tabMatch =
          activeTab === "Tất cả" ||
          (activeTab === "Khẩn cấp"
            ? item.severity === "Khẩn cấp"
            : activeTab === "Đã kiểm soát"
              ? ["Đã kiểm soát", "Đã đóng"].includes(item.status)
              : item.status === activeTab);
        return (
          tabMatch &&
          (!query ||
            `${item.id} ${item.title} ${item.location.name}`
              .toLowerCase()
              .includes(query)) &&
          (severity === "Tất cả mức độ" || item.severity === severity) &&
          (status === "Tất cả trạng thái" || item.status === status) &&
          (area === "Tất cả khu vực" || item.location.name.includes(area)) &&
          (team === "Tất cả đội" || item.assignedTeamId === team)
        );
      }),
    [incidents, activeTab, search, severity, status, area, team],
  );

  return (
    <div className="workspace-content incidents-page">
      <div className="page-header incidents-list-header">
        <div>
          <div className="breadcrumbs">
            <span>Quản lý & điều hành</span>
            <ChevronRight size={13} />
            <b>Sự cố</b>
          </div>
          <h1>Sự cố</h1>
          <p>Tiếp nhận, đánh giá và điều phối toàn bộ vòng đời xử lý sự cố</p>
        </div>
        {can("create") && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Tạo sự cố
          </Button>
        )}
      </div>
      <div className="incident-tabs" aria-label="Lọc nhanh sự cố">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === "Tất cả" && <span>{incidents.length}</span>}
          </button>
        ))}
      </div>
      <section className="incident-worklist">
        <div className="incident-filters">
          <label className="incident-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã, tên sự cố hoặc khu vực…"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <FilterSelect
            icon={<Filter size={14} />}
            value={severity}
            setValue={setSeverity}
            options={["Tất cả mức độ", "Khẩn cấp", "Cao", "Trung bình", "Thấp"]}
          />
          <FilterSelect
            value={status}
            setValue={setStatus}
            options={[
              "Tất cả trạng thái",
              "Mới",
              "Đánh giá",
              "Đang xử lý",
              "Đang điều phối",
              "Đã kiểm soát",
              "Đã đóng",
            ]}
          />
          <FilterSelect
            value={area}
            setValue={setArea}
            options={[
              "Tất cả khu vực",
              "Tây Hồ",
              "Hoàn Kiếm",
              "Long Biên",
              "Ba Đình",
            ]}
          />
          <FilterSelect
            value={team}
            setValue={setTeam}
            options={["Tất cả đội", ...teams.map((item) => item.id)]}
          />
          <button className="date-filter">
            <CalendarDays size={14} />
            24 giờ gần nhất
            <ChevronDown size={13} />
          </button>
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{filtered.length}</b> sự cố phù hợp
          </span>
          <span>Cập nhật gần nhất lúc 10:45</span>
        </div>
        <div className="incident-list-table">
          <div className="incident-list-head">
            <span>Sự cố</span>
            <span>Loại / Mức độ</span>
            <span>Khu vực</span>
            <span>Trạng thái</span>
            <span>Đội phụ trách</span>
            <span>Tiến độ</span>
            <span>Cập nhật</span>
            <span />
          </div>
          {filtered.map((item) => (
            <button
              className="incident-list-row"
              key={item.id}
              onClick={() => navigate(`/incidents/${item.id}`)}
            >
              <span className="incident-primary">
                <b>{item.title}</b>
                <small>{item.code}</small>
              </span>
              <span className="incident-type">
                <b>{item.type}</b>
                <Badge tone={severityTone(item.severity)}>
                  {item.severity}
                </Badge>
              </span>
              <span className="incident-location">
                <MapPin size={13} />
                <span>{item.location.name}</span>
              </span>
              <span>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </span>
              <span className="incident-team">
                {item.assignedTeamId ?? "Chưa phân công"}
              </span>
              <span className="incident-row-progress">
                <b>{item.progress}%</b>
                <Progress
                  value={item.progress}
                  tone={item.progress >= 80 ? "green" : "blue"}
                />
              </span>
              <span className="incident-updated">
                {item.updatedAt.split(" ")[1]}
                <small>{item.updatedAt.split(" ")[0]}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="incident-empty">
              <Search size={22} />
              <b>Không tìm thấy sự cố phù hợp</b>
              <span>Thử thay đổi từ khóa hoặc bộ lọc.</span>
            </div>
          )}
        </div>
      </section>
      {createOpen && (
        <CreateIncidentDialog
          onClose={() => setCreateOpen(false)}
          onCreate={(data) => {
            const id = createIncident(data);
            setCreateOpen(false);
            navigate(`/incidents/${id}`);
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  setValue,
  options,
  icon,
}: {
  value: string;
  setValue: (value: string) => void;
  options: string[];
  icon?: React.ReactNode;
}) {
  return (
    <label className="filter-select">
      {icon}
      <select
        aria-label={options[0]}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={12} />
    </label>
  );
}

function CreateIncidentDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    title: string;
    type: string;
    severity: IncidentSeverity;
    location: { name: string; coordinates: [number, number] };
    description: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Lũ, ngập lụt");
  const [severity, setSeverity] = useState<IncidentSeverity>("Cao");
  const [location, setLocation] = useState("Tây Hồ, Hà Nội");
  const [description, setDescription] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title,
      type,
      severity,
      location: { name: location, coordinates: [105.825, 21.071] },
      description,
    });
  };
  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} aria-label="Đóng" />
      <form className="incident-form-dialog" onSubmit={submit}>
        <header>
          <div>
            <small>Tiếp nhận sự cố</small>
            <h2>Tạo sự cố mới</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field field-full">
            <span>
              Tên sự cố <b>*</b>
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mô tả ngắn gọn sự cố"
            />
          </label>
          <label className="field">
            <span>Loại thiên tai</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>Lũ, ngập lụt</option>
              <option>Ngập đô thị</option>
              <option>Sạt lở</option>
              <option>Giông lốc</option>
            </select>
          </label>
          <label className="field">
            <span>Mức độ ban đầu</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            >
              <option>Khẩn cấp</option>
              <option>Cao</option>
              <option>Trung bình</option>
              <option>Thấp</option>
            </select>
          </label>
          <label className="field field-full">
            <span>Khu vực</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label className="field field-full">
            <span>Mô tả ngắn</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Thông tin tiếp nhận ban đầu…"
            />
          </label>
        </div>
        <footer>
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            Tạo và đánh giá
          </Button>
        </footer>
      </form>
    </>
  );
}
