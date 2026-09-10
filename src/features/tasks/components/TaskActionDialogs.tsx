import { Select as UiSelect } from "@/components/ui/Select";
import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { IncidentTask, TaskStatus } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import { getValidTransitions, TASK_LIFECYCLE } from "@/domain/tasks/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Badge, Button, Input, Textarea } from "@/components/ui";
export type TaskDialog =
  | "transition"
  | "assign"
  | "update"
  | "progress"
  | "cancel"
  /** Đơn vị cứu hộ báo xong (→ Chờ xác nhận). */
  | "report-done"
  /** Cán bộ chấp nhận/từ chối kết quả. */
  | "review"
  | null;
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
      <DialogBackdrop onClick={onClose} />
      {mode === "transition" && (
        <Transition task={task} onClose={onClose} />
      )}{" "}
      {mode === "assign" && <Assign task={task} onClose={onClose} />}{" "}
      {mode === "update" && <FieldUpdate task={task} onClose={onClose} />}{" "}
      {mode === "progress" && <ProgressUpdate task={task} onClose={onClose} />}{" "}
      {mode === "cancel" && <Cancel task={task} onClose={onClose} />}
      {mode === "report-done" && <ReportDone task={task} onClose={onClose} />}
      {mode === "review" && <Review task={task} onClose={onClose} />}
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
  const { transitionTask, can } = useOperationalState();
  // Báo xong / xác nhận kết quả đi qua hộp thoại riêng (có ghi chú, có review).
  const options = getValidTransitions(task.status).filter(
    (s) => s !== "Đã hủy" && s !== "Chờ xác nhận" && s !== "Hoàn thành",
  ).filter((s) =>
    s === "Đã tiếp nhận" ? can("task_accept") : s === "Đang thực hiện" ? can("task_start") : can("task_assign"),
  );
  const [next, setNext] = useState<TaskStatus>(options[0] ?? task.status);
  const [error, setError] = useState("");
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
              try {
                transitionTask(task.id, next);
                onClose();
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Không thể chuyển trạng thái.");
              }
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
          <UiSelect
            value={next}
            onChange={(e) => setNext(e.target.value as TaskStatus)}
          >
            {options.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </UiSelect>
        </label>
      ) : (
        <p className="form-hint">
          {task.status === "Đang thực hiện"
            ? "Đơn vị dùng “Báo hoàn thành” để chuyển sang Chờ xác nhận; cán bộ xác nhận kết quả trước khi nhiệm vụ Hoàn thành."
            : task.status === "Chờ xác nhận"
              ? "Nhiệm vụ đang chờ cán bộ phòng chống thiên tai xác nhận kết quả."
              : "Nhiệm vụ đang ở trạng thái kết thúc hoặc bạn không có quyền chuyển trạng thái."}
        </p>
      )}
      {error && (
        <p className="team-form-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
      <div className="task-transition-path">
        {TASK_LIFECYCLE.map((s, i) => (
          <span
            className={
              s === task.status
                ? "current"
                : i < TASK_LIFECYCLE.indexOf(task.status)
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
  const { teams, assignTaskTeam, reassignTask } = useOperationalState();
  const reassigning = Boolean(task.teamId);
  const [selected, setSelected] = useState(task.teamId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const history = task.assignmentHistory ?? [];
  return (
    <Frame
      title={reassigning ? "Phân công lại nhiệm vụ" : "Điều phối đội thực hiện"}
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!selected || (reassigning && (!reason.trim() || selected === task.teamId))}
            onClick={() => {
              try {
                if (reassigning) reassignTask(task.id, selected, reason);
                else assignTaskTeam(task.id, selected);
                onClose();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Không thể điều phối.");
              }
            }}
          >
            {reassigning ? "Xác nhận phân công lại" : "Xác nhận điều phối"}
          </Button>
        </>
      }
    >
      {reassigning && (
        <label className="field field-full">
          <span>
            Lý do phân công lại <b>*</b>
          </span>
          <Textarea
            autoFocus
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Đội hiện tại mất liên lạc / thiếu năng lực xuồng máy / đội mới gần hiện trường hơn…"
          />
        </label>
      )}
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
      {history.length > 0 && (
        <p className="form-hint">
          Lịch sử phân công: {history.map((h) => `${h.fromTeamId ?? "—"} → ${h.toTeamId} (${h.at}, ${h.actor}: ${h.reason})`).join("; ")}
        </p>
      )}
      {error && (
        <p className="team-form-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
    </Frame>
  );
}
function ReportDone({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { reportTaskDone } = useOperationalState();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <Frame
      title="Báo hoàn thành nhiệm vụ"
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!note.trim()}
            onClick={() => {
              try {
                reportTaskDone(task.id, note);
                onClose();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Không thể báo hoàn thành.");
              }
            }}
          >
            Gửi báo cáo kết quả
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Tóm tắt kết quả *</span>
        <Textarea
          autoFocus
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Số người đã hỗ trợ, tình trạng hiện trường khi rời đi, vật tư đã dùng…"
        />
      </label>
      <p className="form-hint">
        Nhiệm vụ chuyển sang <b>Chờ xác nhận</b>. Nhiệm vụ chỉ Hoàn thành khi cán bộ
        phòng chống thiên tai chấp nhận kết quả; nếu bị từ chối, nhiệm vụ quay lại
        Đang thực hiện kèm lý do.
      </p>
      {error && (
        <p className="team-form-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
    </Frame>
  );
}
function Review({
  task,
  onClose,
}: {
  task: IncidentTask;
  onClose: () => void;
}) {
  const { reviewTaskResult, taskReviews } = useOperationalState();
  const pending = taskReviews.find(
    (r) => r.taskId === task.id && r.decision === "Chờ xác nhận",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const decide = (accepted: boolean) => {
    try {
      reviewTaskResult(task.id, accepted, note);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xác nhận kết quả.");
    }
  };
  return (
    <Frame
      title="Xác nhận kết quả nhiệm vụ"
      eyebrow={task.id}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button className="btn-danger" disabled={!note.trim()} onClick={() => decide(false)}>
            Từ chối — yêu cầu làm tiếp
          </Button>
          <Button onClick={() => decide(true)}>Chấp nhận — Hoàn thành</Button>
        </>
      }
    >
      <div className="transition-current">
        <span>Báo cáo của đơn vị</span>
        <Badge tone="blue">{pending ? pending.reportedBy : "Không có"}</Badge>
      </div>
      <p className="form-hint">
        {pending
          ? `${pending.reportedAt} — ${pending.reportNote}`
          : "Không tìm thấy báo cáo kết quả đang chờ xác nhận."}
      </p>
      <label className="field field-full">
        <span>Ghi chú của cán bộ (bắt buộc khi từ chối)</span>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lý do từ chối hoặc nhận xét khi chấp nhận…"
        />
      </label>
      {error && (
        <p className="team-form-error">
          <AlertTriangle size={14} />
          {error}
        </p>
      )}
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
        <Textarea
          autoFocus
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tình hình tiếp cận, số người đã hỗ trợ hoặc trở ngại…"
        />
      </label>
      <label className="field field-full">
        <span>Vị trí</span>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="offline-check">
        <Input
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
        <Input
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
