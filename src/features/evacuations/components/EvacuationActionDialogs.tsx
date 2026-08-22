import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import type {
  EvacuationOperation,
  RouteStatus,
} from "@/domain/evacuations/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Button } from "@/components/ui";

export type EvacuationDialog =
  | "assign"
  | "progress"
  | "route"
  | "redirect"
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
      <div
        className="incident-form-dialog shelter-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Đóng">
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
    <p className="team-form-error" role="alert">
      <AlertTriangle size={14} />
      {value}
    </p>
  ) : null;
}

export function EvacuationActionDialogs({
  mode,
  operation,
  onClose,
}: {
  mode: EvacuationDialog;
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  if (!mode) return null;
  if (mode === "assign")
    return <AssignTeam operation={operation} onClose={onClose} />;
  if (mode === "progress")
    return <UpdateProgress operation={operation} onClose={onClose} />;
  if (mode === "route")
    return <UpdateRoute operation={operation} onClose={onClose} />;
  return <Redirect operation={operation} onClose={onClose} />;
}

function AssignTeam({
  operation,
  onClose,
}: {
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  const { teams, assignEvacuationTeam } = useOperationalState();
  const available = teams.filter(
    (team) =>
      !team.currentTask &&
      !team.currentEvacuationOperation &&
      team.status === "Sẵn sàng",
  );
  const [teamId, setTeamId] = useState(
    operation.assignedTeamId ?? available[0]?.id ?? "",
  );
  const [error, setError] = useState("");
  const submit = () => {
    try {
      if (!teamId || teamId === operation.assignedTeamId)
        throw new Error("Chọn đội khác với đội hiện tại để phân công.");
      assignEvacuationTeam(operation.id, teamId);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể phân công đội.",
      );
    }
  };
  return (
    <Frame
      title={`Phân công đội cho ${operation.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu phân công</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Đội phụ trách</span>
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">Chưa gán đội</option>
          {operation.assignedTeamId && (
            <option value={operation.assignedTeamId}>
              {operation.assignedTeamId} (đang phụ trách)
            </option>
          )}
          {available.map((team) => (
            <option key={team.id} value={team.id}>
              {team.id} — {team.name}
            </option>
          ))}
        </select>
      </label>
      <p className="form-hint">
        Chỉ liệt kê đội đang sẵn sàng trong phạm vi phân quyền; đội được gán sẽ
        chuyển sang trạng thái điều động.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}

function UpdateProgress({
  operation,
  onClose,
}: {
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  const { updateEvacuationProgress } = useOperationalState();
  const [value, setValue] = useState(String(operation.evacuatedPopulation));
  const [error, setError] = useState("");
  const submit = () => {
    try {
      updateEvacuationProgress(operation.id, Number(value));
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật tiến độ.",
      );
    }
  };
  return (
    <Frame
      title={`Cập nhật tiến độ ${operation.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu tiến độ</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Số ngườii đã sơ tán</span>
        <input
          type="number"
          min={0}
          max={operation.estimatedPopulation}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <p className="form-hint">
        Tổng dự kiến {operation.estimatedPopulation.toLocaleString("vi-VN")}{" "}
        ngườii; còn lại{" "}
        {Math.max(
          0,
          operation.estimatedPopulation - operation.evacuatedPopulation,
        ).toLocaleString("vi-VN")}{" "}
        ngườii. Tiến độ phần trăm được tính lại từ canonical state sau khi lưu.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}

function UpdateRoute({
  operation,
  onClose,
}: {
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  const { updateEvacuationRoute } = useOperationalState();
  const [status, setStatus] = useState<RouteStatus>(operation.route.status);
  const [error, setError] = useState("");
  const submit = () => {
    try {
      updateEvacuationRoute(operation.id, status);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật tuyến.",
      );
    }
  };
  return (
    <Frame
      title={`Cập nhật tuyến ${operation.route.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit}>Lưu tình trạng tuyến</Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Tình trạng tuyến</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as RouteStatus)}
        >
          <option>Thông suốt</option>
          <option>Hạn chế</option>
          <option>Bị chặn</option>
          <option>Đang dùng tuyến thay thế</option>
        </select>
      </label>
      <p className="form-hint">
        Báo “Bị chặn” khi hoạt động đang triển khai sẽ tự chuyển hoạt động sang
        tạm dừng; kích hoạt tuyến thay thế yêu cầu đã lập phương án tuyến phụ.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}

function Redirect({
  operation,
  onClose,
}: {
  operation: EvacuationOperation;
  onClose: () => void;
}) {
  const { shelters, redirectEvacuation } = useOperationalState();
  const candidates = shelters.filter(
    (shelter) =>
      shelter.id !== operation.destinationShelterId &&
      !["Quá tải", "Tạm đóng", "Không thể tiếp cận"].includes(shelter.status),
  );
  const [id, setId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState("");
  const submit = () => {
    try {
      if (!id) throw new Error("Không có điểm tiếp nhận thay thế khả dụng.");
      redirectEvacuation(operation.id, id);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể chuyển hướng.",
      );
    }
  };
  return (
    <Frame
      title="Chuyển hướng điểm tiếp nhận"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!id} onClick={submit}>
            Xác nhận chuyển hướng
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Điểm sơ tán thay thế</span>
        <select value={id} onChange={(event) => setId(event.target.value)}>
          {candidates.map((shelter) => (
            <option key={shelter.id} value={shelter.id}>
              {shelter.id} — {shelter.name}
            </option>
          ))}
        </select>
      </label>
      <p className="form-hint">
        Sức chứa dự phòng còn lại sẽ được chuyển từ điểm cũ sang điểm mới.
      </p>
      <ErrorText value={error} />
    </Frame>
  );
}
