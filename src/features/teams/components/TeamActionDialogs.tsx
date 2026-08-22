import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, MapPin, Radio, X } from "lucide-react";
import type { TaskPriority } from "@/domain/tasks/types";
import type {
  RescueTeam,
  TeamLocation,
  TeamStatus,
} from "@/domain/teams/types";
import {
  capabilityOptions,
  getAllowedTeamTransitions,
} from "@/domain/teams/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Button } from "@/components/ui";

export type TeamDialog =
  | "dispatch"
  | "status"
  | "location"
  | "edit"
  | "capabilities"
  | "release"
  | null;
export function TeamActionDialogs({
  mode,
  team,
  onClose,
}: {
  mode: TeamDialog;
  team: RescueTeam;
  onClose: () => void;
}) {
  if (!mode) return null;
  return (
    <>
      <button
        className="dialog-backdrop"
        onClick={onClose}
        aria-label="Đóng hộp thoại"
      />
      {mode === "dispatch" && <Dispatch team={team} onClose={onClose} />}{" "}
      {mode === "status" && <Status team={team} onClose={onClose} />}{" "}
      {mode === "location" && <Location team={team} onClose={onClose} />}{" "}
      {mode === "edit" && <EditProfile team={team} onClose={onClose} />}{" "}
      {mode === "capabilities" && (
        <Capabilities team={team} onClose={onClose} />
      )}{" "}
      {mode === "release" && <Release team={team} onClose={onClose} />}{" "}
    </>
  );
}
function Frame({
  title,
  eyebrow,
  children,
  footer,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="incident-form-dialog team-form-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
      </header>
      <div className="incident-form-body">{children}</div>
      <footer>{footer}</footer>
    </div>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="team-form-error">
      <AlertTriangle size={14} />
      {message}
    </p>
  ) : null;
}

function Dispatch({
  team,
  onClose,
}: {
  team: RescueTeam;
  onClose: () => void;
}) {
  const { incidents, tasks, dispatchTeamToTask } = useOperationalState();
  const [error, setError] = useState("");
  const openIncidents = incidents.filter(
    (incident) => incident.status !== "Đã đóng",
  );
  const [incidentId, setIncident] = useState(
    team.currentIncident ?? openIncidents[0]?.id ?? "",
  );
  const candidates = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.incidentId === incidentId &&
          !["Hoàn thành", "Đã hủy"].includes(task.status),
      ),
    [tasks, incidentId],
  );
  const [taskId, setTask] = useState(
    team.currentTask ?? candidates[0]?.id ?? "",
  );
  const task = candidates.find((item) => item.id === taskId);
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "Cao",
  );
  const [destination, setDestination] = useState(
    task?.location ??
      openIncidents.find((item) => item.id === incidentId)?.location.name ??
      "",
  );
  const [note, setNote] = useState("");
  const changeIncident = (id: string) => {
    setIncident(id);
    const first = tasks.find(
      (item) =>
        item.incidentId === id &&
        !["Hoàn thành", "Đã hủy"].includes(item.status),
    );
    setTask(first?.id ?? "");
    setDestination(
      first?.location ??
        incidents.find((item) => item.id === id)?.location.name ??
        "",
    );
  };
  const submit = () => {
    try {
      if (!taskId) return;
      dispatchTeamToTask(
        team.id,
        taskId,
        incidentId,
        priority,
        destination,
        note,
      );
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể điều phối đội.",
      );
    }
  };
  return (
    <Frame
      title="Điều phối đội cứu hộ"
      eyebrow={`${team.id} · ${team.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!taskId || !destination} onClick={submit}>
            Xác nhận điều phối
          </Button>
        </>
      }
    >
      <div className="dispatch-team-context">
        <Radio size={16} />
        <div>
          <b>Trạng thái hiện tại: {team.status}</b>
          <span>
            {team.availability} · {team.capability}
          </span>
        </div>
      </div>
      <label className="field">
        <span>Sự cố</span>
        <select
          value={incidentId}
          onChange={(event) => changeIncident(event.target.value)}
        >
          {openIncidents.map((incident) => (
            <option value={incident.id} key={incident.id}>
              {incident.id} — {incident.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Nhiệm vụ</span>
        <select
          value={taskId}
          onChange={(event) => {
            setTask(event.target.value);
            const selected = tasks.find(
              (item) => item.id === event.target.value,
            );
            if (selected) {
              setPriority(selected.priority);
              setDestination(selected.location);
            }
          }}
        >
          <option value="">Chọn nhiệm vụ</option>
          {candidates.map((item) => (
            <option value={item.id} key={item.id}>
              {item.id} — {item.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Mức ưu tiên</span>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
        >
          <option>Khẩn cấp</option>
          <option>Cao</option>
          <option>Trung bình</option>
          <option>Thấp</option>
        </select>
      </label>
      <label className="field field-full">
        <span>Điểm đến</span>
        <div className="input-with-icon">
          <MapPin size={14} />
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </div>
      </label>
      <label className="field field-full">
        <span>Ghi chú điều phối</span>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Chỉ dẫn tiếp cận hoặc yêu cầu phối hợp…"
        />
      </label>
      <ErrorMessage message={error} />
    </Frame>
  );
}
function Status({ team, onClose }: { team: RescueTeam; onClose: () => void }) {
  const { updateTeamStatus } = useOperationalState();
  const options = getAllowedTeamTransitions(team);
  const [status, setStatus] = useState<TeamStatus>(options[0] ?? team.status);
  const [error, setError] = useState("");
  const submit = () => {
    try {
      updateTeamStatus(team.id, status);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật trạng thái.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật trạng thái đội"
      eyebrow={team.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!options.length} onClick={submit}>
            Cập nhật
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Trạng thái hiện tại</span>
        <input value={team.status} disabled />
      </label>
      <label className="field field-full">
        <span>Chuyển sang</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as TeamStatus)}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <p className="form-hint">
        Quy tắc chuyển trạng thái được kiểm tra tại application/domain layer.
        Đội còn nhiệm vụ mở không thể chuyển về Sẵn sàng.
      </p>
      <ErrorMessage message={error} />
    </Frame>
  );
}
function Location({
  team,
  onClose,
}: {
  team: RescueTeam;
  onClose: () => void;
}) {
  const { updateTeamLocation } = useOperationalState();
  const [latitude, setLat] = useState(String(team.location.latitude));
  const [longitude, setLng] = useState(String(team.location.longitude));
  const [accuracy, setAccuracy] = useState(String(team.location.accuracy));
  const [source, setSource] =
    useState<TeamLocation["source"]>("Điều hành viên");
  const [error, setError] = useState("");
  const submit = () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const accuracyValue = Number(accuracy);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(accuracyValue) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      accuracyValue <= 0
    ) {
      setError("Tọa độ hoặc độ chính xác không hợp lệ.");
      return;
    }
    try {
      updateTeamLocation(team.id, {
        latitude: lat,
        longitude: lng,
        accuracy: accuracyValue,
        timestamp: "21/08/2026 10:45:00",
        source,
        communicationStatus: "Kết nối",
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể cập nhật vị trí.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật vị trí đội"
      eyebrow={team.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu vị trí</Button>
        </>
      }
    >
      <label className="field">
        <span>Vĩ độ</span>
        <input
          value={latitude}
          onChange={(event) => setLat(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Kinh độ</span>
        <input
          value={longitude}
          onChange={(event) => setLng(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Độ chính xác (m)</span>
        <input
          value={accuracy}
          onChange={(event) => setAccuracy(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Nguồn</span>
        <select
          value={source}
          onChange={(event) =>
            setSource(event.target.value as TeamLocation["source"])
          }
        >
          <option>GPS</option>
          <option>Thiết bị di động</option>
          <option>Điều hành viên</option>
        </select>
      </label>
      <p className="form-hint">
        Đây là bản cập nhật thủ công cho dữ liệu demo, không mô phỏng luồng GPS
        thời gian thực.
      </p>
      <ErrorMessage message={error} />
    </Frame>
  );
}
function EditProfile({
  team,
  onClose,
}: {
  team: RescueTeam;
  onClose: () => void;
}) {
  const { updateTeamProfile } = useOperationalState();
  const [form, setForm] = useState({
    name: team.name,
    type: team.type,
    leader: team.leader,
    contact: team.contact,
    region: team.region,
    operatingScope: team.operatingScope,
    notes: team.notes,
  });
  const [error, setError] = useState("");
  const field = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    try {
      updateTeamProfile(team.id, form);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật hồ sơ đội.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật thông tin đội"
      eyebrow={team.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu thông tin</Button>
        </>
      }
    >
      <label className="field">
        <span>Tên đội</span>
        <input
          value={form.name}
          onChange={(event) => field("name", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Loại đội</span>
        <input
          value={form.type}
          onChange={(event) => field("type", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Đội trưởng</span>
        <input
          value={form.leader}
          onChange={(event) => field("leader", event.target.value)}
        />
      </label>
      <label className="field">
        <span>Liên hệ</span>
        <input
          value={form.contact}
          onChange={(event) => field("contact", event.target.value)}
        />
      </label>
      <label className="field field-full">
        <span>Đơn vị / khu vực đóng quân</span>
        <input
          value={form.region}
          onChange={(event) => field("region", event.target.value)}
        />
      </label>
      <label className="field field-full">
        <span>Phạm vi hoạt động</span>
        <input
          value={form.operatingScope}
          onChange={(event) => field("operatingScope", event.target.value)}
        />
      </label>
      <label className="field field-full">
        <span>Ghi chú vận hành</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => field("notes", event.target.value)}
        />
      </label>
      <ErrorMessage message={error} />
    </Frame>
  );
}
function Capabilities({
  team,
  onClose,
}: {
  team: RescueTeam;
  onClose: () => void;
}) {
  const { updateTeamCapabilities } = useOperationalState();
  const [selected, setSelected] = useState(team.capabilities);
  const [error, setError] = useState("");
  const toggle = (item: string) =>
    setSelected((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  const submit = () => {
    try {
      updateTeamCapabilities(team.id, selected);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật năng lực.",
      );
    }
  };
  return (
    <Frame
      title="Cập nhật năng lực tác chiến"
      eyebrow={team.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu năng lực</Button>
        </>
      }
    >
      <div className="team-capability-editor">
        {capabilityOptions.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => toggle(item)}
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <p className="form-hint">
        Năng lực đầu tiên được dùng làm năng lực chính khi sắp xếp và hiển thị
        worklist.
      </p>
      <ErrorMessage message={error} />
    </Frame>
  );
}
function Release({ team, onClose }: { team: RescueTeam; onClose: () => void }) {
  const { tasks, releaseTeamFromTask } = useOperationalState();
  const task = tasks.find((item) => item.id === team.currentTask);
  const [error, setError] = useState("");
  const submit = () => {
    try {
      releaseTeamFromTask(team.id);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể gỡ phân công.",
      );
    }
  };
  return (
    <Frame
      title="Gỡ đội khỏi nhiệm vụ"
      eyebrow={team.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Xác nhận gỡ phân công</Button>
        </>
      }
    >
      <div className="team-release-warning">
        <AlertTriangle size={18} />
        <div>
          <b>
            {task
              ? `${task.id} — ${task.title}`
              : "Không tìm thấy nhiệm vụ hiện tại"}
          </b>
          <p>
            Nhiệm vụ sẽ trở về trạng thái Chờ giao. Đội được tính lại khả dụng
            từ các nhiệm vụ còn mở.
          </p>
        </div>
      </div>
      <ErrorMessage message={error} />
    </Frame>
  );
}
