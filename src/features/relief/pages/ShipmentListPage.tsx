import { useMemo, useState } from "react";
import { ChevronRight, MapPin, Search, Truck, X } from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Input, PageSectionHeader } from "@/components/ui";
import { ReliefSectionTabs } from "../components/ReliefSectionTabs";

/**
 * DANH SÁCH CHUYẾN HÀNG CỨU TRỢ
 * ─────────────────────────────────────────────────────────────────────────
 * Chuyến hàng là chặng cuối của chuỗi "yêu cầu → giữ hàng ở kho → xuất kho →
 * ký nhận". Dữ liệu chuyến hàng và quyền `shipment_view` đã có sẵn trong hệ
 * thống nhưng trước đây chỉ xem được khi mở từng yêu cầu cứu trợ — không có
 * bất kỳ lối vào nào từ thanh điều hướng. Trang này đưa nó ra ánh sáng.
 */

function statusTone(status: string) {
  if (status === "Hoàn tất") return "green";
  if (status === "Đang vận chuyển" || status === "Đã xuất kho") return "blue";
  if (status === "Sự cố" || status === "Tạm dừng") return "red";
  return "neutral";
}

function timeLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function ShipmentListPage({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const shipments = store.shipments;
  const warehouses = store.warehouses;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");

  const statuses = useMemo(
    () => ["Tất cả trạng thái", ...new Set(shipments.map((item) => item.status))],
    [shipments],
  );

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return shipments
      .filter((item) => status === "Tất cả trạng thái" || item.status === status)
      .filter((item) =>
        !keyword
          ? true
          : [item.code, item.destination, item.driver, item.reliefRequestId, item.transportMethod]
              .join(" ")
              .toLowerCase()
              .includes(keyword),
      )
      .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  }, [shipments, search, status]);

  const open = shipments.filter((item) => item.status !== "Hoàn tất").length;
  const delivered = shipments.filter((item) => item.receipt).length;

  return (
    <div className="workspace-content relief-page">
      <PageSectionHeader
        section="Hậu cần"
        title="Chuyến hàng cứu trợ"
        description="Theo dõi các chuyến xuất kho: điểm đến, phương tiện, người áp tải, dự kiến tới nơi và xác nhận giao nhận."
        icon={Truck}
      />
      <ReliefSectionTabs active="/relief/shipments" navigate={navigate} />

      <section className="relief-summary">
        <div>
          <Truck size={16} />
          <span>
            <b>{shipments.length}</b> chuyến trong hệ thống
          </span>
        </div>
        <div className={open ? "warning" : ""}>
          <Truck size={16} />
          <span>
            <b>{open}</b> chuyến chưa hoàn tất
          </span>
        </div>
        <div>
          <MapPin size={16} />
          <span>
            <b>{delivered}</b> chuyến đã có biên bản giao nhận
          </span>
        </div>
      </section>

      <section className="relief-worklist">
        <div className="relief-filters">
          <label className="ui-search incident-search">
            <Search size={15} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã chuyến, điểm đến, người áp tải…"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <label className="filter-select">
            <select
              aria-label="Trạng thái chuyến hàng"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statuses.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Mã chuyến</th>
                <th>Điểm đến</th>
                <th>Kho xuất</th>
                <th>Phương tiện / người áp tải</th>
                <th>Dự kiến tới</th>
                <th>Trạng thái</th>
                <th>Yêu cầu</th>
                <th aria-label="Mở yêu cầu" />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const warehouse = warehouses.find((w) => w.id === item.warehouseId);
                return (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() => navigate(`/relief/requests/${item.reliefRequestId}`)}
                  >
                    <td>
                      <b>{item.code}</b>
                    </td>
                    <td>{item.destination}</td>
                    <td>{warehouse ? warehouse.name : item.warehouseId}</td>
                    <td>
                      {item.transportMethod}
                      {item.driver ? ` · ${item.driver}` : ""}
                    </td>
                    <td>
                      {timeLabel(item.actualArrival ?? item.estimatedArrival)}
                      {item.actualArrival ? " (đã tới)" : ""}
                    </td>
                    <td>
                      <Badge tone={statusTone(item.status) as never}>{item.status}</Badge>
                    </td>
                    <td>{item.reliefRequestId}</td>
                    <td>
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={8} style={{ color: "var(--muted)", padding: "18px 12px" }}>
                    Không có chuyến hàng nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
