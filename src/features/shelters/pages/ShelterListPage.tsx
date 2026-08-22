import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  Users,
  X,
} from "lucide-react";
import { calculateShelterCapacity } from "@/domain/shelters/rules";
import {
  filterAndSortShelters,
  type ShelterFilters,
} from "@/application/shelters/shelterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Progress } from "@/components/ui";
const tone = (status: string) =>
  status === "Quá tải" || status === "Không thể tiếp cận"
    ? "red"
    : status === "Gần đầy"
      ? "amber"
      : status === "Sẵn sàng"
        ? "green"
        : status === "Tạm đóng"
          ? "neutral"
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
export function ShelterListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { shelters, evacuationOperations } = useOperationalState();
  const [filters, setFilters] = useState<ShelterFilters>({
    search: "",
    status: "Tất cả trạng thái",
    readiness: "Tất cả mức sẵn sàng",
    area: "Tất cả khu vực",
    capacity: "Tất cả sức chứa",
    occupancy: "Tất cả mức sử dụng",
    accessibility: "Tất cả khả năng tiếp cận",
    medical: "Tất cả năng lực y tế",
    evacuation: "Tất cả hoạt động",
    availability: "Tất cả khả dụng",
    sort: "Ưu tiên vận hành",
  });
  const patch = <K extends keyof ShelterFilters>(
    key: K,
    value: ShelterFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterAndSortShelters(shelters, evacuationOperations, filters),
    [shelters, evacuationOperations, filters],
  );
  const active = evacuationOperations.filter(
    (operation) => !["Hoàn thành", "Đã hủy"].includes(operation.status),
  ).length;
  const exceptions = shelters.filter((shelter) =>
    ["Quá tải", "Gần đầy", "Không thể tiếp cận"].includes(shelter.status),
  ).length;
  const available = shelters.reduce(
    (sum, shelter) => sum + calculateShelterCapacity(shelter).availableCapacity,
    0,
  );
  const areas = [
    ...new Set(
      shelters.map((shelter) => shelter.administrativeArea.split(",")[0]),
    ),
  ];
  return (
    <div className="workspace-content shelters-page">
      <div className="page-header shelters-header">
        <div>
          <div className="breadcrumbs">
            <span>Nguồn lực</span>
            <ChevronRight size={13} />
            <b>Điểm sơ tán</b>
          </div>
          <h1>Quản lý Điểm sơ tán</h1>
          <p>
            Điều phối sức chứa, điều kiện tiếp nhận và hoạt động sơ tán dân cư
          </p>
        </div>
      </div>
      <section className="shelter-summary">
        <div>
          <Building2 size={16} />
          <span>
            <b>{shelters.length}</b> điểm trong phương án
          </span>
        </div>
        <div>
          <Users size={16} />
          <span>
            <b>{available}</b> chỗ khả dụng
          </span>
        </div>
        <div>
          <ChevronRight size={16} />
          <span>
            <b>{active}</b> hoạt động đang mở
          </span>
        </div>
        <div className={exceptions ? "danger" : ""}>
          <AlertTriangle size={16} />
          <span>
            <b>{exceptions}</b> ngoại lệ cần xử lý
          </span>
        </div>
      </section>
      <section className="shelter-worklist">
        <div className="shelter-filters">
          <label className="incident-search">
            <Search size={15} />
            <input
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
              placeholder="Tìm mã, tên, địa chỉ hoặc cán bộ phụ trách…"
            />
            {filters.search && (
              <button onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <Select
            value={filters.status}
            onChange={(value) => patch("status", value)}
            options={[
              "Tất cả trạng thái",
              "Sẵn sàng",
              "Đang tiếp nhận",
              "Gần đầy",
              "Quá tải",
              "Tạm đóng",
              "Không thể tiếp cận",
            ]}
          />
          <Select
            value={filters.readiness}
            onChange={(value) => patch("readiness", value)}
            options={[
              "Tất cả mức sẵn sàng",
              "Sẵn sàng",
              "Hạn chế",
              "Không sẵn sàng",
            ]}
          />
          <Select
            value={filters.area}
            onChange={(value) => patch("area", value)}
            options={["Tất cả khu vực", ...areas]}
          />
          <Select
            value={filters.capacity}
            onChange={(value) => patch("capacity", value)}
            options={["Tất cả sức chứa", "Từ 500 chỗ", "Dưới 500 chỗ"]}
          />
          <Select
            value={filters.occupancy}
            onChange={(value) => patch("occupancy", value)}
            options={["Tất cả mức sử dụng", "Từ 85%", "50–84%", "Dưới 50%"]}
          />
          <Select
            value={filters.accessibility}
            onChange={(value) => patch("accessibility", value)}
            options={[
              "Tất cả khả năng tiếp cận",
              "Tiếp cận bình thường",
              "Tiếp cận hạn chế",
              "Không thể tiếp cận",
            ]}
          />
          <Select
            value={filters.medical}
            onChange={(value) => patch("medical", value)}
            options={[
              "Tất cả năng lực y tế",
              "Có đội y tế",
              "Sơ cứu cơ bản",
              "Không có",
            ]}
          />
          <Select
            value={filters.evacuation}
            onChange={(value) => patch("evacuation", value)}
            options={["Tất cả hoạt động", "Có hoạt động", "Không có hoạt động"]}
          />
          <Select
            value={filters.availability}
            onChange={(value) => patch("availability", value)}
            options={["Tất cả khả dụng", "Còn chỗ", "Đã hết chỗ"]}
          />
          <label className="filter-select shelter-sort">
            <ArrowUpDown size={12} />
            <select
              aria-label="Sắp xếp danh sách điểm sơ tán"
              value={filters.sort}
              onChange={(event) =>
                patch("sort", event.target.value as ShelterFilters["sort"])
              }
            >
              <option>Ưu tiên vận hành</option>
              <option>Sức chứa khả dụng</option>
              <option>Tên A–Z</option>
            </select>
            <ChevronDown size={12} />
          </label>
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> điểm phù hợp
          </span>
          <span>Ưu tiên quá tải, gần đầy và không thể tiếp cận</span>
        </div>
        <div className="shelter-table">
          <div className="shelter-table-head">
            <span>Điểm sơ tán</span>
            <span>Trạng thái</span>
            <span>Sức chứa</span>
            <span>Khả dụng</span>
            <span>Điều kiện</span>
            <span>Phụ trách</span>
            <span>Hoạt động</span>
            <span />
          </div>
          {rows.map((shelter) => {
            const capacity = calculateShelterCapacity(shelter);
            const operations = evacuationOperations.filter(
              (operation) =>
                operation.destinationShelterId === shelter.id &&
                !["Hoàn thành", "Đã hủy"].includes(operation.status),
            );
            return (
              <button
                className="shelter-row"
                key={shelter.id}
                onClick={() => navigate(`/shelters/${shelter.id}`)}
              >
                <span className="shelter-primary">
                  <b>{shelter.name}</b>
                  <small>
                    {shelter.code} · {shelter.type}
                  </small>
                  <small>
                    <MapPin size={11} />
                    {shelter.administrativeArea}
                  </small>
                </span>
                <span>
                  <Badge tone={tone(shelter.status)}>{shelter.status}</Badge>
                </span>
                <span className="shelter-capacity">
                  <b>
                    {shelter.currentOccupancy}/{shelter.capacity}
                  </b>
                  <Progress
                    value={Math.min(100, capacity.occupancyPercentage)}
                    tone={
                      capacity.isOverloaded || capacity.isNearCapacity
                        ? "amber"
                        : "blue"
                    }
                  />
                  <small>{capacity.occupancyPercentage}% đang sử dụng</small>
                </span>
                <span
                  className={
                    capacity.availableCapacity === 0 ? "capacity-danger" : ""
                  }
                >
                  <b>{capacity.availableCapacity}</b>
                  <small>còn chỗ</small>
                </span>
                <span className="shelter-condition">
                  <b>{shelter.readiness}</b>
                  <small>{shelter.accessibility}</small>
                  <small>{shelter.medicalCapability}</small>
                </span>
                <span className="shelter-officer">
                  <b>{shelter.responsibleOfficer.name}</b>
                  <small>{shelter.responsibleOfficer.phone}</small>
                </span>
                <span className="shelter-operation">
                  {operations[0] ? (
                    <>
                      <b>{operations[0].id}</b>
                      <small>
                        {operations[0].status} · {operations[0].progress}%
                      </small>
                    </>
                  ) : (
                    <small>Không có</small>
                  )}
                </span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
