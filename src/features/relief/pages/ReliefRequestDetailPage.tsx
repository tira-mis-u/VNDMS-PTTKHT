import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Send,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import { calculateFulfillment } from "@/domain/relief/rules";
import type {
  DistributionShipment,
  StockReservation,
} from "@/domain/relief/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, EmptyState, StatCard } from "@/components/ui";
const parseOperationalDate = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
  return match
    ? new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
        Number(match[4] ?? 0),
        Number(match[5] ?? 0),
      )
    : null;
};
const formatDateTime = (value: string) => {
  const date = parseOperationalDate(value);
  return date
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : value;
};
const formatRelativeTime = (value: string) => {
  const date = parseOperationalDate(value);
  if (!date) return value;
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} phút trước`;
  const hours = Math.round(minutes / 60);
  return hours < 24
    ? `${hours} giờ trước`
    : `${Math.round(hours / 24)} ngày trước`;
};
import { LogisticsMap } from "../components/LogisticsMap";
import {
  ReliefActionDialogs,
  type ReliefDialog,
} from "../components/ReliefActionDialogs";
const isReliefTerminal = (value: string) =>
  ["Đã đóng", "Từ chối", "Hủy"].includes(value);
const tone = (value: string): "red" | "amber" | "green" | "blue" | "neutral" =>
  value.includes("P1") || value === "Có sự cố"
    ? "red"
    : value.includes("P2") || value === "Thiếu hàng"
      ? "amber"
      : ["Đã xác nhận", "Đã giao", "Hoàn tất", "Đủ hàng"].includes(value)
        ? "green"
        : "blue";
export function ReliefRequestDetailPage({
  requestId,
  navigate,
}: {
  requestId: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const request = store.reliefRequests.find((item) => item.id === requestId);
  const [dialog, setDialog] = useState<ReliefDialog>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<StockReservation>();
  const [selectedShipment, setSelectedShipment] =
    useState<DistributionShipment>();
  const fulfillment = useMemo(
    () => (request ? calculateFulfillment(request, store.reservations) : []),
    [request, store.reservations],
  );
  if (!request)
    return (
      <div className="workspace-content">
        <EmptyState
          title="Không tìm thấy yêu cầu"
          description={`Không có hồ sơ ${requestId}.`}
          action={
            <Button onClick={() => navigate("/relief/requests")}>
              Về danh sách
            </Button>
          }
        />
      </div>
    );
  const reservations = store.reservations.filter(
    (item) => item.reliefRequestId === request.id,
  );
  const shipments = store.shipments.filter(
    (item) => item.reliefRequestId === request.id,
  );
  const events = store.reliefEvents
    .filter(
      (item) =>
        (item.entityType === "request" && item.entityId === request.id) ||
        shipments.some((shipment) => shipment.id === item.entityId),
    )
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const warehouses = store.warehouses.filter((item) =>
    request.assignedWarehouseIds.includes(item.id),
  );
  const openDispatch = (item: StockReservation) => {
    setSelectedReservation(item);
    setDialog("dispatch");
  };
  const openShipment = (
    item: DistributionShipment,
    mode: "shipment" | "receipt",
  ) => {
    setSelectedShipment(item);
    setDialog(mode);
  };
  return (
    <div className="workspace-content relief-detail">
      <div className="detail-topline">
        <button
          className="back-link"
          onClick={() => navigate("/relief/requests")}
        >
          <ArrowLeft size={15} />
          Hàng đợi cứu trợ
        </button>
        <div className="detail-actions">
          {request.status === "Nháp" && store.can("relief_create") && (
            <Button onClick={() => setDialog("submit")}>
              <Send size={15} />
              Gửi yêu cầu
            </Button>
          )}
          {request.status === "Đã gửi" && store.can("relief_approve") && (
            <Button onClick={() => setDialog("review")}>
              <ClipboardCheck size={15} />
              Thẩm định
            </Button>
          )}
          {request.status === "Đang thẩm định" &&
            store.can("relief_approve") && (
              <>
                <Button variant="secondary" onClick={() => setDialog("reject")}>
                  Từ chối
                </Button>
                <Button onClick={() => setDialog("approve")}>
                  <CheckCircle2 size={15} />
                  Phê duyệt
                </Button>
              </>
            )}
          {["Đã duyệt", "Đã giữ hàng"].includes(request.status) &&
            store.can("relief_reserve") && (
              <Button onClick={() => setDialog("reserve")}>
                <Boxes size={15} />
                Chọn kho và giữ hàng
              </Button>
            )}
          {request.status === "Đã xác nhận" && (
            <Button onClick={() => setDialog("close")}>Đóng yêu cầu</Button>
          )}
          {!isReliefTerminal(request.status) &&
            store.can("relief_cancel") &&
            request.status !== "Đã xác nhận" && (
              <Button variant="ghost" onClick={() => setDialog("cancel")}>
                Hủy yêu cầu
              </Button>
            )}
        </div>
      </div>
      <header className="relief-detail-header">
        <div>
          <div className="detail-badges">
            <Badge tone={tone(request.priority)}>{request.priority}</Badge>
            <Badge tone={tone(request.status)}>{request.status}</Badge>
            <span>{request.code}</span>
          </div>
          <h1>{request.destination}</h1>
          <p>
            {request.origin} · {request.requester} ({request.requesterRole})
          </p>
        </div>
        <div className="required-time">
          <CalendarClock size={17} />
          <span>
            Cần trước<b>{formatDateTime(request.requiredBy)}</b>
          </span>
        </div>
      </header>
      <section className="relief-detail-stats">
        <StatCard
          label="Mặt hàng"
          value={request.items.length}
          helper={`${request.items.reduce((sum, item) => sum + item.quantityApproved, 0)} đơn vị được duyệt`}
          icon={<Boxes />}
        />
        <StatCard
          label="Phân bổ"
          value={
            fulfillment.filter((item) => item.state === "Đủ hàng").length +
            "/" +
            fulfillment.length
          }
          helper={
            fulfillment.some((item) => item.shortage > 0)
              ? "Còn thiếu cần xử lý"
              : "Đã đủ hàng"
          }
          icon={<PackageCheck />}
        />
        <StatCard
          label="Kho cung ứng"
          value={warehouses.length}
          helper={
            warehouses.map((item) => item.code).join(", ") || "Chưa chọn kho"
          }
          icon={<Warehouse />}
        />
        <StatCard
          label="Chuyến vận chuyển"
          value={shipments.length}
          helper={
            shipments.map((item) => item.status).join(" · ") || "Chưa xuất kho"
          }
          icon={<Truck />}
        />
      </section>
      <div className="relief-detail-grid">
        <main>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Nhu cầu và phân bổ</h2>
                <p>Không tự động bù phần thiếu; phân bổ theo từng kho</p>
              </div>
            </div>
            <div className="fulfillment-table">
              <div>
                <b>Vật tư</b>
                <b>Yêu cầu</b>
                <b>Đã duyệt</b>
                <b>Đã giữ / xuất</b>
                <b>Thiếu</b>
                <b>Tình trạng</b>
              </div>
              {request.items.map((item) => {
                const state = fulfillment.find(
                  (line) => line.itemCode === item.itemCode,
                )!;
                return (
                  <div key={item.itemCode}>
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.itemCode} · {item.category}
                      </small>
                    </span>
                    <span>
                      {item.quantityRequested} {item.unit}
                    </span>
                    <span>
                      {item.quantityApproved} {item.unit}
                    </span>
                    <span>
                      {state.allocated} {item.unit}
                    </span>
                    <strong className={state.shortage ? "shortage" : ""}>
                      {state.shortage} {item.unit}
                    </strong>
                    <Badge tone={tone(state.state)}>{state.state}</Badge>
                  </div>
                );
              })}
            </div>
            {fulfillment.some((item) => item.shortage > 0) && (
              <div className="shortage-callout">
                <ShieldAlert size={18} />
                <div>
                  <b>Thiếu hàng chưa được phân bổ</b>
                  <p>
                    Tiếp tục chọn kho khác hoặc báo cáo điều phối. Hệ thống
                    không coi phần thiếu là đã đáp ứng.
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Giữ hàng và xuất kho</h2>
                <p>Mỗi phiếu giữ sử dụng tồn kho chính thức tại một kho</p>
              </div>
            </div>
            {reservations.length ? (
              <div className="reservation-list">
                {reservations.map((item) => {
                  const warehouse = store.warehouses.find(
                    (row) => row.id === item.warehouseId,
                  );
                  return (
                    <article key={item.id}>
                      <div>
                        <span className="entity-icon">
                          <Warehouse size={17} />
                        </span>
                        <span>
                          <b>
                            {item.id} · {warehouse?.name}
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
                      </div>
                      <div>
                        <Badge
                          tone={
                            item.status === "Đang giữ"
                              ? "amber"
                              : item.status === "Đã xuất kho"
                                ? "green"
                                : "neutral"
                          }
                        >
                          {item.status}
                        </Badge>
                        {item.status === "Đang giữ" &&
                          store.can("relief_dispatch") && (
                            <Button
                              size="sm"
                              onClick={() => openDispatch(item)}
                            >
                              Xuất kho
                            </Button>
                          )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Chưa có phiếu giữ hàng"
                description="Phê duyệt yêu cầu và chọn kho để giữ hàng."
              />
            )}
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Vận chuyển và giao nhận</h2>
                <p>
                  Cập nhật theo mốc tác nghiệp, không mô phỏng GPS thời gian
                  thực
                </p>
              </div>
            </div>
            {shipments.length ? (
              <div className="shipment-list">
                {shipments.map((item) => (
                  <article
                    key={item.id}
                    className={item.status === "Có sự cố" ? "has-incident" : ""}
                  >
                    <div className="shipment-title">
                      <span className="entity-icon">
                        <Truck size={17} />
                      </span>
                      <div>
                        <b>
                          {item.id} · {item.transportMethod}
                        </b>
                        <small>
                          {
                            store.warehouses.find(
                              (row) => row.id === item.warehouseId,
                            )?.name
                          }{" "}
                          → {item.destination}
                        </small>
                      </div>
                      <Badge tone={tone(item.status)}>{item.status}</Badge>
                    </div>
                    <div className="shipment-facts">
                      <span>
                        Tài xế<b>{item.driver}</b>
                      </span>
                      <span>
                        Liên hệ<b>{item.contact}</b>
                      </span>
                      <span>
                        Dự kiến đến
                        <b>{formatDateTime(item.estimatedArrival)}</b>
                      </span>
                      <span>
                        Đội phụ trách<b>{item.assignedTeamId ?? "Xe kho"}</b>
                      </span>
                    </div>
                    <p>{item.trackingNote}</p>
                    <div className="shipment-actions">
                      {store.can("shipment_update") &&
                        !["Đã giao", "Hoàn tất"].includes(item.status) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openShipment(item, "shipment")}
                          >
                            Cập nhật vận chuyển
                          </Button>
                        )}
                      {item.status === "Đã giao" &&
                        store.can("relief_receive") && (
                          <Button
                            size="sm"
                            onClick={() => openShipment(item, "receipt")}
                          >
                            Xác nhận biên nhận
                          </Button>
                        )}
                      {item.receipt && (
                        <span>
                          <CheckCircle2 size={14} />
                          Nhận bởi {item.receipt.receiverName} lúc{" "}
                          {formatDateTime(item.receipt.receivedAt)}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có chuyến vận chuyển"
                description="Chuyến được tạo khi xuất một phiếu giữ hàng hợp lệ."
              />
            )}
          </section>
        </main>
        <aside>
          <section className="detail-section map-section">
            <div className="section-heading">
              <div>
                <h2>Điểm nhận và tuyến vận chuyển</h2>
                <p>{request.destination}</p>
              </div>
            </div>
            <LogisticsMap
              warehouses={warehouses}
              request={request}
              shipments={shipments}
              navigate={navigate}
            />
          </section>
          <section className="detail-section">
            <h2>Thông tin tác nghiệp</h2>
            <dl className="relief-facts">
              <div>
                <dt>Nguồn yêu cầu</dt>
                <dd>{request.origin}</dd>
              </div>
              <div>
                <dt>Sự cố liên kết</dt>
                <dd>
                  {request.incidentId ? (
                    <button
                      onClick={() =>
                        navigate(`/incidents/${request.incidentId}`)
                      }
                    >
                      {request.incidentId}
                    </button>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Điểm sơ tán</dt>
                <dd>
                  {request.shelterId ? (
                    <button
                      onClick={() => navigate(`/shelters/${request.shelterId}`)}
                    >
                      {request.shelterId}
                    </button>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Thời điểm tạo</dt>
                <dd>{formatDateTime(request.createdAt)}</dd>
              </div>
              <div>
                <dt>Phê duyệt</dt>
                <dd>{request.approvedBy ?? "Chưa phê duyệt"}</dd>
              </div>
            </dl>
            <div className="justification">
              <b>Lý do</b>
              <p>{request.justification}</p>
            </div>
          </section>
          <section className="detail-section">
            <h2>Dòng thời gian</h2>
            <div className="detail-timeline">
              {events.map((event) => (
                <div key={event.id}>
                  <span />
                  <div>
                    <b>{event.message}</b>
                    <small>
                      {formatRelativeTime(event.timestamp)} · {event.actor} ·{" "}
                      {event.source}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <ReliefActionDialogs
        mode={dialog}
        request={request}
        reservation={selectedReservation}
        shipment={selectedShipment}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
