import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  MapPin,
  PackageOpen,
  Search,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import {
  availableQuantity,
  isLowStock,
  isOutOfStock,
} from "@/domain/relief/rules";
import {
  filterWarehouses,
  type WarehouseFilters,
} from "@/application/relief/reliefQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, PageSectionHeader, Progress, Input } from "@/components/ui";
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
      <UiSelect value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </UiSelect>
    </label>
  );
}
export function WarehouseListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { warehouses, inventory, shipments } = useOperationalState();
  const [filters, setFilters] = useState<WarehouseFilters>({
    search: "",
    area: "Tất cả khu vực",
    status: "Tất cả trạng thái",
    type: "Tất cả loại kho",
    lowStock: "Tất cả tồn kho",
    availability: "Tất cả khả dụng",
  });
  const patch = (key: keyof WarehouseFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterWarehouses(warehouses, inventory, shipments, filters),
    [warehouses, inventory, shipments, filters],
  );
  const low = inventory.filter(isLowStock).length;
  const out = inventory.filter(isOutOfStock).length;
  const active = shipments.filter((item) => item.status !== "Hoàn tất").length;
  return (
    <div className="workspace-content warehouse-page">
      <PageSectionHeader
        section="Nguồn lực"
        title="Kho vật tư cứu trợ"
        description="Quản lý khả dụng, tồn kho, hàng giữ và hoạt động xuất kho."
        icon={Warehouse}
        actions={
          <button
            className="text-action"
            onClick={() => navigate("/relief/requests")}
          >
            <PackageOpen size={15} />
            Yêu cầu cứu trợ
          </button>
        }
      />
      <section className="relief-summary">
        <div>
          <Warehouse size={16} />
          <span>
            <b>
              {warehouses.filter((item) => item.status === "Hoạt động").length}
            </b>{" "}
            kho hoạt động
          </span>
        </div>
        <div className={low ? "warning" : ""}>
          <AlertTriangle size={16} />
          <span>
            <b>{low}</b> mặt hàng sắp hết
          </span>
        </div>
        <div className={out ? "danger" : ""}>
          <PackageOpen size={16} />
          <span>
            <b>{out}</b> mặt hàng hết kho
          </span>
        </div>
        <div>
          <Truck size={16} />
          <span>
            <b>{active}</b> chuyến đang mở
          </span>
        </div>
      </section>
      <section className="relief-worklist">
        <div className="relief-filters">
          <label className="ui-search incident-search">
            <Search size={15} />
            <Input
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
              placeholder="Tìm mã kho, tên, địa chỉ hoặc cán bộ phụ trách…"
            />
            {filters.search && (
              <button onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <Select
            value={filters.area}
            onChange={(value) => patch("area", value)}
            options={[
              "Tất cả khu vực",
              ...new Set(
                warehouses.map((item) => item.administrativeArea.split(",")[0]),
              ),
            ]}
          />
          <Select
            value={filters.status}
            onChange={(value) => patch("status", value)}
            options={["Tất cả trạng thái", "Hoạt động", "Hạn chế", "Tạm đóng"]}
          />
          <Select
            value={filters.type}
            onChange={(value) => patch("type", value)}
            options={[
              "Tất cả loại kho",
              ...new Set(warehouses.map((item) => item.type)),
            ]}
          />
          <Select
            value={filters.lowStock}
            onChange={(value) => patch("lowStock", value)}
            options={["Tất cả tồn kho", "Có cảnh báo", "Không có cảnh báo"]}
          />
          <Select
            value={filters.availability}
            onChange={(value) => patch("availability", value)}
            options={["Tất cả khả dụng", "Có thể xuất", "Tạm ngừng xuất"]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> kho phù hợp
          </span>
          <span>Tồn khả dụng = tồn thực tế − đã giữ</span>
        </div>
        <div className="warehouse-table">
          <div className="warehouse-table-head">
            <span>Kho vật tư</span>
            <span>Trạng thái</span>
            <span>Mức sử dụng</span>
            <span>Danh mục</span>
            <span>Cảnh báo tồn</span>
            <span>Chuyến đang mở</span>
            <span>Phụ trách</span>
            <span />
          </div>
          {rows.map((warehouse) => {
            const items = inventory.filter(
              (item) => item.warehouseId === warehouse.id,
            );
            const lowItems = items.filter(
              (item) => isLowStock(item) || isOutOfStock(item),
            );
            const activeShipments = shipments.filter(
              (item) =>
                item.warehouseId === warehouse.id && item.status !== "Hoàn tất",
            );
            return (
              <button
                className="warehouse-row"
                key={warehouse.id}
                onClick={() => navigate(`/relief/warehouses/${warehouse.id}`)}
              >
                <span className="warehouse-primary">
                  <b>{warehouse.name}</b>
                  <small>
                    {warehouse.code} · {warehouse.type}
                  </small>
                  <small>
                    <MapPin size={11} />
                    {warehouse.administrativeArea}
                  </small>
                </span>
                <span>
                  <Badge
                    tone={
                      warehouse.status === "Hoạt động"
                        ? "green"
                        : warehouse.status === "Hạn chế"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {warehouse.status}
                  </Badge>
                </span>
                <span className="warehouse-util">
                  <b>{warehouse.currentUtilization}%</b>
                  <Progress
                    value={warehouse.currentUtilization}
                    tone={warehouse.currentUtilization >= 85 ? "amber" : "blue"}
                  />
                  <small>
                    {warehouse.capacity.toLocaleString("vi-VN")} đơn vị quy đổi
                  </small>
                </span>
                <span>
                  <b>{new Set(items.map((item) => item.category)).size}</b>
                  <small>{items.length} mặt hàng</small>
                </span>
                <span className={lowItems.length ? "shortage" : ""}>
                  <b>{lowItems.length}</b>
                  <small>
                    {lowItems
                      .map((item) => `${item.name}: ${availableQuantity(item)}`)
                      .join(" · ") || "Không có cảnh báo"}
                  </small>
                </span>
                <span>
                  <b>{activeShipments.length}</b>
                  <small>
                    {activeShipments.map((item) => item.id).join(", ") ||
                      "Không có"}
                  </small>
                </span>
                <span>
                  <b>{warehouse.responsibleOfficer.name}</b>
                  <small>{warehouse.responsibleOfficer.phone}</small>
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
