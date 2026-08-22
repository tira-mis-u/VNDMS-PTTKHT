import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { TaskPriority } from "@/domain/tasks/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button } from "@/components/ui";

export type IncidentDialog =
  "task" | "dispatch" | "event" | "status" | "severity" | "close" | null;
export function IncidentActionDialogs({
  mode,
  incident,
  onClose,
}: {
  mode: IncidentDialog;
  incident: Incident;
  onClose: () => void;
}) {
  if (!mode) return null;
  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} aria-label="Đóng" />
      {mode === "task" && <TaskForm incident={incident} onClose={onClose} />}
      {mode === "dispatch" && (
        <DispatchForm incident={incident} onClose={onClose} />
      )}
      {mode === "event" && <EventForm incident={incident} onClose={onClose} />}
      {mode === "status" && (
        <StatusForm incident={incident} onClose={onClose} />
      )}
      {mode === "severity" && (
        <SeverityForm incident={incident} onClose={onClose} />
      )}
      {mode === "close" && (
        <CloseConfirm incident={incident} onClose={onClose} />
      )}
    </>
  );
}
function DialogFrame({
  eyebrow,
  title,
  children,
  onClose,
  footer,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer: React.ReactNode;
}) {
  return (
    <div
      className="incident-form-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng hộp thoại">
          <X size={18} />
        </button>
      </header>
      <div className="incident-form-body">{children}</div>
      <footer>{footer}</footer>
    </div>
  );
}
function TaskForm({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { teams, createTask } = useOperationalState();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Cứu hộ, sơ tán");
  const [priority, setPriority] = useState<TaskPriority>("Cao");
  const [teamId, setTeam] = useState(incident.assignedTeamId ?? "");
  const [assignee, setAssignee] = useState("");
  const [location, setLocation] = useState(incident.location.name);
  const [dueAt, setDue] = useState("21/08/2026 12:00");
  const [description, setDescription] = useState("");
  const submit = () => {
    if (!title) return;
    createTask({
      incidentId: incident.id,
      title,
      type,
      priority,
      teamId,
      assignee,
      location,
      dueAt,
      description,
    });
    onClose();
  };
  return (
    <DialogFrame
      eyebrow={incident.id}
      title="Tạo nhiệm vụ liên quan"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={!title}>
            Tạo nhiệm vụ
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Tên nhiệm vụ *</span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Sơ tán hộ dân ngõ 124 Âu Cơ"
        />
      </label>
      <label className="field">
        <span>Loại nhiệm vụ</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>Cứu hộ, sơ tán</option>
          <option>Khảo sát hiện trường</option>
          <option>Bảo đảm giao thông</option>
          <option>Hậu cần</option>
        </select>
      </label>
      <label className="field">
        <span>Mức ưu tiên</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          <option>Khẩn cấp</option>
          <option>Cao</option>
          <option>Trung bình</option>
        </select>
      </label>
      <label className="field">
        <span>Đội thực hiện</span>
        <select value={teamId} onChange={(e) => setTeam(e.target.value)}>
          <option value="">Chưa giao</option>
          {teams.map((t) => (
            <option value={t.id} key={t.id}>
              {t.id} — {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Người phụ trách</span>
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Họ và tên"
        />
      </label>
      <label className="field field-full">
        <span>Địa điểm</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="field">
        <span>Hạn xử lý</span>
        <input value={dueAt} onChange={(e) => setDue(e.target.value)} />
      </label>
      <label className="field field-full">
        <span>Mô tả ngắn</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
    </DialogFrame>
  );
}
function DispatchForm({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { teams, dispatchTeam } = useOperationalState();
  const [selected, setSelected] = useState(incident.assignedTeamId ?? "");
  const submit = () => {
    if (selected) dispatchTeam(incident.id, selected);
    onClose();
  };
  return (
    <DialogFrame
      eyebrow={incident.id}
      title="Điều phối đội cứu hộ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!selected} onClick={submit}>
            Xác nhận điều phối
          </Button>
        </>
      }
    >
      <div className="dispatch-team-list">
        {teams.map((team) => (
          <TeamOption
            key={team.id}
            team={team}
            selected={selected === team.id}
            onSelect={() => setSelected(team.id)}
          />
        ))}
      </div>
    </DialogFrame>
  );
}
function TeamOption({
  team,
  selected,
  onSelect,
}: {
  team: RescueTeam;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={selected ? "selected" : ""} onClick={onSelect}>
      <span className="dispatch-radio">
        <i />
      </span>
      <span>
        <b>
          {team.id} · {team.name}
        </b>
        <small>
          {team.capability} · {team.distance}
        </small>
      </span>
      <span>
        <Badge
          tone={
            team.status === "Sẵn sàng"
              ? "green"
              : team.status === "Mất liên lạc" ||
                  team.status === "Không khả dụng"
                ? "red"
                : "blue"
          }
        >
          {team.status}
        </Badge>
        <small>{team.currentTask}</small>
      </span>
    </button>
  );
}
function EventForm({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { addEvent } = useOperationalState();
  const [message, setMessage] = useState("");
  return (
    <DialogFrame
      eyebrow={incident.id}
      title="Thêm diễn biến"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!message.trim()}
            onClick={() => {
              addEvent(incident.id, message);
              onClose();
            }}
          >
            Ghi nhận
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Nội dung diễn biến *</span>
        <textarea
          autoFocus
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mô tả diễn biến, quyết định hoặc thông tin hiện trường…"
        />
      </label>
      <p className="form-hint">
        Sự kiện sẽ được ghi vào timeline với người dùng và thời gian hiện tại.
      </p>
    </DialogFrame>
  );
}
function StatusForm({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { updateStatus } = useOperationalState();
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  return (
    <DialogFrame
      eyebrow={incident.id}
      title="Chuyển trạng thái"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              updateStatus(incident.id, status);
              onClose();
            }}
          >
            Cập nhật
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Trạng thái mới</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as IncidentStatus)}
        >
          <option>Mới</option>
          <option>Đánh giá</option>
          <option>Đang xử lý</option>
          <option>Đang điều phối</option>
          <option>Đã kiểm soát</option>
        </select>
      </label>
      <p className="form-hint">
        Thay đổi sẽ được ghi tự động vào timeline sự cố.
      </p>
    </DialogFrame>
  );
}
function SeverityForm({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { updateSeverity } = useOperationalState();
  const [severity, setSeverity] = useState<IncidentSeverity>(incident.severity);
  return (
    <DialogFrame
      eyebrow={incident.id}
      title="Cập nhật mức độ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              updateSeverity(incident.id, severity);
              onClose();
            }}
          >
            Cập nhật
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Mức độ mới</span>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
        >
          <option>Khẩn cấp</option>
          <option>Cao</option>
          <option>Trung bình</option>
          <option>Thấp</option>
        </select>
      </label>
      <p className="form-hint">
        Điều chỉnh mức độ có thể thay đổi thứ tự ưu tiên trên Trung tâm điều
        hành.
      </p>
    </DialogFrame>
  );
}
function CloseConfirm({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { closeIncident } = useOperationalState();
  const [error, setError] = useState("");
  const close = () => {
    try {
      setError("");
      closeIncident(incident.id);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đóng sự cố.",
      );
    }
  };
  return (
    <div
      className="confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="close-incident-title"
    >
      <span>
        <AlertTriangle size={20} />
      </span>
      <h2 id="close-incident-title">Đóng sự cố {incident.id}?</h2>
      <p>
        Chỉ có thể đóng khi nhiệm vụ, SOS, sơ tán, cứu trợ và playbook liên quan
        đã kết thúc. Đội điều phối trực tiếp sẽ được giải phóng đồng bộ.
      </p>
      {error && (
        <p className="team-form-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button className="btn-danger" onClick={close}>
          Xác nhận đóng
        </Button>
      </div>
    </div>
  );
}
