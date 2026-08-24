import { Select as UiSelect } from "@/components/ui/Select";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, LifeBuoy, X } from "lucide-react";
import { roleLabels } from "@/domain/auth/labels";
import type { IncidentSeverity } from "@/domain/incidents/types";
import type { SosPriority } from "@/domain/sos/types";
import {
  acknowledgeableAlerts,
  buildAcknowledgeAlertPlan,
  buildCreateIncidentPlan,
  buildCreateTaskPlan,
  buildDispatchTeamPlan,
  buildRecallTeamPlan,
  buildSosTriagePlan,
  dispatchModeLabels,
  dispatchableTeams,
  executeCommandCenterAction,
  incidentSeverityOptions,
  incidentTypeOptions,
  recallableTeams,
  openIncidents,
  sosPriorityOptions,
  sosTriageModeLabels,
  taskPriorityOptions,
  taskTypeOptions,
  triageableSos,
  type CommandCenterActionOutcome,
  type DispatchMode,
  type SosTriageMode,
} from "@/application/command-center/commandCenterActions";
import { alertSeverityLabels, alertSeverityTones } from "@/domain/alerts/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Badge, Button, EmptyState, Input, Textarea } from "@/components/ui";

export function ActionDialog({
  action,
  presetSosId,
  navigate,
  onClose,
}: {
  action: string | null;
  presetSosId?: string;
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  if (!action) return null;
  if (action === "Tạo sự cố")
    return <CreateIncidentAction navigate={navigate} onClose={onClose} />;
  if (action === "Giao nhiệm vụ")
    return <CreateTaskAction navigate={navigate} onClose={onClose} />;
  if (action === "Gửi cảnh báo")
    return <AcknowledgeAlertAction onClose={onClose} />;
  if (action === "Điều phối đội")
    return <DispatchTeamAction navigate={navigate} onClose={onClose} />;
  if (action === "Xử lý SOS")
    return (
      <SosTriageAction
        presetSosId={presetSosId}
        navigate={navigate}
        onClose={onClose}
      />
    );
  return null;
}

function Frame({
  subtitle,
  title,
  children,
  footer,
  onClose,
}: {
  subtitle: string;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div
        className="incident-form-dialog shelter-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-action-title"
      >
        <header>
          <div>
            <small>{subtitle}</small>
            <h2 id="command-action-title">{title}</h2>
          </div>
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

function PermissionNote({ value }: { value: boolean }) {
  return value ? null : (
    <p className="action-dialog-permission" role="note">
      <AlertTriangle size={13} />
      Tài khoản hiện tại không có quyền thực hiện thao tác này trong phạm vi
      địa bàn phụ trách.
    </p>
  );
}

/** Meta bắt buộc của một thao tác điều hành: actor, phạm vi tài khoản, lệnh canonical. */
function ActionMeta({
  command,
  scope,
}: {
  command: string;
  scope?: string;
}) {
  const store = useOperationalState();
  const user = store.currentUser;
  return (
    <dl className="action-dialog-meta">
      <div>
        <dt>Người thực hiện</dt>
        <dd>
          {user ? `${user.displayName} (${roleLabels[user.role]})` : "—"}
        </dd>
      </div>
      <div>
        <dt>Phạm vi tài khoản</dt>
        <dd>{user?.geographicScope.name ?? "—"}</dd>
      </div>
      {scope && (
        <div>
          <dt>Phạm vi địa bàn</dt>
          <dd>{scope}</dd>
        </div>
      )}
      <div>
        <dt>Lệnh nghiệp vụ chính thức</dt>
        <dd>
          <code>{command}</code> · qua OperationalMutationBoundary
        </dd>
      </div>
    </dl>
  );
}

function OutcomeView({
  outcome,
  command,
  navigate,
  onClose,
}: {
  outcome: CommandCenterActionOutcome;
  command: string;
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  return (
    <Frame
      subtitle="Thao tác điều hành"
      title="Đã thực hiện thành công"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {outcome.entityPath && (
            <Button
              onClick={() => {
                onClose();
                navigate(outcome.entityPath!);
              }}
            >
              Mở chi tiết
              <ChevronRight size={15} />
            </Button>
          )}
        </>
      }
    >
      <div className="action-dialog-outcome">
        <CheckCircle2 size={26} />
        <p>{outcome.message}</p>
        <small>
          Thay đổi đã được ghi vào dữ liệu nghiệp vụ chính thức qua <code>{command}</code>;
          nhật ký được lưu theo quy trình hiện hữu và mọi màn hình liên quan
          tự động cập nhật.
        </small>
      </div>
    </Frame>
  );
}

function CreateIncidentAction({
  navigate,
  onClose,
}: {
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const [title, setTitle] = useState("");
  const [type, setType] = useState(incidentTypeOptions[0]);
  const [severity, setSeverity] = useState<IncidentSeverity>("Cao");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<CommandCenterActionOutcome | null>(
    null,
  );
  const canCreate = store.can("create");
  if (outcome)
    return (
      <OutcomeView
        outcome={outcome}
        command="createIncident"
        navigate={navigate}
        onClose={onClose}
      />
    );
  const submit = () => {
    setError("");
    const result = buildCreateIncidentPlan({
      confirmed: true,
      title,
      type,
      severity,
      area,
      description,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      setOutcome(executeCommandCenterAction(store, result.plan));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tạo sự cố. Hệ thống đã hủy thao tác và giữ nguyên dữ liệu nghiệp vụ.",
      );
    }
  };
  return (
    <Frame
      subtitle="Thao tác điều hành"
      title="Tạo sự cố mới"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || !area.trim() || !canCreate}
            title={
              canCreate
                ? undefined
                : "Tài khoản hiện tại không có quyền tạo sự cố"
            }
          >
            Xác nhận và tạo sự cố
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>
          Đối tượng — tên sự cố <b>*</b>
        </span>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Mô tả ngắn gọn sự cố"
        />
      </label>
      <label className="field">
        <span>Loại thiên tai</span>
        <UiSelect value={type} onChange={(event) => setType(event.target.value)}>
          {incidentTypeOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </UiSelect>
      </label>
      <label className="field">
        <span>Mức độ ban đầu</span>
        <UiSelect
          value={severity}
          onChange={(event) =>
            setSeverity(event.target.value as IncidentSeverity)
          }
        >
          {incidentSeverityOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </UiSelect>
      </label>
      <label className="field field-full">
        <span>
          Khu vực / phạm vi địa bàn <b>*</b>
        </span>
        <Input
          value={area}
          onChange={(event) => setArea(event.target.value)}
          placeholder="Ví dụ: Tứ Liên, Tây Hồ, Hà Nội"
        />
      </label>
      <label className="field field-full">
        <span>Thông tin tiếp nhận ban đầu</span>
        <Textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <ActionMeta command="createIncident" scope={area.trim() || undefined} />
      <PermissionNote value={canCreate} />
      <ErrorText value={error} />
    </Frame>
  );
}

function CreateTaskAction({
  navigate,
  onClose,
}: {
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const context = {
    incidents: store.incidents,
    teams: store.teams,
    sosRequests: [],
    alerts: [],
  };
  const incidents = openIncidents(context);
  const teams = dispatchableTeams(context);
  const [incidentId, setIncidentId] = useState(incidents[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState(taskTypeOptions[0]);
  const [priority, setPriority] = useState("Cao");
  const [teamId, setTeamId] = useState("");
  const [dueAt, setDueAt] = useState("21/08/2026 13:00");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<CommandCenterActionOutcome | null>(
    null,
  );
  if (outcome)
    return (
      <OutcomeView
        outcome={outcome}
        command="createTask"
        navigate={navigate}
        onClose={onClose}
      />
    );
  const incident = incidents.find((item) => item.id === incidentId);
  const canCreateTask = store.can("task_create");
  if (!incidents.length)
    return (
      <Frame
        subtitle="Thao tác điều hành"
        title="Giao nhiệm vụ"
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        }
      >
        <EmptyState
          title="Không có sự cố đang mở"
          description="Trong phạm vi phân quyền hiện tại không có sự cố nào chưa đóng để giao nhiệm vụ. Tạo sự cố trước hoặc chuyển tài khoản có phạm vi phù hợp."
        />
      </Frame>
    );
  const submit = () => {
    setError("");
    const result = buildCreateTaskPlan(context, {
      confirmed: true,
      incidentId,
      title,
      type,
      priority,
      teamId,
      dueAt,
      description,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      setOutcome(executeCommandCenterAction(store, result.plan));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể giao nhiệm vụ. Hệ thống đã hủy thao tác và giữ nguyên dữ liệu nghiệp vụ.",
      );
    }
  };
  return (
    <Frame
      subtitle="Thao tác điều hành"
      title="Giao nhiệm vụ mới"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={
              !incidentId || !title.trim() || !dueAt.trim() || !canCreateTask
            }
            title={
              canCreateTask
                ? undefined
                : "Tài khoản hiện tại không có quyền tạo nhiệm vụ"
            }
          >
            Xác nhận và giao nhiệm vụ
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>
          Đối tượng — sự cố liên quan <b>*</b>
        </span>
        <UiSelect
          value={incidentId}
          onChange={(event) => setIncidentId(event.target.value)}
        >
          {incidents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} — {item.title} ({item.status})
            </option>
          ))}
        </UiSelect>
      </label>
      {incident && (
        <div className="action-dialog-context" role="note">
          Trạng thái hiện tại: <b>{incident.status}</b> · mức{" "}
          <b>{incident.severity}</b> · {incident.location.name} · đội phụ trách{" "}
          <b>{incident.assignedTeamId ?? "chưa có"}</b>
        </div>
      )}
      <label className="field field-full">
        <span>
          Tên nhiệm vụ <b>*</b>
        </span>
        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nội dung nhiệm vụ cần thực hiện"
        />
      </label>
      <label className="field">
        <span>Loại nhiệm vụ</span>
        <UiSelect value={type} onChange={(event) => setType(event.target.value)}>
          {taskTypeOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </UiSelect>
      </label>
      <label className="field">
        <span>Mức ưu tiên</span>
        <UiSelect
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          {taskPriorityOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </UiSelect>
      </label>
      <label className="field">
        <span>Đội phụ trách (tùy chọn)</span>
        <UiSelect value={teamId} onChange={(event) => setTeamId(event.target.value)}>
          <option value="">Chờ giao sau</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.id} — {team.name}
            </option>
          ))}
        </UiSelect>
      </label>
      <label className="field">
        <span>
          Thời hạn hoàn thành <b>*</b>
        </span>
        <Input value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </label>
      <label className="field field-full">
        <span>Mô tả nhiệm vụ</span>
        <Textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <ActionMeta
        command="createTask"
        scope={incident?.affectedArea || incident?.location.name}
      />
      <PermissionNote value={canCreateTask} />
      <ErrorText value={error} />
    </Frame>
  );
}

function AcknowledgeAlertAction({ onClose }: { onClose: () => void }) {
  const store = useOperationalState();
  const context = { incidents: [], teams: [], sosRequests: [], alerts: store.alerts };
  const candidates = acknowledgeableAlerts(context);
  const [alertKey, setAlertKey] = useState(candidates[0]?.key ?? "");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<CommandCenterActionOutcome | null>(
    null,
  );
  if (outcome)
    return (
      <OutcomeView
        outcome={outcome}
        command="acknowledgeAlert"
        navigate={() => {}}
        onClose={onClose}
      />
    );
  if (!candidates.length)
    return (
      <Frame
        subtitle="Thao tác điều hành"
        title="Gửi cảnh báo"
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        }
      >
        <EmptyState
          title="Không có cảnh báo chờ xác nhận"
          description="Cảnh báo tác nghiệp được suy ra từ dữ liệu nghiệp vụ; hiện không có cảnh báo nào yêu cầu xác nhận tiếp nhận trong phạm vi phân quyền. Hệ thống không phát cảnh báo thủ công."
        />
      </Frame>
    );
  const alert = candidates.find((item) => item.key === alertKey);
  const canAcknowledge = alert
    ? store.can("alert_acknowledge", alert.geographicScope)
    : false;
  const submit = () => {
    setError("");
    const result = buildAcknowledgeAlertPlan(context, {
      confirmed: true,
      alertKey,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      setOutcome(executeCommandCenterAction(store, result.plan));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể xác nhận cảnh báo. Hệ thống đã hủy thao tác và giữ nguyên dữ liệu nghiệp vụ.",
      );
    }
  };
  return (
    <Frame
      subtitle="Thao tác điều hành"
      title="Xác nhận tiếp nhận cảnh báo"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={!alert || !canAcknowledge}
            title={
              canAcknowledge
                ? undefined
                : "Tài khoản hiện tại không có quyền xác nhận cảnh báo trong phạm vi này"
            }
          >
            Xác nhận đã tiếp nhận
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>
          Đối tượng — cảnh báo chờ xác nhận <b>*</b>
        </span>
        <UiSelect value={alertKey} onChange={(event) => setAlertKey(event.target.value)}>
          {candidates.map((item) => (
            <option key={item.key} value={item.key}>
              [{alertSeverityLabels[item.severity]}] {item.title}
            </option>
          ))}
        </UiSelect>
      </label>
      {alert && (
        <div className="action-dialog-context action-dialog-context-alert" role="note">
          <Badge tone={alertSeverityTones[alert.severity]}>
            {alertSeverityLabels[alert.severity]}
          </Badge>
          <p>{alert.message}</p>
          <small>
            Nguồn: {alert.source.label} {alert.source.code} · ghi nhận{" "}
            {alert.detectedAt}
          </small>
        </div>
      )}
      <ActionMeta
        command="acknowledgeAlert"
        scope={alert?.geographicScope || undefined}
      />
      <PermissionNote value={canAcknowledge} />
      <ErrorText value={error} />
    </Frame>
  );
}

function DispatchTeamAction({
  navigate,
  onClose,
}: {
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const context = {
    incidents: store.incidents,
    teams: store.teams,
    sosRequests: [],
    alerts: [],
    tasks: store.tasks,
  };
  const incidents = openIncidents(context);
  const teams = dispatchableTeams(context);
  const recalls = recallableTeams(context);
  const [mode, setMode] = useState<DispatchMode>(
    teams.length ? "dispatch" : "recall",
  );
  const [incidentId, setIncidentId] = useState(incidents[0]?.id ?? "");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [recallTeamId, setRecallTeamId] = useState(recalls[0]?.team.id ?? "");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<CommandCenterActionOutcome | null>(
    null,
  );
  if (outcome)
    return (
      <OutcomeView
        outcome={outcome}
        command={mode === "dispatch" ? "dispatchTeam" : "releaseTeamFromTask"}
        navigate={navigate}
        onClose={onClose}
      />
    );
  const incident = incidents.find((item) => item.id === incidentId);
  const recall = recalls.find((item) => item.team.id === recallTeamId);
  const canDispatch = store.can("dispatch");
  const canRecall = store.can(
    "team_assign",
    recall?.team.operatingScope || recall?.team.region,
  );
  const activePermission = mode === "dispatch" ? canDispatch : canRecall;
  if (!incidents.length && !recalls.length)
    return (
      <Frame
        subtitle="Thao tác điều hành"
        title="Điều phối đội cứu hộ"
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        }
      >
        <EmptyState
          title="Không có đối tượng điều phối"
          description="Trong phạm vi phân quyền hiện tại không có sự cố đang mở để điều đội và không có đội nào đang giữ nhiệm vụ để thu hồi."
        />
      </Frame>
    );
  const submit = () => {
    setError("");
    const result =
      mode === "dispatch"
        ? buildDispatchTeamPlan(context, {
            confirmed: true,
            incidentId,
            teamId,
          })
        : buildRecallTeamPlan(context, {
            confirmed: true,
            teamId: recallTeamId,
          });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      setOutcome(executeCommandCenterAction(store, result.plan));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể thực hiện. Hệ thống đã hủy thao tác và giữ nguyên dữ liệu nghiệp vụ.",
      );
    }
  };
  const confirmDisabled =
    mode === "dispatch"
      ? !incidentId || !teamId || !canDispatch
      : !recallTeamId || !canRecall;
  return (
    <Frame
      subtitle="Thao tác điều hành"
      title="Điều phối đội cứu hộ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={confirmDisabled}
            title={
              activePermission
                ? undefined
                : "Tài khoản hiện tại không có quyền cho hành động này"
            }
          >
            Xác nhận và thực hiện
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>Hành động</span>
        <UiSelect
          value={mode}
          onChange={(event) => setMode(event.target.value as DispatchMode)}
        >
          {(Object.keys(dispatchModeLabels) as DispatchMode[]).map((item) => (
            <option key={item} value={item}>
              {dispatchModeLabels[item]}
            </option>
          ))}
        </UiSelect>
      </label>
      {mode === "dispatch" &&
        (!incidents.length || !teams.length ? (
          <EmptyState
            title={
              !incidents.length
                ? "Không có sự cố đang mở"
                : "Không có đội sẵn sàng điều phối"
            }
            description={
              !incidents.length
                ? "Trong phạm vi phân quyền hiện tại không có sự cố nào chưa đóng."
                : "Tất cả đội trong phạm vi hiện tại đang bận. Hãy thu hồi đội đang giữ nhiệm vụ ở hành động “Thu hồi đội” trước khi điều phối lại."
            }
          />
        ) : (
          <>
            <label className="field field-full">
              <span>
                Đối tượng — sự cố cần điều phối <b>*</b>
              </span>
              <UiSelect
                value={incidentId}
                onChange={(event) => setIncidentId(event.target.value)}
              >
                {incidents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} — {item.title} ({item.severity} · đội hiện tại:{" "}
                    {item.assignedTeamId ?? "chưa có"})
                  </option>
                ))}
              </UiSelect>
            </label>
            {incident && (
              <div className="action-dialog-context" role="note">
                Trạng thái hiện tại: <b>{incident.status}</b> ·{" "}
                {incident.location.name} · tiến độ {incident.progress}%
              </div>
            )}
            <label className="field field-full">
              <span>
                Đội được điều phối <b>*</b>
              </span>
              <UiSelect
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.id} — {team.name} ({team.members} người ·{" "}
                    {team.region})
                  </option>
                ))}
              </UiSelect>
            </label>
            <ActionMeta
              command="dispatchTeam"
              scope={incident?.affectedArea || incident?.location.name}
            />
          </>
        ))}
      {mode === "recall" &&
        (!recalls.length ? (
          <EmptyState
            title="Không có đội đang giữ nhiệm vụ"
            description="Trong phạm vi phân quyền hiện tại không có đội nào đang phụ trách nhiệm vụ để thu hồi."
          />
        ) : (
          <>
            <label className="field field-full">
              <span>
                Đối tượng — đội đang giữ nhiệm vụ <b>*</b>
              </span>
              <UiSelect
                value={recallTeamId}
                onChange={(event) => setRecallTeamId(event.target.value)}
              >
                {recalls.map((item) => (
                  <option key={item.team.id} value={item.team.id}>
                    {item.team.id} — {item.team.name} (nhiệm vụ{" "}
                    {item.team.currentTask})
                  </option>
                ))}
              </UiSelect>
            </label>
            {recall && (
              <div className="action-dialog-context" role="note">
                Trạng thái hiện tại: đội <b>{recall.team.status}</b> · nhiệm vụ{" "}
                <b>{recall.team.currentTask}</b>
                {recall.task ? ` · ${recall.task.title}` : ""}
                {recall.task
                  ? ` · tiến độ ${recall.task.progress}% · ${recall.task.status}`
                  : ""}
              </div>
            )}
            <ActionMeta
              command="releaseTeamFromTask"
              scope={recall?.team.operatingScope || recall?.team.region}
            />
          </>
        ))}
      <PermissionNote value={activePermission} />
      <ErrorText value={error} />
    </Frame>
  );
}

const triageModes: SosTriageMode[] = ["verify", "priority", "rescue", "reject"];

function SosTriageAction({
  presetSosId,
  navigate,
  onClose,
}: {
  presetSosId?: string;
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const context = {
    incidents: [],
    teams: store.teams,
    sosRequests: store.sosRequests,
    alerts: [],
  };
  const candidates = triageableSos(context);
  const teams = dispatchableTeams(context);
  const [sosId, setSosId] = useState(
    presetSosId && candidates.some((item) => item.id === presetSosId)
      ? presetSosId
      : (candidates[0]?.id ?? ""),
  );
  const [mode, setMode] = useState<SosTriageMode>("verify");
  const [priority, setPriority] = useState<SosPriority>(sosPriorityOptions[1]);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<CommandCenterActionOutcome | null>(
    null,
  );
  if (outcome)
    return (
      <OutcomeView
        outcome={outcome}
        command={
          mode === "verify"
            ? "verifySos"
            : mode === "reject"
              ? "rejectSos"
              : mode === "priority"
                ? "updateSosPriority"
                : "createRescueTaskFromSos"
        }
        navigate={navigate}
        onClose={onClose}
      />
    );
  if (!candidates.length)
    return (
      <Frame
        subtitle="Thao tác điều hành"
        title="Xử lý SOS"
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        }
      >
        <EmptyState
          title="Không có SOS cần xử lý"
          description="Trong phạm vi phân quyền hiện tại không có SOS nào đang chờ xác minh, phân loại hoặc điều phối."
        />
      </Frame>
    );
  const sos = candidates.find((item) => item.id === sosId);
  const modePermission =
    mode === "verify" || mode === "reject"
      ? "sos_verify"
      : mode === "priority"
        ? "sos_triage"
        : "sos_dispatch";
  const canAct = store.can(
    modePermission,
    sos?.location.administrativeArea,
  );
  const submit = () => {
    setError("");
    const result = buildSosTriagePlan(context, {
      confirmed: true,
      sosId,
      mode,
      priority,
      teamId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      setOutcome(executeCommandCenterAction(store, result.plan));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể xử lý SOS. Hệ thống đã hủy thao tác và giữ nguyên dữ liệu nghiệp vụ.",
      );
    }
  };
  return (
    <Frame
      subtitle="Thao tác điều hành"
      title="Xử lý yêu cầu SOS"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={!sos || !canAct}
            title={
              canAct
                ? undefined
                : "Tài khoản hiện tại không có quyền cho hành động này trong địa bàn của SOS"
            }
          >
            Xác nhận và thực hiện
          </Button>
        </>
      }
    >
      <label className="field field-full">
        <span>
          Đối tượng — yêu cầu SOS <b>*</b>
        </span>
        <UiSelect value={sosId} onChange={(event) => setSosId(event.target.value)}>
          {candidates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} — {item.priority} · {item.location.name}
            </option>
          ))}
        </UiSelect>
      </label>
      {sos && (
        <div className="action-dialog-context" role="note">
          Trạng thái hiện tại: <b>{sos.status}</b> · xác minh{" "}
          <b>{sos.verificationStatus}</b> · {sos.peopleAtRisk} người gặp nguy
          hiểm · đội <b>{sos.assignedTeamId ?? "chưa giao"}</b>
        </div>
      )}
      <label className="field field-full">
        <span>Hành động xử lý</span>
        <UiSelect
          value={mode}
          onChange={(event) => setMode(event.target.value as SosTriageMode)}
        >
          {triageModes.map((item) => (
            <option key={item} value={item}>
              {sosTriageModeLabels[item]}
            </option>
          ))}
        </UiSelect>
      </label>
      {mode === "priority" && (
        <label className="field field-full">
          <span>Mức ưu tiên mới</span>
          <UiSelect
            value={priority}
            onChange={(event) => setPriority(event.target.value as SosPriority)}
          >
            {sosPriorityOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </UiSelect>
        </label>
      )}
      {mode === "rescue" &&
        (teams.length ? (
          <label className="field field-full">
            <span>Đội cứu hộ được điều</span>
            <UiSelect value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.id} — {team.name}
                </option>
              ))}
            </UiSelect>
          </label>
        ) : (
          <div className="action-dialog-context" role="note">
            <LifeBuoy size={14} /> Không có đội nào sẵn sàng trong phạm vi hiện
            tại — hãy chọn hành động khác hoặc kiểm tra phân hệ Đội cứu hộ.
          </div>
        ))}
      <ActionMeta
        command={
          mode === "verify"
            ? "verifySos"
            : mode === "reject"
              ? "rejectSos"
              : mode === "priority"
                ? "updateSosPriority"
                : "createRescueTaskFromSos"
        }
        scope={sos?.location.administrativeArea}
      />
      <PermissionNote value={canAct} />
      <ErrorText value={error} />
    </Frame>
  );
}
