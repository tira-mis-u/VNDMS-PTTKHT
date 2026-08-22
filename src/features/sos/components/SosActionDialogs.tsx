import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { SosPriority, SosRequest } from "@/domain/sos/types";
import { calculateShelterCapacity } from "@/domain/shelters/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Button } from "@/components/ui";
export type SosDialog =
  | "verify"
  | "reject"
  | "incident"
  | "task"
  | "priority"
  | "location"
  | "update"
  | "no-contact"
  | "shelter"
  | "resolve"
  | "close"
  | "cancel"
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
      <button className="dialog-backdrop" onClick={onClose} />
      <div className="incident-form-dialog sos-form-dialog">
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
export function SosActionDialogs({
  mode,
  sos,
  onClose,
}: {
  mode: SosDialog;
  sos: SosRequest;
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
  if (mode === "verify")
    return (
      <Confirm
        title="Xác minh SOS"
        text="Xác nhận thông tin người báo, vị trí và số người gặp nguy hiểm là hợp lệ."
        action="Hoàn tất xác minh"
        error={error}
        onClose={onClose}
        onSubmit={() => run(() => actions.verifySos(sos.id))}
      />
    );
  if (mode === "reject")
    return (
      <Confirm
        title="Từ chối SOS"
        text="Yêu cầu sẽ kết thúc với trạng thái không hợp lệ và không thể điều phối."
        action="Xác nhận từ chối"
        error={error}
        danger
        onClose={onClose}
        onSubmit={() => run(() => actions.rejectSos(sos.id))}
      />
    );
  if (mode === "no-contact")
    return (
      <Confirm
        title="Đánh dấu không liên lạc được"
        text="Trạng thái liên lạc và lifecycle SOS sẽ được cập nhật, yêu cầu vẫn nằm trong hàng đợi ngoại lệ."
        action="Cập nhật trạng thái"
        error={error}
        onClose={onClose}
        onSubmit={() => run(() => actions.markSosNoContact(sos.id))}
      />
    );
  if (mode === "cancel")
    return (
      <Confirm
        title="Hủy yêu cầu SOS"
        text="Yêu cầu sẽ kết thúc và không tiếp tục điều phối. Chỉ thực hiện khi có quyết định nghiệp vụ hợp lệ."
        action="Xác nhận hủy"
        error={error}
        danger
        onClose={onClose}
        onSubmit={() => run(() => actions.cancelSos(sos.id))}
      />
    );
  if (mode === "close")
    return (
      <Confirm
        title="Đóng SOS"
        text="Chỉ đóng sau khi đã ghi nhận kết quả xử lý và xác nhận an toàn."
        action="Xác nhận đóng"
        error={error}
        onClose={onClose}
        onSubmit={() => run(() => actions.closeSos(sos.id))}
      />
    );
  if (mode === "incident")
    return <IncidentLink sos={sos} error={error} run={run} onClose={onClose} />;
  if (mode === "task")
    return <TaskCreate sos={sos} error={error} run={run} onClose={onClose} />;
  if (mode === "priority")
    return <Priority sos={sos} error={error} run={run} onClose={onClose} />;
  if (mode === "location")
    return <Location sos={sos} error={error} run={run} onClose={onClose} />;
  if (mode === "update")
    return (
      <TextAction
        title="Thêm diễn biến"
        label="Nội dung cập nhật"
        action="Thêm diễn biến"
        error={error}
        onClose={onClose}
        submit={(value) => run(() => actions.addSosUpdate(sos.id, value))}
      />
    );
  if (mode === "resolve")
    return (
      <TextAction
        title="Đánh dấu đã xử lý"
        label="Kết quả xử lý"
        action="Xác nhận kết quả"
        error={error}
        onClose={onClose}
        submit={(value) => run(() => actions.resolveSos(sos.id, value))}
      />
    );
  if (mode === "shelter")
    return <ShelterRoute sos={sos} error={error} run={run} onClose={onClose} />;
  return null;
}
function Confirm({
  title,
  text,
  action,
  error,
  danger,
  onClose,
  onSubmit,
}: {
  title: string;
  text: string;
  action: string;
  error: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Frame
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={onSubmit}>{action}</Button>
        </>
      }
    >
      <div className={`sos-confirm ${danger ? "danger" : ""}`}>
        <AlertTriangle size={18} />
        <p>{text}</p>
      </div>
      <ErrorText value={error} />
    </Frame>
  );
}
function IncidentLink({
  sos,
  error,
  run,
  onClose,
}: {
  sos: SosRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { incidents, linkSosToIncident, createIncidentFromSos } =
    useOperationalState();
  const open = incidents.filter((item) => item.status !== "Đã đóng");
  const [id, setId] = useState(open[0]?.id ?? "");
  return (
    <Frame
      title="Liên kết SOS với sự cố"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => run(() => createIncidentFromSos(sos.id))}
          >
            Tạo Incident từ SOS
          </Button>
          <Button
            disabled={!id}
            onClick={() => run(() => linkSosToIncident(sos.id, id))}
          >
            Liên kết sự cố
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Sự cố hiện có</span>
        <select value={id} onChange={(event) => setId(event.target.value)}>
          {open.map((incident) => (
            <option key={incident.id} value={incident.id}>
              {incident.id} — {incident.title}
            </option>
          ))}
        </select>
      </label>
      <p className="form-hint">
        Tạo mới sẽ sao chép vị trí, dân số ảnh hưởng và mức độ nhưng vẫn giữ SOS
        gốc.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}
function TaskCreate({
  sos,
  error,
  run,
  onClose,
}: {
  sos: SosRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { teams, createRescueTaskFromSos } = useOperationalState();
  const eligible = teams.filter(
    (team) =>
      team.status === "Sẵn sàng" &&
      !team.currentTask &&
      !team.currentEvacuationOperation,
  );
  const [id, setId] = useState(eligible[0]?.id ?? "");
  return (
    <Frame
      title="Tạo nhiệm vụ và giao đội cứu hộ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!id}
            onClick={() => run(() => createRescueTaskFromSos(sos.id, id))}
          >
            Tạo và điều phối
          </Button>
        </>
      }
    >
      <div className="eligible-team-list">
        {eligible.map((team) => (
          <label key={team.id} className={id === team.id ? "selected" : ""}>
            <input
              type="radio"
              name="team"
              value={team.id}
              checked={id === team.id}
              onChange={() => setId(team.id)}
            />
            <span>
              <b>
                {team.id} · {team.name}
              </b>
              <small>
                {team.capability} · {team.region} · {team.distance}
              </small>
            </span>
            <i>{team.availability}</i>
          </label>
        ))}
      </div>
      {!eligible.length && (
        <p className="form-hint">
          Không có đội đủ điều kiện điều phối tại thời điểm này.
        </p>
      )}
      <ErrorText value={error} />
    </Frame>
  );
}
function Priority({
  sos,
  error,
  run,
  onClose,
}: {
  sos: SosRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { updateSosPriority } = useOperationalState();
  const [value, setValue] = useState<SosPriority>(sos.priority);
  return (
    <Frame
      title="Cập nhật ưu tiên SOS"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => run(() => updateSosPriority(sos.id, value))}>
            Lưu ưu tiên
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Mức ưu tiên</span>
        <select
          value={value}
          onChange={(event) => setValue(event.target.value as SosPriority)}
        >
          <option>P1 — Khẩn cấp</option>
          <option>P2 — Cao</option>
          <option>P3 — Trung bình</option>
          <option>P4 — Thấp</option>
        </select>
      </label>
      <div className="triage-reasons">
        <b>Lý do triage hiện tại</b>
        {sos.triageReasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <ErrorText value={error} />
    </Frame>
  );
}
function Location({
  sos,
  error,
  run,
  onClose,
}: {
  sos: SosRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { updateSosLocation } = useOperationalState();
  const [form, setForm] = useState({
    ...sos.location,
    longitude: String(sos.location.coordinates[0]),
    latitude: String(sos.location.coordinates[1]),
  });
  const patch = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () =>
    updateSosLocation(sos.id, {
      name: form.name,
      address: form.address,
      administrativeArea: form.administrativeArea,
      coordinates: [Number(form.longitude), Number(form.latitude)],
      accessCondition: form.accessCondition,
      floodDepth: form.floodDepth,
    });
  return (
    <Frame
      title="Cập nhật vị trí SOS"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => run(submit)}>Lưu vị trí</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Địa chỉ</span>
        <input
          value={form.address}
          onChange={(event) => patch("address", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Kinh độ</span>
        <input
          value={form.longitude}
          onChange={(event) => patch("longitude", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Vĩ độ</span>
        <input
          value={form.latitude}
          onChange={(event) => patch("latitude", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Tiếp cận</span>
        <select
          value={form.accessCondition}
          onChange={(event) => patch("accessCondition", event.target.value)}
        >
          <option>Tiếp cận bình thường</option>
          <option>Hạn chế đường bộ</option>
          <option>Bị cô lập</option>
        </select>
      </label>
      <label className="field">
        <span>Độ sâu ngập</span>
        <input
          value={form.floodDepth}
          onChange={(event) => patch("floodDepth", event.target.value)}
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function TextAction({
  title,
  label,
  action,
  error,
  onClose,
  submit,
}: {
  title: string;
  label: string;
  action: string;
  error: string;
  onClose: () => void;
  submit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Frame
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!value.trim()} onClick={() => submit(value)}>
            {action}
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>{label}</span>
        <textarea
          rows={4}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nhập thông tin tác nghiệp đã được xác nhận…"
        />
      </label>
      <ErrorText value={error} />
    </Frame>
  );
}
function ShelterRoute({
  sos,
  error,
  run,
  onClose,
}: {
  sos: SosRequest;
  error: string;
  run: (action: () => unknown) => void;
  onClose: () => void;
}) {
  const { shelters, routeSosToShelter } = useOperationalState();
  const eligible = shelters.filter(
    (shelter) =>
      !["Quá tải", "Tạm đóng", "Không thể tiếp cận"].includes(shelter.status) &&
      calculateShelterCapacity(shelter).availableCapacity >= sos.peopleAtRisk,
  );
  const [id, setId] = useState(eligible[0]?.id ?? "");
  return (
    <Frame
      title="Chuyển đến điểm sơ tán"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!id}
            onClick={() => run(() => routeSosToShelter(sos.id, id))}
          >
            Tạo hoạt động sơ tán
          </Button>
        </>
      }
    >
      <div className="eligible-shelter-list">
        {eligible.map((shelter) => {
          const capacity = calculateShelterCapacity(shelter);
          return (
            <label
              key={shelter.id}
              className={id === shelter.id ? "selected" : ""}
            >
              <input
                type="radio"
                checked={id === shelter.id}
                onChange={() => setId(shelter.id)}
              />
              <span>
                <b>
                  {shelter.id} · {shelter.name}
                </b>
                <small>
                  {shelter.administrativeArea} · {shelter.medicalCapability}
                </small>
              </span>
              <i>{capacity.availableCapacity} chỗ</i>
            </label>
          );
        })}
      </div>
      <ErrorText value={error} />
    </Frame>
  );
}
