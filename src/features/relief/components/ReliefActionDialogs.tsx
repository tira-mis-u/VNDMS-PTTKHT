import { Select as UiSelect } from "@/components/ui/Select";
import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type {
  DistributionShipment,
  ReliefRequest,
  ReliefRequestStatus,
  ShipmentStatus,
  StockReservation,
} from "@/domain/relief/types";
import {
  availableQuantity,
  calculateFulfillment,
  getShipmentTransitions,
} from "@/domain/relief/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Button, Input, Textarea } from "@/components/ui";
export type ReliefDialog =
  | "submit"
  | "review"
  | "approve"
  | "reject"
  | "reserve"
  | "dispatch"
  | "shipment"
  | "receipt"
  | "cancel"
  | "close"
  | null;
function Frame({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="incident-form-dialog relief-form-dialog">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">{children}</div>
        <footer>{footer}</footer>
      </div>
    </>
  );
}
function ErrorText({ value }: { value: string }) {
  return value ? (
    <p className="team-form-error">
      <AlertTriangle size={14} />
      {value}
    </p>
  ) : null;
}
export function ReliefActionDialogs({
  mode,
  request,
  reservation,
  shipment,
  onClose,
}: {
  mode: ReliefDialog;
  request: ReliefRequest;
  reservation?: StockReservation;
  shipment?: DistributionShipment;
  onClose: () => void;
}) {
  const actions = useOperationalState();
  const [error, setError] = useState("");
  if (!mode) return null;
  const run = (action: () => unknown) => {
    try {
      action();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể thực hiện thao tác.",
      );
    }
  };
  const confirm = (
    title: string,
    text: string,
    status: ReliefRequestStatus,
    action: string,
  ) => (
    <Frame
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() =>
              run(() => actions.transitionReliefRequest(request.id, status))
            }
          >
            {action}
          </Button>
        </>
      }
    >
      <div className="relief-confirm">
        <AlertTriangle size={17} />
        <p>{text}</p>
      </div>
      <ErrorText value={error} />
    </Frame>
  );
  if (mode === "submit")
    return confirm(
      "Gửi yêu cầu",
      "Yêu cầu sẽ được chuyển vào hàng đợi thẩm định.",
      "Đã gửi",
      "Gửi yêu cầu",
    );
  if (mode === "review")
    return confirm(
      "Bắt đầu thẩm định",
      "Xác nhận nhu cầu, điểm nhận và thời hạn trước khi phê duyệt.",
      "Đang thẩm định",
      "Bắt đầu thẩm định",
    );
  if (mode === "reject")
    return confirm(
      "Từ chối yêu cầu",
      "Yêu cầu sẽ kết thúc và không được phân bổ vật tư.",
      "Từ chối",
      "Xác nhận từ chối",
    );
  if (mode === "cancel")
    return confirm(
      "Hủy yêu cầu",
      "Các phiếu giữ hàng còn hiệu lực sẽ được giải phóng về tồn khả dụng.",
      "Hủy",
      "Xác nhận hủy",
    );
  if (mode === "close")
    return confirm(
      "Đóng yêu cầu",
      "Chỉ đóng sau khi tất cả giao nhận đã được xác nhận.",
      "Đã đóng",
      "Đóng yêu cầu",
    );
  if (mode === "approve")
    return (
      <Approve request={request} error={error} run={run} onClose={onClose} />
    );
  if (mode === "reserve")
    return (
      <Reserve request={request} error={error} run={run} onClose={onClose} />
    );
  if (mode === "dispatch" && reservation)
    return (
      <Dispatch
        reservation={reservation}
        request={request}
        error={error}
        run={run}
        onClose={onClose}
      />
    );
  if (mode === "shipment" && shipment)
    return (
      <ShipmentUpdate
        shipment={shipment}
        error={error}
        run={run}
        onClose={onClose}
      />
    );
  if (mode === "receipt" && shipment)
    return (
      <Receipt shipment={shipment} error={error} run={run} onClose={onClose} />
    );
  return null;
}
function Approve({
  request,
  error,
  run,
  onClose,
}: {
  request: ReliefRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { approveReliefRequest } = useOperationalState();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(
      request.items.map((item) => [item.itemCode, item.quantityRequested]),
    ),
  );
  return (
    <Frame
      title="Phê duyệt yêu cầu cứu trợ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => run(() => approveReliefRequest(request.id, values))}
          >
            Phê duyệt
          </Button>
        </>
      }
    >
      <div className="allocation-editor">
        {request.items.map((item) => (
          <label key={item.itemCode}>
            <span>
              <b>{item.name}</b>
              <small>
                Yêu cầu {item.quantityRequested} {item.unit}
              </small>
            </span>
            <Input
              type="number"
              min="0"
              max={item.quantityRequested}
              value={values[item.itemCode]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [item.itemCode]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>
      <ErrorText value={error} />
    </Frame>
  );
}
function Reserve({
  request,
  error,
  run,
  onClose,
}: {
  request: ReliefRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { warehouses, inventory, reservations, reserveReliefStock } =
    useOperationalState();
  const [id, setId] = useState(
    warehouses.find((item) => item.status !== "Tạm đóng")?.id ?? "",
  );
  const fulfillment = calculateFulfillment(request, reservations);
  const items = inventory.filter((item) => item.warehouseId === id);
  const [values, setValues] = useState<Record<string, number>>({});
  const submit = () =>
    reserveReliefStock(
      request.id,
      id,
      Object.entries(values).map(([itemCode, quantity]) => ({
        itemCode,
        quantity,
      })),
    );
  return (
    <Frame
      title="Giữ hàng từ kho"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => run(submit)}>Xác nhận giữ hàng</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Kho cung ứng</span>
        <UiSelect
          value={id}
          onChange={(event) => {
            setId(event.target.value);
            setValues({});
          }}
        >
          {warehouses
            .filter((item) => item.status !== "Tạm đóng")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} — {item.name}
              </option>
            ))}
        </UiSelect>
      </label>
      <div className="allocation-editor">
        {request.items.map((requestItem) => {
          const stock = items.find(
            (item) => item.itemCode === requestItem.itemCode,
          );
          const remaining =
            fulfillment.find((item) => item.itemCode === requestItem.itemCode)
              ?.shortage ?? 0;
          const available = stock ? availableQuantity(stock) : 0;
          return (
            <label
              key={requestItem.itemCode}
              className={!stock ? "unavailable" : ""}
            >
              <span>
                <b>{requestItem.name}</b>
                <small>
                  Còn cần {remaining} {requestItem.unit} · Kho có {available}
                </small>
              </span>
              <Input
                type="number"
                min="0"
                max={Math.min(remaining, available)}
                disabled={!stock || available === 0}
                value={values[requestItem.itemCode] ?? 0}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [requestItem.itemCode]: Number(event.target.value),
                  }))
                }
              />
            </label>
          );
        })}
      </div>
      <p className="form-hint">
        Có thể giữ một phần và tiếp tục chọn kho khác cho phần thiếu.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}
function Dispatch({
  reservation,
  request,
  error,
  run,
  onClose,
}: {
  reservation: StockReservation;
  request: ReliefRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { teams, dispatchReliefReservation } = useOperationalState();
  const eligible = teams.filter(
    (team) =>
      team.status === "Sẵn sàng" &&
      !team.currentTask &&
      !team.currentEvacuationOperation &&
      !team.currentReliefShipment,
  );
  const [teamId, setTeam] = useState("");
  return (
    <Frame
      title={`Xuất kho ${reservation.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() =>
              run(() =>
                dispatchReliefReservation(reservation.id, teamId || null),
              )
            }
          >
            Xuất kho
          </Button>
        </>
      }
    >
      <div className="dispatch-summary">
        <b>{request.destination}</b>
        <span>
          {reservation.items
            .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
            .join(" · ")}
        </span>
      </div>
      <label className="field field-full">
        <span>Đội vận chuyển (không bắt buộc)</span>
        <UiSelect
          value={teamId}
          onChange={(event) => setTeam(event.target.value)}
        >
          <option value="">Xe vận tải của kho</option>
          {eligible.map((team) => (
            <option key={team.id} value={team.id}>
              {team.id} — {team.name} · {team.distance}
            </option>
          ))}
        </UiSelect>
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function ShipmentUpdate({
  shipment,
  error,
  run,
  onClose,
}: {
  shipment: DistributionShipment;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { updateShipmentStatus } = useOperationalState();
  const options = getShipmentTransitions(shipment.status);
  const [status, setStatus] = useState<ShipmentStatus>(
    options[0] ?? shipment.status,
  );
  const [note, setNote] = useState(shipment.trackingNote);
  return (
    <Frame
      title={`Cập nhật ${shipment.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!options.length}
            onClick={() =>
              run(() => updateShipmentStatus(shipment.id, status, note))
            }
          >
            Lưu vận chuyển
          </Button>
        </>
      }
    >
      <label className="field">
        <span>Trạng thái hiện tại</span>
        <Input value={shipment.status} disabled />
      </label>
      <label className="field">
        <span>Chuyển sang</span>
        <UiSelect
          value={status}
          onChange={(event) => setStatus(event.target.value as ShipmentStatus)}
        >
          {options.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </UiSelect>
      </label>
      <label className="field field-full">
        <span>Ghi chú vận chuyển</span>
        <Textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function Receipt({
  shipment,
  error,
  run,
  onClose,
}: {
  shipment: DistributionShipment;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { confirmShipmentReceipt } = useOperationalState();
  const [receiver, setReceiver] = useState("");
  const [role, setRole] = useState("Phụ trách điểm nhận");
  const [note, setNote] = useState("Đủ số lượng, tình trạng tốt");
  return (
    <Frame
      title="Xác nhận giao nhận"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!receiver}
            onClick={() =>
              run(() =>
                confirmShipmentReceipt(shipment.id, receiver, role, note),
              )
            }
          >
            Xác nhận biên nhận
          </Button>
        </>
      }
    >
      <label className="field">
        <span>Người nhận</span>
        <Input
          value={receiver}
          onChange={(event) => setReceiver(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Vai trò</span>
        <Input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>
      <label className="field field-full">
        <span>Tình trạng hàng</span>
        <Textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
