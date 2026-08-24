import { Select as UiSelect } from "@/components/ui/Select";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  Clock3,
  MapPin,
  PackageOpen,
  Phone,
  Settings2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import type { InventoryItem, WarehouseStatus } from "@/domain/relief/types";
import {
  availableQuantity,
  isLowStock,
  isOutOfStock,
} from "@/domain/relief/rules";
const inventoryAlert = (item: InventoryItem) =>
  isOutOfStock(item)
    ? "Hết hàng"
    : isLowStock(item)
      ? "Sắp hết"
      : "Bình thường";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Badge, Button, EmptyState, Progress, Input } from "@/components/ui";
import { LogisticsMap } from "../components/LogisticsMap";
const dt = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
  if (!match) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(
    new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
    ),
  );
};
export function WarehouseDetailPage({
  warehouseId,
  navigate,
}: {
  warehouseId: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const warehouse = store.warehouses.find((item) => item.id === warehouseId);
  const [adjust, setAdjust] = useState<InventoryItem>();
  const [statusDialog, setStatusDialog] = useState(false);
  if (!warehouse)
    return (
      <div className="workspace-content">
        <EmptyState
          title="Không tìm thấy kho vật tư"
          description={`Không có hồ sơ ${warehouseId}.`}
          action={
            <Button onClick={() => navigate("/relief/warehouses")}>
              Về danh sách kho
            </Button>
          }
        />
      </div>
    );
  const items = store.inventory.filter(
    (item) => item.warehouseId === warehouse.id,
  );
  const requests = store.reliefRequests.filter((item) =>
    item.assignedWarehouseIds.includes(warehouse.id),
  );
  const shipments = store.shipments.filter(
    (item) => item.warehouseId === warehouse.id,
  );
  const events = store.reliefEvents
    .filter(
      (item) =>
        (item.entityType === "warehouse" && item.entityId === warehouse.id) ||
        shipments.some((shipment) => shipment.id === item.entityId),
    )
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const categories = [...new Set(items.map((item) => item.category))];
  const activeShipments = shipments.filter(
    (item) => item.status !== "Hoàn tất",
  );
  return (
    <div className="workspace-content warehouse-detail">
      <div className="detail-topline">
        <button
          className="back-link"
          onClick={() => navigate("/relief/warehouses")}
        >
          <ArrowLeft size={15} />
          Kho vật tư
        </button>
        <div className="detail-actions">
          {store.can("warehouse_update") && (
            <Button variant="secondary" onClick={() => setStatusDialog(true)}>
              <Settings2 size={15} />
              Trạng thái kho
            </Button>
          )}
          <Button onClick={() => navigate("/relief/requests")}>
            <PackageOpen size={15} />
            Hàng đợi cứu trợ
          </Button>
        </div>
      </div>
      <header className="warehouse-detail-header">
        <div className="warehouse-icon">
          <Building2 size={24} />
        </div>
        <div>
          <div>
            <span>{warehouse.code}</span>
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
          </div>
          <h1>{warehouse.name}</h1>
          <p>
            <MapPin size={13} />
            {warehouse.address}, {warehouse.administrativeArea}
          </p>
        </div>
        <div className="warehouse-contact">
          <span>
            <UserRound size={14} />
            <b>{warehouse.responsibleOfficer.name}</b>
          </span>
          <span>
            <Phone size={14} />
            {warehouse.contact}
          </span>
        </div>
      </header>
      <section className="warehouse-overview">
        <div>
          <span>Mức sử dụng</span>
          <b>{warehouse.currentUtilization}%</b>
          <Progress
            value={warehouse.currentUtilization}
            tone={warehouse.currentUtilization >= 85 ? "amber" : "blue"}
          />
          <small>
            Sức chứa {warehouse.capacity.toLocaleString("vi-VN")} đơn vị quy đổi
          </small>
        </div>
        <div>
          <Boxes size={18} />
          <span>
            <b>{items.length}</b> mặt hàng
            <small>{categories.length} danh mục</small>
          </span>
        </div>
        <div>
          <AlertTriangle size={18} />
          <span>
            <b>
              {
                items.filter((item) => isLowStock(item) || isOutOfStock(item))
                  .length
              }
            </b>{" "}
            cảnh báo tồn
            <small>{items.filter(isOutOfStock).length} mặt hàng hết</small>
          </span>
        </div>
        <div>
          <Truck size={18} />
          <span>
            <b>{activeShipments.length}</b> chuyến đang mở
            <small>{shipments.length} chuyến tổng cộng</small>
          </span>
        </div>
      </section>
      <div className="warehouse-detail-grid">
        <main>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Tồn kho chính thức</h2>
                <p>Khả dụng được tính từ tồn thực tế trừ số lượng đang giữ</p>
              </div>
            </div>
            <div className="inventory-table">
              <div>
                <b>Mặt hàng</b>
                <b>Tồn thực tế</b>
                <b>Đã giữ</b>
                <b>Khả dụng</b>
                <b>Ngưỡng nhập</b>
                <b>Hạn dùng</b>
                <b>Tình trạng</b>
                <b />
              </div>
              {items.map((item) => {
                const alert = inventoryAlert(item);
                return (
                  <div
                    key={item.id}
                    className={alert !== "Bình thường" ? "inventory-alert" : ""}
                  >
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.itemCode} · {item.category}
                      </small>
                    </span>
                    <span>
                      {item.quantityOnHand} {item.unit}
                    </span>
                    <span>
                      {item.quantityReserved} {item.unit}
                    </span>
                    <strong>
                      {availableQuantity(item)} {item.unit}
                    </strong>
                    <span>
                      {item.reorderLevel} {item.unit}
                    </span>
                    <span>{item.expiryDate ? item.expiryDate : "—"}</span>
                    <Badge
                      tone={
                        alert === "Hết hàng"
                          ? "red"
                          : alert === "Sắp hết"
                            ? "amber"
                            : item.condition === "Tốt"
                              ? "green"
                              : "neutral"
                      }
                    >
                      {alert === "Bình thường" ? item.condition : alert}
                    </Badge>
                    <span>
                      {store.can("warehouse_adjust_stock") && (
                        <button
                          className="table-action"
                          onClick={() => setAdjust(item)}
                        >
                          Điều chỉnh
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Chuyến hàng từ kho</h2>
                <p>Xuất kho và vận chuyển đang hoạt động</p>
              </div>
            </div>
            <div className="shipment-list compact">
              {shipments.length ? (
                shipments.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      navigate(`/relief/requests/${item.reliefRequestId}`)
                    }
                  >
                    <span className="entity-icon">
                      <Truck size={16} />
                    </span>
                    <span>
                      <b>
                        {item.id} → {item.destination}
                      </b>
                      <small>
                        {item.items
                          .map(
                            (line) =>
                              `${line.quantity} ${line.unit} ${line.name}`,
                          )
                          .join(" · ")}
                      </small>
                    </span>
                    <Badge
                      tone={
                        item.status === "Có sự cố"
                          ? "red"
                          : item.status === "Hoàn tất"
                            ? "green"
                            : "blue"
                      }
                    >
                      {item.status}
                    </Badge>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="Chưa có chuyến hàng"
                  description="Các chuyến xuất từ kho sẽ hiển thị tại đây."
                />
              )}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Yêu cầu đang phục vụ</h2>
                <p>Yêu cầu đã phân bổ vật tư từ kho này</p>
              </div>
            </div>
            <div className="warehouse-request-list">
              {requests.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/relief/requests/${item.id}`)}
                >
                  <span>
                    <b>
                      {item.code} · {item.destination}
                    </b>
                    <small>
                      {item.priority} · cần trước {dt(item.requiredBy)}
                    </small>
                  </span>
                  <Badge tone={item.status === "Hủy" ? "neutral" : "blue"}>
                    {item.status}
                  </Badge>
                </button>
              ))}
            </div>
          </section>
        </main>
        <aside>
          <section className="detail-section map-section">
            <div className="section-heading">
              <div>
                <h2>Vị trí kho</h2>
                <p>Dữ liệu vị trí cấu hình trong kịch bản vận hành</p>
              </div>
            </div>
            <LogisticsMap
              warehouses={[warehouse]}
              shipments={shipments}
              navigate={navigate}
            />
          </section>
          <section className="detail-section">
            <h2>Hồ sơ kho</h2>
            <dl className="relief-facts">
              <div>
                <dt>Loại kho</dt>
                <dd>{warehouse.type}</dd>
              </div>
              <div>
                <dt>Giờ hoạt động</dt>
                <dd>
                  <Clock3 size={12} />
                  {warehouse.operatingHours}
                </dd>
              </div>
              <div>
                <dt>Cán bộ phụ trách</dt>
                <dd>
                  {warehouse.responsibleOfficer.name}
                  <small>{warehouse.responsibleOfficer.role}</small>
                </dd>
              </div>
              <div>
                <dt>Cập nhật</dt>
                <dd>{dt(warehouse.lastUpdatedAt)}</dd>
              </div>
            </dl>
            <div className="justification">
              <b>Ghi chú vận hành</b>
              <p>{warehouse.notes}</p>
            </div>
          </section>
          <section className="detail-section">
            <h2>Dòng thời gian kho</h2>
            <div className="detail-timeline">
              {events.map((event) => (
                <div key={event.id}>
                  <span />
                  <div>
                    <b>{event.message}</b>
                    <small>
                      {dt(event.timestamp)} · {event.actor}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {adjust && (
        <StockDialog item={adjust} onClose={() => setAdjust(undefined)} />
      )}{" "}
      {statusDialog && (
        <StatusDialog
          warehouseId={warehouse.id}
          current={warehouse.status}
          active={
            activeShipments.length +
            store.reservations.filter(
              (item) =>
                item.warehouseId === warehouse.id && item.status === "Đang giữ",
            ).length
          }
          onClose={() => setStatusDialog(false)}
        />
      )}
    </div>
  );
}
function StockDialog({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const { adjustWarehouseInventory } = useOperationalState();
  const [value, setValue] = useState(item.quantityOnHand);
  const [error, setError] = useState("");
  const save = () => {
    try {
      adjustWarehouseInventory(item.id, value);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể điều chỉnh tồn kho.",
      );
    }
  };
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog relief-form-dialog small">
        <header>
          <h2>Điều chỉnh tồn kho</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <div className="dispatch-summary">
            <b>{item.name}</b>
            <span>
              Đang giữ {item.quantityReserved} {item.unit}; không được đặt tồn
              thực tế thấp hơn số đã giữ.
            </span>
          </div>
          <label className="field field-full">
            <span>Tồn thực tế mới ({item.unit})</span>
            <Input
              type="number"
              min={item.quantityReserved}
              value={value}
              onChange={(event) => setValue(Number(event.target.value))}
            />
          </label>
          {error && (
            <p className="team-form-error">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save}>Lưu điều chỉnh</Button>
        </footer>
      </div>
    </>
  );
}
function StatusDialog({
  warehouseId,
  current,
  active,
  onClose,
}: {
  warehouseId: string;
  current: WarehouseStatus;
  active: number;
  onClose: () => void;
}) {
  const { setWarehouseStatus } = useOperationalState();
  const [value, setValue] = useState(current);
  const [error, setError] = useState("");
  const save = () => {
    try {
      setWarehouseStatus(warehouseId, value);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đổi trạng thái.",
      );
    }
  };
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog relief-form-dialog small">
        <header>
          <h2>Trạng thái hoạt động kho</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field field-full">
            <span>Trạng thái</span>
            <UiSelect
              value={value}
              onChange={(event) =>
                setValue(event.target.value as WarehouseStatus)
              }
            >
              <option>Hoạt động</option>
              <option>Hạn chế</option>
              <option>Tạm đóng</option>
            </UiSelect>
          </label>
          {value === "Tạm đóng" && active > 0 && (
            <div className="shortage-callout">
              <AlertTriangle size={17} />
              <p>
                Còn {active} phiếu giữ hoặc chuyến đang mở. Hệ thống sẽ chặn
                đóng kho.
              </p>
            </div>
          )}
          {error && (
            <p className="team-form-error">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save}>Lưu trạng thái</Button>
        </footer>
      </div>
    </>
  );
}
