import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  Clock3,
  MapPin,
  Radio,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { capabilityOptions } from "@/domain/teams/rules";
import {
  filterAndSortTeams,
  type TeamListFilters,
  type TeamSortMode,
} from "@/application/teams/teamQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, PageSectionHeader, Input } from "@/components/ui";

const tabs = [
  "Tất cả",
  "Sẵn sàng",
  "Đang điều động",
  "Đang thực hiện",
  "Tạm nghỉ",
  "Mất liên lạc",
  "Không khả dụng",
];
const tone = (status: string) =>
  status === "Sẵn sàng"
    ? "green"
    : status === "Mất liên lạc" || status === "Không khả dụng"
      ? "red"
      : status === "Tạm nghỉ"
        ? "neutral"
        : status === "Đang điều động"
          ? "amber"
          : "blue";

export function TeamListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { teams } = useOperationalState();
  const [tab, setTab] = useState<TeamListFilters["tab"]>("Tất cả");
  const [search, setSearch] = useState("");
  // TINH GIẢN dropdown (4→1): chỉ giữ Năng lực (kỹ năng điều phối cần).
  // - Loại đội: trùng năng lực + đã hiện trên thẻ đội → bỏ.
  // - Khu vực: ô tìm kiếm đã khớp khu vực → bỏ.
  // - Phân công: suy được từ tab trạng thái (Đang điều động/thực hiện ⇔ có
  //   nhiệm vụ) → bỏ. Giá trị mặc định vẫn truyền xuống bộ lọc.
  const [capability, setCapability] = useState("Tất cả năng lực");
  const [sort, setSort] = useState<TeamSortMode>("Ưu tiên vận hành");
  const filtered = useMemo(
    () =>
      filterAndSortTeams(teams, {
        tab,
        search,
        status: "Tất cả trạng thái",
        type: "Tất cả loại đội",
        capability,
        region: "Tất cả khu vực",
        assignment: "Tất cả phân công",
        sort,
      }),
    [teams, tab, search, capability, sort],
  );
  const ready = teams.filter((team) => team.status === "Sẵn sàng").length;
  const active = teams.filter((team) =>
    ["Đang điều động", "Đang thực hiện"].includes(team.status),
  ).length;
  const exceptions = teams.filter((team) =>
    ["Mất liên lạc", "Không khả dụng"].includes(team.status),
  ).length;
  return (
    <div className="workspace-content teams-page">
      <PageSectionHeader
        section="Ứng phó"
        title="Đội cứu hộ"
        description="Quản lý trạng thái sẵn sàng, năng lực, vị trí và phân công lực lượng."
        icon={Users}
      />
      <section className="team-operational-summary" tabIndex={0} aria-label="Tóm tắt hoạt động đội cứu hộ">
        <div>
          <ShieldCheck size={16} />
          <span>
            <b>{ready}</b> đội sẵn sàng
          </span>
        </div>
        <div>
          <Users size={16} />
          <span>
            <b>{active}</b> đội đang hoạt động
          </span>
        </div>
        <div className={exceptions ? "danger" : ""}>
          <Radio size={16} />
          <span>
            <b>{exceptions}</b> ngoại lệ vận hành
          </span>
        </div>
        <p>
          Dữ liệu vị trí là bản ghi định vị gần nhất, không phải luồng thời gian
          thực.
        </p>
      </section>
      <div className="team-tabs">
        {tabs.map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item as TeamListFilters["tab"])}
            key={item}
          >
            {item}
            {item === "Tất cả" && <span>{teams.length}</span>}
          </button>
        ))}
      </div>
      <section className="team-worklist">
        <div className="team-filters">
          <label className="ui-search incident-search">
            <Search size={15} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã đội, tên đội, đội trưởng hoặc khu vực…"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>

          <Select
            value={capability}
            setValue={setCapability}
            options={["Tất cả năng lực", ...capabilityOptions]}
          />
          <label className="filter-select team-sort">
            <ArrowUpDown size={12} />
            <UiSelect
              aria-label="Sắp xếp danh sách đội"
              value={sort}
              onChange={(event) => setSort(event.target.value as TeamSortMode)}
            >
              <option>Ưu tiên vận hành</option>
              <option>Cập nhật gần nhất</option>
              <option>Mã đội A–Z</option>
            </UiSelect>
          </label>
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{filtered.length}</b> đội phù hợp
          </span>
          <span>Sắp xếp: {sort.toLowerCase()}</span>
        </div>
        <div className="team-list-table">
          <div className="team-list-head">
            <span>Đội cứu hộ</span>
            <span>Điều kiện vận hành</span>
            <span>Đội trưởng</span>
            <span>Năng lực chính</span>
            <span>Phân công hiện tại</span>
            <span>Khu vực</span>
            <span>Cập nhật cuối</span>
            <span />
          </div>
          {filtered.map((team) => (
            <button
              className="team-list-row"
              onClick={() => navigate(`/teams/${team.id}`)}
              key={team.id}
            >
              <span className="team-primary">
                <b>{team.name}</b>
                <small>
                  {team.code} · {team.type}
                </small>
              </span>
              <span className="team-condition">
                <Badge tone={tone(team.status)}>{team.status}</Badge>
                <small>{team.availability}</small>
              </span>
              <span className="team-leader">
                {team.leader}
                <small>{team.members} thành viên</small>
              </span>
              <span className="team-capability">
                {team.capability}
                <small>{team.capabilities.length} năng lực</small>
              </span>
              <span className="team-current-task">
                {team.currentTask ? (
                  <b>{team.currentTask}</b>
                ) : (
                  <span>Chưa có</span>
                )}
                <small>{team.currentIncident ?? "Chưa gắn sự cố"}</small>
              </span>
              <span className="team-region">
                <MapPin size={12} />
                {team.region}
              </span>
              <span
                className={`team-location-time ${team.status === "Mất liên lạc" ? "stale" : ""}`}
              >
                <Clock3 size={12} />
                <b>{team.lastLocationUpdate}</b>
                <small>{team.communicationStatus}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {!filtered.length && (
            <div className="team-empty-result">
              <Search size={20} />
              <b>Không tìm thấy đội phù hợp</b>
              <span>Điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
function Select({
  value,
  setValue,
  options,
}: {
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <UiSelect
        aria-label={options[0]}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </UiSelect>
    </label>
  );
}
