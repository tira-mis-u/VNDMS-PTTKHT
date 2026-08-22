import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { IncidentTask, TaskStatus } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import { getValidTransitions } from "@/domain/tasks/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button } from "@/components/ui";
export type TaskDialog =
  "transition" | "assign" | "update" | "progress" | "cancel" | null;
export function TaskActionDialogs({
  mode,
  task,
  onClose,
}: {
  mode: TaskDialog;
  task: IncidentTask;
  onClose: () => void;
}) {
  if (!mode) return null;
  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} />
      {mode === "transition" && (
        <Transition task={task} onClose={onClose} />
      )}{" "}
      {mode === "assign" && <Assign task={task} onClose={onClose} />}{" "}
      {mode === "update" && <FieldUpdate task={task} onClose={onClose} />}{" "}
      {mode === "progress" && <ProgressUpdate task={task} onClose={onClose} />}{" "}
      {mode === "cancel" && <Cancel task={task} onClose={onClose} />}
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
    <div className="incident-form-dialog">
      <header>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
        <button onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="incident-form-body">{children}</div>
      <footer>{footer}</footer>
    </div>
  );
}
function Transition({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { transitionTask } = useOperationalState();
  const options = getValidTransitions(task.status).filter(
    (s) => s !== "Đã hủy",
  );
  const [next, setNext] = useState<TaskStatus>(options[0] ?? task.status);
  return (
    <Frame
      title="Cập nhật trạng thái"
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!options.length}
            onClick={() => {
              transitionTask(task.id, next);
              onClose();
            }}
          >
            Xác nhận
          </Button>
        </>
      }
    >
      <div className="transition-current">
        <span>Trạng thái hiện tại</span>
        <Badge tone="blue">{task.status}</Badge>
      </div>
      {options.length ? (
        <label className="field field-full">
          <span>Chuyển sang</span>
          <select
            value={next}
            onChange={(e) => setNext(e.target.value as TaskStatus)}
          >
            {options.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      ) : (
        <p className="form-hint">
          Nhiệm vụ đang ở trạng thái kết thúc và không còn transition hợp lệ.
        </p>
      )}
      <div className="task-transition-path">
        {[
          "Chờ giao",
          "Đã giao",
          "Đã tiếp nhận",
          "Đang thực hiện",
          "Hoàn thành",
        ].map((s, i) => (
          <span
            className={
              s === task.status
                ? "current"
                : i <
                    [
                      "Chờ giao",
                      "Đã giao",
                      "Đã tiếp nhận",
                      "Đang thực hiện",
                      "Hoàn thành",
                    ].indexOf(task.status)
                  ? "done"
                  : ""
            }
            key={s}
          >
            {s}
          </span>
        ))}
      </div>
    </Frame>
  );
}
function Assign({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { teams, assignTaskTeam } = useOperationalState();
  const [selected, setSelected] = useState(task.teamId);
  return (
    <Frame
      title="Điều phối đội thực hiện"
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              assignTaskTeam(task.id, selected);
              onClose();
            }}
          >
            Xác nhận điều phối
          </Button>
        </>
      }
    >
      <div className="dispatch-team-list">
        {teams.map((team) => (
          <Team
            key={team.id}
            team={team}
            selected={team.id === selected}
            onClick={() => setSelected(team.id)}
          />
        ))}
      </div>
    </Frame>
  );
}
function Team({
  team,
  selected,
  onClick,
}: {
  team: RescueTeam;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className={selected ? "selected" : ""} onClick={onClick}>
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
function FieldUpdate({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { addTaskUpdate } = useOperationalState();
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState(task.location);
  const [offline, setOffline] = useState(false);
  return (
    <Frame
      title="Thêm cập nhật hiện trường"
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!message.trim()}
            onClick={() => {
              addTaskUpdate(
                task.id,
                message,
                location,
                offline ? "Chờ đồng bộ" : "Đã đồng bộ",
              );
              onClose();
            }}
          >
            Ghi nhận cập nhật
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Nội dung cập nhật *</span>
        <textarea
          autoFocus
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tình hình tiếp cận, số người đã hỗ trợ hoặc trở ngại…"
        />
      </label>
      <label className="field field-full">
        <span>Vị trí</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="offline-check">
        <input
          type="checkbox"
          checked={offline}
          onChange={(e) => setOffline(e.target.checked)}
        />
        <span>Thiết bị đang ngoại tuyến, chờ đồng bộ khi có mạng</span>
      </label>
    </Frame>
  );
}
function ProgressUpdate({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { updateTaskProgress } = useOperationalState();
  const [value, setValue] = useState(task.progress);
  return (
    <Frame
      title="Cập nhật tiến độ"
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              updateTaskProgress(task.id, value);
              onClose();
            }}
          >
            Cập nhật {value}%
          </Button>
        </>
      }
    >
      <div className="progress-picker">
        <strong>{value}%</strong>
        <input
          type="range"
          min="0"
          max="100"
          step="25"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <div>
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
      <p className="form-hint">
        Tiến độ sự cố liên quan sẽ được tính lại theo trung bình tiến độ của các
        nhiệm vụ chưa hủy.
      </p>
    </Frame>
  );
}
function Cancel({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { transitionTask } = useOperationalState();
  return (
    <div className="confirm-dialog">
      <span>
        <AlertTriangle size={20} />
      </span>
      <h2>Hủy nhiệm vụ {task.id}?</h2>
      <p>
        Nhiệm vụ sẽ chuyển sang trạng thái kết thúc, không tiếp tục được cập
        nhật và bị loại khỏi phép tính tiến độ của sự cố.
      </p>
      <div>
        <Button variant="secondary" onClick={onClose}>
          Quay lại
        </Button>
        <Button
          className="btn-danger"
          onClick={() => {
            transitionTask(task.id, "Đã hủy");
            onClose();
          }}
        >
          Xác nhận hủy
        </Button>
      </div>
    </div>
  );
}
