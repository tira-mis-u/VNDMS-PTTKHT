import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock3,
  PackageOpen,
  Search,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import {
  calculateFulfillment,
  hasRequestShortage,
  isReliefOverdue,
} from "@/domain/relief/rules";
import {
  filterAndSortReliefRequests,
  type ReliefFilters,
} from "@/application/relief/reliefQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge } from "@/components/ui";
const tone = (priority: string) =>
  priority.startsWith("P1")
    ? "red"
    : priority.startsWith("P2")
      ? "amber"
      : priority.startsWith("P3")
        ? "blue"
        : "neutral";
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
export function ReliefRequestListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const {
    reliefRequests,
    reservations,
    warehouses,
    incidents,
    shelters,
    shipments,
  } = useOperationalState();
  const [filters, setFilters] = useState<ReliefFilters>({
    search: "",
    priority: "Tất cả ưu tiên",
    status: "Tất cả trạng thái",
    destination: "Tất cả điểm nhận",
    incident: "Tất cả sự cố",
    shelter: "Tất cả điểm sơ tán",
    warehouse: "Tất cả kho",
    required: "Tất cả thời hạn",
    shortage: "Tất cả nguồn cung",
    overdue: "Tất cả tiến độ",
  });
  const patch = (key: keyof ReliefFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterAndSortReliefRequests(reliefRequests, reservations, filters),
    [reliefRequests, reservations, filters],
  );
  const p1 = reliefRequests.filter(
    (item) =>
      item.priority.startsWith("P1") &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(item.status),
  ).length;
  const shortages = reliefRequests.filter(
    (item) =>
      hasRequestShortage(item, reservations) &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(item.status),
  ).length;
  const activeShipments = shipments.filter(
    (item) => !["Hoàn tất"].includes(item.status),
  ).length;
  return (
    <div className="workspace-content relief-page">
      <div className="page-header relief-header">
        <div>
          <div className="breadcrumbs">
            <span>Nguồn lực</span>
            <ChevronRight size={13} />
            <b>Phân phối cứu trợ</b>
          </div>
          <h1>Phân phối cứu trợ</h1>
          <p>Thẩm định nhu cầu, giữ hàng, xuất kho và xác nhận giao nhận</p>
        </div>
        <button
          className="text-action"
          onClick={() => navigate("/relief/warehouses")}
        >
          <Warehouse size={15} />
          Quản lý kho
        </button>
      </div>
      <section className="relief-summary">
        <div className={p1 ? "danger" : ""}>
          <AlertTriangle size={16} />
          <span>
            <b>{p1}</b> yêu cầu P1
          </span>
        </div>
        <div>
          <PackageOpen size={16} />
          <span>
            <b>{shortages}</b> yêu cầu thiếu hàng
          </span>
        </div>
        <div>
          <Truck size={16} />
          <span>
            <b>{activeShipments}</b> chuyến đang mở
          </span>
        </div>
        <p>Ưu tiên P1 → quá hạn → thiếu nguồn cung → cần giao sớm.</p>
      </section>
      <section className="relief-worklist">
        <div className="relief-filters">
          <label className="incident-search">
            <Search size={15} />
            <input
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
              placeholder="Tìm mã yêu cầu, điểm nhận, người yêu cầu hoặc vật tư…"
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
              "Nháp",
              "Đã gửi",
              "Đang thẩm định",
              "Đã duyệt",
              "Đã giữ hàng",
              "Đã xuất kho",
              "Đang vận chuyển",
              "Đã giao",
              "Đã xác nhận",
              "Đã đóng",
              "Từ chối",
              "Hủy",
            ]}
          />
          <Select
            value={filters.destination}
            onChange={(value) => patch("destination", value)}
            options={[
              "Tất cả điểm nhận",
              ...new Set(reliefRequests.map((item) => item.destination)),
            ]}
          />
          <Select
            value={filters.incident}
            onChange={(value) => patch("incident", value)}
            options={[
              "Tất cả sự cố",
              "Không liên kết",
              ...incidents.map((item) => item.id),
            ]}
          />
          <Select
            value={filters.shelter}
            onChange={(value) => patch("shelter", value)}
            options={[
              "Tất cả điểm sơ tán",
              "Không liên kết",
              ...shelters.map((item) => item.id),
            ]}
          />
          <Select
            value={filters.warehouse}
            onChange={(value) => patch("warehouse", value)}
            options={["Tất cả kho", ...warehouses.map((item) => item.id)]}
          />
          <Select
            value={filters.required}
            onChange={(value) => patch("required", value)}
            options={["Tất cả thời hạn", "Cần trong hôm nay"]}
          />
          <Select
            value={filters.shortage}
            onChange={(value) => patch("shortage", value)}
            options={["Tất cả nguồn cung", "Có thiếu hụt", "Đủ phân bổ"]}
          />
          <Select
            value={filters.overdue}
            onChange={(value) => patch("overdue", value)}
            options={["Tất cả tiến độ", "Quá hạn", "Đúng hạn"]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> yêu cầu cần theo dõi
          </span>
          <span>Hàng đợi hậu cần theo mức cần can thiệp</span>
        </div>
        <div className="relief-table">
          <div className="relief-table-head">
            <span>Yêu cầu / Điểm nhận</span>
            <span>Ưu tiên</span>
            <span>Nhu cầu</span>
            <span>Trạng thái</span>
            <span>Nguồn cung</span>
            <span>Kho xuất</span>
            <span>Thời hạn</span>
            <span />
          </div>
          {rows.map((request) => {
            const fulfillment = calculateFulfillment(request, reservations);
            const shortage = hasRequestShortage(request, reservations);
            return (
              <button
                className={`relief-row ${request.priority.startsWith("P1") ? "critical" : ""}`}
                key={request.id}
                onClick={() => navigate(`/relief/requests/${request.id}`)}
              >
                <span className="relief-primary">
                  <b>
                    {request.code} · {request.destination}
                  </b>
                  <small>
                    {request.origin} · {request.requester}
                  </small>
                  <small>{request.justification}</small>
                </span>
                <span>
                  <Badge tone={tone(request.priority)}>
                    {request.priority}
                  </Badge>
                </span>
                <span className="relief-items">
                  <b>{request.items.length} loại vật tư</b>
                  <small>
                    {request.items
                      .map(
                        (item) =>
                          `${item.quantityRequested} ${item.unit} ${item.name}`,
                      )
                      .join(" · ")}
                  </small>
                </span>
                <span>
                  <Badge
                    tone={
                      request.status === "Đã đóng"
                        ? "green"
                        : request.status === "Hủy" ||
                            request.status === "Từ chối"
                          ? "neutral"
                          : "blue"
                    }
                  >
                    {request.status}
                  </Badge>
                </span>
                <span className={shortage ? "shortage" : ""}>
                  <b>{shortage ? "Thiếu hàng" : "Đủ hàng"}</b>
                  <small>
                    {fulfillment
                      .filter((item) => item.shortage > 0)
                      .map((item) => `${item.name}: thiếu ${item.shortage}`)
                      .join(" · ") || "Đã phân bổ đủ"}
                  </small>
                </span>
                <span className="relief-warehouses">
                  <b>
                    {request.assignedWarehouseIds.join(", ") || "Chưa chọn kho"}
                  </b>
                  <small>{request.shipmentIds.length} chuyến hàng</small>
                </span>
                <span className={isReliefOverdue(request) ? "overdue" : ""}>
                  <Clock3 size={12} />
                  <b>{request.requiredBy.split(" ")[1]}</b>
                  <small>
                    {isReliefOverdue(request)
                      ? "Quá hạn"
                      : "Cần " + request.requiredBy.split(" ")[0]}
                  </small>
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
