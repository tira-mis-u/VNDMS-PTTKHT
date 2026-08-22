import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Hammer,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Link2,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  UserRound,
  X,
} from "lucide-react";
import { evaluateStepCompletion } from "@/domain/playbooks/rules";
import { executionSummary } from "@/application/playbooks/playbookQueries";
import type {
  PlaybookStep,
  PlaybookStepExecution,
} from "@/domain/playbooks/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, EmptyState, Progress } from "@/components/ui";
const tone = (
  status: string,
): "red" | "amber" | "green" | "blue" | "neutral" =>
  status === "Bị chặn"
    ? "red"
    : status === "Đang thực hiện"
      ? "blue"
      : status === "Sẵn sàng"
        ? "amber"
        : status === "Hoàn thành"
          ? "green"
          : "neutral";
export function PlaybookExecutionPage({
  playbookId,
  navigate,
}: {
  playbookId: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const playbook = store.playbooks.find((item) => item.id === playbookId);
  const execution =
    store.playbookExecutions.find(
      (item) =>
        item.playbookId === playbookId &&
        ["Đang hoạt động", "Tạm dừng"].includes(item.status),
    ) ??
    store.playbookExecutions.find((item) => item.playbookId === playbookId);
  const [selectedId, setSelected] = useState(
    execution?.currentStep ?? execution?.stepExecutions[0]?.stepId ?? "",
  );
  const [evidence, setEvidence] = useState(false);
  const [error, setError] = useState("");
  if (!playbook || !execution)
    return (
      <div className="workspace-content">
        <EmptyState
          title="Chưa có execution"
          description="Kích hoạt playbook trong context của một Incident trước khi thực thi."
          action={
            <Button onClick={() => navigate(`/playbooks/${playbookId}`)}>
              Mở playbook
            </Button>
          }
        />
      </div>
    );
  const selectedTemplate =
    playbook.steps.find((item) => item.id === selectedId) ?? playbook.steps[0];
  const selected = execution.stepExecutions.find(
    (item) => item.stepId === selectedTemplate.id,
  )!;
  const summary = executionSummary(playbook, execution);
  const context = {
    tasks: store.tasks,
    teams: store.teams,
    shelters: store.shelters,
    evacuations: store.evacuationOperations,
    sosRequests: store.sosRequests,
    reliefRequests: store.reliefRequests,
  };
  const criteria = evaluateStepCompletion(selectedTemplate, selected, context);
  const incident = store.incidents.find(
    (item) => item.id === execution.incidentId,
  );
  const act = (action: () => void) => {
    try {
      setError("");
      action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể thực hiện thao tác.",
      );
    }
  };
  return (
    <div className="workspace-content playbook-execution">
      <div className="detail-topline">
        <button
          className="back-link"
          onClick={() => navigate(`/playbooks/${playbook.id}`)}
        >
          <ArrowLeft size={15} />
          Chi tiết playbook
        </button>
        <div className="detail-actions">
          {store.can("recovery_project_create") && (
            <Button
              variant="secondary"
              onClick={() =>
                act(() => {
                  const id = store.createRecoveryProjectFromPlaybook(
                    execution.id,
                  );
                  navigate(`/recovery/projects/${id}`);
                })
              }
            >
              <Hammer size={14} />
              Tạo dự án khôi phục
            </Button>
          )}
          {execution.status === "Đang hoạt động" &&
            store.can("playbook_execute") && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(() => store.pausePlaybookExecution(execution.id))
                }
              >
                <Pause size={14} />
                Tạm dừng
              </Button>
            )}
          {execution.status === "Tạm dừng" && store.can("playbook_execute") && (
            <Button
              onClick={() =>
                act(() => store.resumePlaybookExecution(execution.id))
              }
            >
              <RotateCcw size={14} />
              Tiếp tục
            </Button>
          )}
          {["Đang hoạt động", "Tạm dừng"].includes(execution.status) &&
            store.can("playbook_cancel") && (
              <Button
                variant="ghost"
                onClick={() =>
                  act(() => store.cancelPlaybookExecution(execution.id))
                }
              >
                <Ban size={14} />
                Hủy execution
              </Button>
            )}
          {execution.status === "Đang hoạt động" &&
            summary.progress === 100 && (
              <Button
                onClick={() =>
                  act(() => store.completePlaybookExecution(execution.id))
                }
              >
                <CheckCircle2 size={14} />
                Hoàn thành playbook
              </Button>
            )}
        </div>
      </div>
      <header className="execution-header">
        <div>
          <div>
            <Badge tone="blue">{execution.id}</Badge>
            <Badge
              tone={
                execution.status === "Đang hoạt động"
                  ? "green"
                  : execution.status === "Tạm dừng"
                    ? "amber"
                    : "neutral"
              }
            >
              {execution.status}
            </Badge>
            <button
              onClick={() => navigate(`/incidents/${execution.incidentId}`)}
            >
              {execution.incidentId}
              <ChevronRight size={12} />
            </button>
          </div>
          <h1>{playbook.name}</h1>
          <p>
            {incident?.title} · kích hoạt bởi {execution.activatedBy} lúc{" "}
            {execution.startedAt}
          </p>
        </div>
        <div className="execution-progress">
          <span>
            <b>{summary.progress}%</b> hoàn thành
          </span>
          <Progress
            value={summary.progress}
            tone={summary.progress === 100 ? "green" : "blue"}
          />
          <small>
            {
              execution.stepExecutions.filter(
                (item) => item.status === "Hoàn thành",
              ).length
            }
            /{execution.stepExecutions.length} bước hoàn thành ·{" "}
            {summary.blocked.length} bị chặn
          </small>
        </div>
      </header>
      <div className="execution-context-bar">
        <span>
          <b>Bước hiện tại</b>
          {summary.current?.order}. {summary.current?.name ?? "Không có"}
        </span>
        <span>
          <b>Bước tiếp theo</b>
          {summary.next
            ? `${summary.next.order}. ${summary.next.name}`
            : "Chưa xác định"}
        </span>
        <span>
          <b>Cần hành động</b>
          {selected.status === "Bị chặn"
            ? "Gỡ điều kiện tiên quyết"
            : selected.status === "Sẵn sàng"
              ? "Bắt đầu bước"
              : selected.status === "Đang thực hiện"
                ? "Ghi nhận bằng chứng và hoàn thành"
                : "Theo dõi execution"}
        </span>
      </div>
      {error && (
        <div className="execution-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      <div className="execution-layout">
        <main className="execution-sequence">
          <div className="sequence-heading">
            <div>
              <h2>Trình tự tác chiến</h2>
              <p>Chọn bước để xem điều kiện, liên kết và hành động</p>
            </div>
          </div>
          {[...playbook.steps]
            .sort((a, b) => a.order - b.order)
            .map((template) => {
              const step = execution.stepExecutions.find(
                (item) => item.stepId === template.id,
              )!;
              return (
                <button
                  key={template.id}
                  className={`execution-step ${selectedId === template.id ? "selected" : ""} status-${step.status.replaceAll(" ", "-").toLowerCase()}`}
                  onClick={() => {
                    setSelected(template.id);
                    setError("");
                  }}
                >
                  <span className="execution-step-state">
                    {step.status === "Hoàn thành" ? (
                      <Check size={15} />
                    ) : step.status === "Bị chặn" ? (
                      <LockKeyhole size={14} />
                    ) : step.status === "Đang thực hiện" ? (
                      <Play size={13} />
                    ) : (
                      <Circle size={12} />
                    )}
                  </span>
                  <span className="execution-step-copy">
                    <span>
                      <b>
                        {template.order}. {template.name}
                      </b>
                      {template.required && <small>Bắt buộc</small>}
                    </span>
                    <p>{template.objective}</p>
                    <small>
                      {step.owner ?? template.responsibleRole} ·{" "}
                      {template.estimatedDuration}
                    </small>
                    {step.blockedReason && (
                      <em>
                        <ShieldAlert size={12} />
                        {step.blockedReason}
                      </em>
                    )}
                  </span>
                  <Badge tone={tone(step.status)}>{step.status}</Badge>
                  <ChevronRight size={15} />
                </button>
              );
            })}
        </main>
        <aside className="step-detail-panel">
          <header>
            <div>
              <Badge tone={tone(selected.status)}>{selected.status}</Badge>
              <span>{selectedTemplate.type}</span>
            </div>
            <h2>
              {selectedTemplate.order}. {selectedTemplate.name}
            </h2>
            <p>{selectedTemplate.description}</p>
          </header>
          <section>
            <h3>Mục tiêu và phụ trách</h3>
            <div className="step-owner">
              <UserRound size={16} />
              <span>
                <small>Người/vai trò chịu trách nhiệm</small>
                <b>{selected.owner ?? selectedTemplate.responsibleRole}</b>
              </span>
            </div>
            <p>{selectedTemplate.objective}</p>
          </section>
          <section>
            <h3>Điều kiện tiên quyết</h3>
            {selectedTemplate.prerequisites.length ? (
              <ul>
                {selectedTemplate.prerequisites.map((id) => {
                  const template = playbook.steps.find(
                    (item) => item.id === id,
                  )!;
                  const state = execution.stepExecutions.find(
                    (item) => item.stepId === id,
                  )!;
                  return (
                    <li key={id}>
                      <span
                        className={state.status === "Hoàn thành" ? "done" : ""}
                      >
                        {state.status === "Hoàn thành" ? (
                          <Check size={12} />
                        ) : (
                          <Clock3 size={12} />
                        )}
                      </span>
                      <b>{template.name}</b>
                      <Badge tone={tone(state.status)}>{state.status}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">Không có bước tiên quyết.</p>
            )}
          </section>
          <section>
            <h3>Tiêu chí hoàn thành</h3>
            <ul className="criteria-list">
              {selectedTemplate.completionCriteria.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={13} />
                  {item}
                </li>
              ))}
            </ul>
            {selected.status === "Đang thực hiện" && (
              <div
                className={
                  criteria.satisfied ? "criteria-ok" : "criteria-blocked"
                }
              >
                {criteria.satisfied ? (
                  <>
                    <CheckCircle2 size={14} />
                    Đã đủ bằng chứng để hoàn thành.
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    <span>{criteria.reasons.join(" ")}</span>
                  </>
                )}
              </div>
            )}
          </section>
          <LinkedRecords
            template={selectedTemplate}
            step={selected}
            navigate={navigate}
          />
          <section>
            <h3>Ghi chú bước</h3>
            <p className="step-notes">
              {selected.notes || "Chưa có ghi chú nghiệp vụ."}
            </p>
            {selected.verificationNote && (
              <p className="verification-note">
                <ShieldAlert size={13} />
                {selected.verificationNote}
              </p>
            )}
          </section>
          <footer>
            {store.can("playbook_execute") &&
              ["Sẵn sàng"].includes(selected.status) && (
                <Button
                  onClick={() =>
                    act(() =>
                      store.startPlaybookStep(execution.id, selected.stepId),
                    )
                  }
                >
                  <Play size={14} />
                  Bắt đầu bước
                </Button>
              )}
            {store.can("playbook_execute") &&
              selected.status === "Đang thực hiện" && (
                <>
                  <Button variant="secondary" onClick={() => setEvidence(true)}>
                    <Link2 size={14} />
                    Bằng chứng & liên kết
                  </Button>
                  <Button
                    disabled={!criteria.satisfied}
                    onClick={() =>
                      act(() =>
                        store.completePlaybookStep(
                          execution.id,
                          selected.stepId,
                        ),
                      )
                    }
                  >
                    <Check size={14} />
                    Hoàn thành
                  </Button>
                </>
              )}
            {store.can("playbook_execute") &&
              ["Chờ", "Sẵn sàng", "Bị chặn"].includes(selected.status) &&
              (!selectedTemplate.required ||
                store.can("playbook_override")) && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    act(() =>
                      store.skipPlaybookStep(execution.id, selected.stepId),
                    )
                  }
                >
                  <SkipForward size={14} />
                  Bỏ qua
                </Button>
              )}
          </footer>
        </aside>
      </div>
      <section className="execution-timeline detail-section">
        <div className="section-heading">
          <div>
            <h2>Timeline thực thi</h2>
            <p>Mọi thay đổi quan trọng được ghi vào audit hiện tại</p>
          </div>
        </div>
        <div className="detail-timeline">
          {execution.timeline.map((event) => (
            <div key={event.id}>
              <span />
              <div>
                <b>{event.message}</b>
                <small>
                  {event.timestamp} · {event.actor} · {event.source}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>
      {evidence && (
        <EvidenceDialog
          executionId={execution.id}
          template={selectedTemplate}
          step={selected}
          onClose={() => setEvidence(false)}
        />
      )}
    </div>
  );
}
function LinkedRecords({
  template,
  step,
  navigate,
}: {
  template: PlaybookStep;
  step: PlaybookStepExecution;
  navigate: (path: string) => void;
}) {
  const groups = [
    { label: "Nhiệm vụ", ids: step.linkedTaskIds, path: "/tasks/" },
    { label: "Đội cứu hộ", ids: step.linkedTeamIds, path: "/teams/" },
    { label: "Điểm sơ tán", ids: step.linkedShelterIds, path: "/shelters/" },
    {
      label: "Hoạt động sơ tán",
      ids: step.linkedEvacuationIds,
      path: "/shelters?operation=",
    },
    { label: "SOS", ids: step.linkedSosIds, path: "/sos/" },
    {
      label: "Yêu cầu cứu trợ",
      ids: step.linkedReliefRequestIds,
      path: "/relief/requests/",
    },
  ].filter((group) => group.ids.length);
  return (
    <section>
      <h3>Hồ sơ nghiệp vụ liên kết</h3>
      {groups.length ? (
        <div className="linked-records">
          {groups.flatMap((group) =>
            group.ids.map((id) => (
              <button
                key={`${group.label}-${id}`}
                onClick={() =>
                  navigate(
                    group.label === "Hoạt động sơ tán"
                      ? "/shelters"
                      : `${group.path}${id}`,
                  )
                }
              >
                <span>
                  <small>{group.label}</small>
                  <b>{id}</b>
                </span>
                <ChevronRight size={13} />
              </button>
            )),
          )}
        </div>
      ) : (
        <p className="muted">
          Chưa liên kết hồ sơ cho bước {template.type.toLowerCase()}.
        </p>
      )}
    </section>
  );
}
function EvidenceDialog({
  executionId,
  template,
  step,
  onClose,
}: {
  executionId: string;
  template: PlaybookStep;
  step: PlaybookStepExecution;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const [notes, setNotes] = useState(step.notes);
  const [verification, setVerification] = useState(step.verificationNote ?? "");
  const [selected, setSelected] = useState("");
  const options = useMemo(
    () =>
      template.type === "Nhiệm vụ"
        ? store.tasks.map((item) => ({
            id: item.id,
            label: `${item.id} — ${item.title}`,
          }))
        : template.type === "Điều động"
          ? store.teams.map((item) => ({
              id: item.id,
              label: `${item.id} — ${item.name}`,
            }))
          : template.type === "Sơ tán"
            ? store.evacuationOperations.map((item) => ({
                id: item.id,
                label: `${item.id} — ${item.sourceArea}`,
              }))
            : template.type === "Điểm sơ tán"
              ? store.shelters.map((item) => ({
                  id: item.id,
                  label: `${item.id} — ${item.name}`,
                }))
              : template.type === "Cứu trợ"
                ? store.reliefRequests.map((item) => ({
                    id: item.id,
                    label: `${item.id} — ${item.destination}`,
                  }))
                : [],
    [
      template.type,
      store.tasks,
      store.teams,
      store.evacuationOperations,
      store.shelters,
      store.reliefRequests,
    ],
  );
  const save = () => {
    const changes: Parameters<typeof store.updatePlaybookStepEvidence>[2] = {
      notes,
      verificationNote: verification || null,
    };
    if (selected) {
      if (template.type === "Nhiệm vụ")
        changes.linkedTaskIds = [...new Set([...step.linkedTaskIds, selected])];
      if (template.type === "Điều động")
        changes.linkedTeamIds = [...new Set([...step.linkedTeamIds, selected])];
      if (template.type === "Sơ tán")
        changes.linkedEvacuationIds = [
          ...new Set([...step.linkedEvacuationIds, selected]),
        ];
      if (template.type === "Điểm sơ tán")
        changes.linkedShelterIds = [
          ...new Set([...step.linkedShelterIds, selected]),
        ];
      if (template.type === "Cứu trợ")
        changes.linkedReliefRequestIds = [
          ...new Set([...step.linkedReliefRequestIds, selected]),
        ];
    }
    store.updatePlaybookStepEvidence(executionId, step.stepId, changes);
    onClose();
  };
  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} />
      <div className="incident-form-dialog playbook-dialog">
        <header>
          <h2>Bằng chứng bước tác chiến</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field field-full">
            <span>Ghi chú nghiệp vụ</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {template.type === "Xác minh" && (
            <label className="field field-full">
              <span>Kết quả xác minh</span>
              <textarea
                rows={3}
                value={verification}
                onChange={(event) => setVerification(event.target.value)}
              />
            </label>
          )}
          {options.length > 0 && (
            <label className="field field-full">
              <span>Liên kết hồ sơ canonical</span>
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Không thêm liên kết</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="form-hint">
            Liên kết chỉ lưu ID của entity hiện có; không tạo bản sao dữ liệu
            nghiệp vụ.
          </p>
        </div>
        <footer>
          {template.type === "Nhiệm vụ" && store.can("task_create") && (
            <Button
              variant="secondary"
              onClick={() => {
                store.createTaskFromPlaybookStep(executionId, step.stepId);
                onClose();
              }}
            >
              Tạo Task từ bước
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save}>Lưu bằng chứng</Button>
        </footer>
      </div>
    </>
  );
}
