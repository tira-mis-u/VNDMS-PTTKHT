import { lazy, Suspense, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Hammer,
  MapPin,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  X,
} from "lucide-react";
import {
  budgetUsage,
  canCompleteRecoveryProject,
  isProjectOverdue,
  remainingBudget,
} from "@/domain/recovery/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, EmptyState, Progress } from "@/components/ui";
const RecoveryOperationalMap = lazy(
  () => import("../components/RecoveryOperationalMap"),
);
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export function RecoveryProjectDetailPage({
  projectId,
  navigate,
}: {
  projectId: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const project = store.recoveryProjects.find((item) => item.id === projectId);
  const [dialog, setDialog] = useState<
    "approve" | "reject" | "budget" | "verify" | "milestone" | null
  >(null);
  const [error, setError] = useState("");
  if (!project)
    return (
      <div className="workspace-content">
        <EmptyState
          title="Không tìm thấy dự án khôi phục"
          description={projectId}
          action={
            <Button onClick={() => navigate("/recovery/projects")}>
              Về danh sách
            </Button>
          }
        />
      </div>
    );
  const incident = store.incidents.find(
    (item) => item.id === project.incidentId,
  );
  const assessments = store.damageAssessments.filter((item) =>
    project.assessmentIds.includes(item.id),
  );
  const tasks = store.tasks.filter((item) => project.taskIds.includes(item.id));
  const teams = store.teams.filter((item) =>
    project.assignedTeamIds.includes(item.id),
  );
  const relief = store.reliefRequests.filter((item) =>
    project.relatedReliefRequestIds.includes(item.id),
  );
  const events = store.recoveryEvents
    .filter(
      (item) => item.entityType === "project" && item.entityId === project.id,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const completion = canCompleteRecoveryProject(project, {
    tasks: store.tasks,
    assessments: store.damageAssessments,
  });
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
    <div className="workspace-content recovery-project-detail">
      <div className="detail-topline">
        <button
          className="back-link"
          onClick={() => navigate("/recovery/projects")}
        >
          <ArrowLeft size={15} />
          Dự án khôi phục
        </button>
        <div className="detail-actions">
          {project.status === "Đề xuất" &&
            store.can("recovery_project_approve") && (
              <>
                <Button variant="secondary" onClick={() => setDialog("reject")}>
                  Từ chối
                </Button>
                <Button onClick={() => setDialog("approve")}>
                  <ShieldCheck size={14} />
                  Phê duyệt
                </Button>
              </>
            )}
          {project.status === "Đã phê duyệt" &&
            store.can("recovery_project_execute") && (
              <Button
                onClick={() =>
                  act(() => store.startRecoveryProject(project.id))
                }
              >
                <Play size={14} />
                Khởi động
              </Button>
            )}
          {project.status === "Đang thực hiện" &&
            store.can("recovery_project_execute") && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(() => store.pauseRecoveryProject(project.id))
                }
              >
                <Pause size={14} />
                Tạm dừng
              </Button>
            )}
          {project.status === "Tạm dừng" &&
            store.can("recovery_project_execute") && (
              <Button
                onClick={() =>
                  act(() => store.resumeRecoveryProject(project.id))
                }
              >
                <RotateCcw size={14} />
                Tiếp tục
              </Button>
            )}
          {["Đang thực hiện", "Tạm dừng"].includes(project.status) &&
            store.can("recovery_project_execute") && (
              <Button variant="secondary" onClick={() => setDialog("budget")}>
                <Banknote size={14} />
                Cập nhật chi phí
              </Button>
            )}
          {project.status === "Đang thực hiện" &&
            store.can("recovery_project_approve") && (
              <Button variant="secondary" onClick={() => setDialog("verify")}>
                <CheckCircle2 size={14} />
                Xác minh hoàn thành
              </Button>
            )}
          {project.status === "Đang thực hiện" &&
            store.can("recovery_project_execute") && (
              <Button
                disabled={!completion.allowed}
                onClick={() =>
                  act(() => store.completeRecoveryProject(project.id))
                }
              >
                <Check size={14} />
                Hoàn thành
              </Button>
            )}
        </div>
      </div>
      {error && (
        <div className="execution-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}
      <header className="project-detail-header">
        <span className="recovery-emblem">
          <Hammer size={23} />
        </span>
        <div>
          <div>
            <span>{project.code}</span>
            <Badge
              tone={
                project.priority === "Khẩn cấp"
                  ? "red"
                  : project.priority === "Cao"
                    ? "amber"
                    : "blue"
              }
            >
              {project.priority}
            </Badge>
            <Badge
              tone={
                project.status === "Hoàn thành"
                  ? "green"
                  : project.status === "Tạm dừng"
                    ? "amber"
                    : "blue"
              }
            >
              {project.status}
            </Badge>
          </div>
          <h1>{project.name}</h1>
          <p>
            <MapPin size={12} />
            {project.geographicScope} · {project.category}
          </p>
        </div>
        <div className="project-progress-header">
          <span>
            <b>{project.progress}%</b> tiến độ dẫn xuất
          </span>
          <Progress
            value={project.progress}
            tone={project.progress >= 80 ? "green" : "blue"}
          />
          <small>
            {
              project.milestones.filter((item) => item.status === "Hoàn thành")
                .length
            }
            /{project.milestones.length} milestone ·{" "}
            {tasks.filter((item) => item.status === "Hoàn thành").length}/
            {tasks.length} Task
          </small>
        </div>
      </header>
      <section className="project-overview-strip">
        <div>
          <span>Ngân sách phê duyệt</span>
          <b>{money(project.approvedBudget)}</b>
          <small>Ước tính {money(project.estimatedBudget)}</small>
        </div>
        <div className={budgetUsage(project) >= 85 ? "warning" : ""}>
          <span>Đã sử dụng</span>
          <b>{money(project.spentBudget)}</b>
          <small>{budgetUsage(project)}% ngân sách</small>
        </div>
        <div className={remainingBudget(project) < 0 ? "danger" : ""}>
          <span>Còn lại</span>
          <b>{money(remainingBudget(project))}</b>
          <small>
            {project.budgetOverrideNote
              ? "Có phê duyệt vượt"
              : "Không có override"}
          </small>
        </div>
        <div className={isProjectOverdue(project) ? "danger" : ""}>
          <span>Ngày mục tiêu</span>
          <b>{project.targetDate}</b>
          <small>
            {isProjectOverdue(project) ? "Dự án quá hạn" : "Đang trong hạn"}
          </small>
        </div>
      </section>
      <div className="project-detail-grid">
        <main>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Milestone khôi phục</h2>
                <p>Tiến độ được dẫn xuất, không cho UI đặt tùy ý thành 100%</p>
              </div>
              {store.can("recovery_project_execute") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog("milestone")}
                >
                  <Plus size={13} />
                  Thêm milestone
                </Button>
              )}
            </div>
            <div className="milestone-sequence">
              {[...project.milestones]
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <article key={item.id}>
                    <span
                      className={`milestone-state ${item.status.replaceAll(" ", "-").toLowerCase()}`}
                    >
                      {item.status === "Hoàn thành" ? (
                        <Check size={14} />
                      ) : item.status === "Đang thực hiện" ? (
                        <Play size={12} />
                      ) : (
                        <Circle size={11} />
                      )}
                    </span>
                    <div>
                      <span>
                        <b>
                          {item.order}. {item.name}
                        </b>
                        {item.required && <small>Bắt buộc</small>}
                      </span>
                      <p>{item.description}</p>
                      <div>
                        <Progress
                          value={item.progress}
                          tone={item.status === "Hoàn thành" ? "green" : "blue"}
                        />
                        <small>
                          {item.progress}% · Hạn {item.dueDate} · {item.owner}
                        </small>
                      </div>
                      <em>Tiêu chí: {item.completionCriteria}</em>
                    </div>
                    <span className="milestone-actions">
                      {item.status === "Chờ" &&
                        store.can("recovery_project_execute") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              act(() =>
                                store.startRecoveryMilestone(
                                  project.id,
                                  item.id,
                                ),
                              )
                            }
                          >
                            Bắt đầu
                          </Button>
                        )}
                      {item.status === "Đang thực hiện" &&
                        store.can("recovery_project_execute") && (
                          <Button
                            size="sm"
                            onClick={() =>
                              act(() =>
                                store.completeRecoveryMilestone(
                                  project.id,
                                  item.id,
                                ),
                              )
                            }
                          >
                            Hoàn thành
                          </Button>
                        )}
                      {item.status === "Chờ" &&
                        !item.required &&
                        store.can("recovery_project_execute") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              act(() =>
                                store.skipRecoveryMilestone(
                                  project.id,
                                  item.id,
                                ),
                              )
                            }
                          >
                            <SkipForward size={12} />
                          </Button>
                        )}
                    </span>
                  </article>
                ))}
            </div>
            {!completion.allowed && (
              <div className="completion-block">
                <AlertTriangle size={15} />
                <div>
                  <b>Chưa đủ điều kiện hoàn thành dự án</b>
                  {completion.reasons.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Nguồn lực và hồ sơ vận hành</h2>
                <p>Task, Team và Relief canonical</p>
              </div>
              {store.can("task_create") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act(() => store.createTaskFromRecoveryProject(project.id))
                  }
                >
                  <Plus size={13} />
                  Tạo Task
                </Button>
              )}
            </div>
            <div className="project-resource-columns">
              <div>
                <h3>Nhiệm vụ</h3>
                {tasks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/tasks/${item.id}`)}
                  >
                    <span>
                      <b>{item.id}</b>
                      <small>{item.title}</small>
                    </span>
                    <Badge
                      tone={item.status === "Hoàn thành" ? "green" : "blue"}
                    >
                      {item.status}
                    </Badge>
                  </button>
                ))}
              </div>
              <div>
                <h3>Đội phụ trách</h3>
                {teams.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/teams/${item.id}`)}
                  >
                    <span>
                      <b>{item.id}</b>
                      <small>{item.name}</small>
                    </span>
                    <Badge tone="blue">{item.status}</Badge>
                  </button>
                ))}
              </div>
              <div>
                <h3>Nguồn lực cứu trợ</h3>
                {relief.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/relief/requests/${item.id}`)}
                  >
                    <span>
                      <b>{item.id}</b>
                      <small>
                        {item.items.map((row) => row.name).join(", ")}
                      </small>
                    </span>
                    <Badge tone="blue">{item.status}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Cơ sở thiệt hại đã xác minh</h2>
                <p>Chỉ verified assessment được dùng để phê duyệt dự án</p>
              </div>
            </div>
            <div className="project-basis">
              {assessments.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/recovery/assessments/${item.id}`)}
                >
                  <span>
                    <b>
                      {item.code} · {item.area}
                    </b>
                    <small>
                      {item.assessmentType} · {money(item.estimatedLoss)}
                    </small>
                  </span>
                  <Badge
                    tone={item.status === "Đã xác minh" ? "green" : "amber"}
                  >
                    {item.status}
                  </Badge>
                  <ChevronRight size={13} />
                </button>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Bản đồ khôi phục</h2>
                <p>Damage locations, project, vùng ảnh hưởng và đội được gán</p>
              </div>
            </div>
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <RecoveryOperationalMap
                assessments={assessments}
                projects={[project]}
                incident={incident}
                teams={teams}
              />
            </Suspense>
          </section>
        </main>
        <aside>
          <section className="detail-section">
            <h2>Hồ sơ dự án</h2>
            <dl className="relief-facts">
              <div>
                <dt>Incident</dt>
                <dd>
                  <button
                    onClick={() => navigate(`/incidents/${project.incidentId}`)}
                  >
                    {project.incidentId}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{project.owner || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Khởi động</dt>
                <dd>{project.startDate ?? "Chưa khởi động"}</dd>
              </div>
              <div>
                <dt>Mục tiêu</dt>
                <dd>{project.targetDate}</dd>
              </div>
              <div>
                <dt>Assessment</dt>
                <dd>{project.assessmentIds.length}</dd>
              </div>
            </dl>
            <div className="justification">
              <b>Ghi chú</b>
              <p>{project.notes}</p>
            </div>
          </section>
          <section className="detail-section">
            <h2>Xác minh hoàn thành</h2>
            {project.completionVerification ? (
              <div className="verification-record">
                <ShieldCheck size={16} />
                <div>
                  <b>{project.completionVerification.actor}</b>
                  <p>{project.completionVerification.note}</p>
                  <small>{project.completionVerification.timestamp}</small>
                </div>
              </div>
            ) : (
              <p className="section-empty">
                Chưa có biên bản xác minh hoàn thành.
              </p>
            )}
          </section>
          <section className="detail-section">
            <h2>Timeline dự án</h2>
            <div className="detail-timeline">
              {events.map((event) => (
                <div key={event.id}>
                  <span />
                  <div>
                    <b>{event.message}</b>
                    <small>
                      {event.timestamp} · {event.actor}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {dialog && (
        <ProjectDialog
          mode={dialog}
          projectId={project.id}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
function ProjectDialog({
  mode,
  projectId,
  onClose,
}: {
  mode: "approve" | "reject" | "budget" | "verify" | "milestone";
  projectId: string;
  onClose: () => void;
}) {
  const store = useOperationalState();
  const project = store.recoveryProjects.find((item) => item.id === projectId)!;
  const [value, setValue] = useState(
    mode === "approve"
      ? project.estimatedBudget
      : mode === "budget"
        ? project.spentBudget
        : 0,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const run = () => {
    try {
      if (mode === "approve") store.approveRecoveryProject(projectId, value);
      if (mode === "reject") store.rejectRecoveryProject(projectId, note);
      if (mode === "budget")
        store.updateRecoveryBudget(projectId, value, note || null);
      if (mode === "verify")
        store.verifyRecoveryCompletion(projectId, note, [
          "Biên bản nghiệm thu hiện trường",
        ]);
      if (mode === "milestone")
        store.addRecoveryMilestone(projectId, {
          id: `RM-${Date.now()}`,
          name: note,
          description: "Milestone bổ sung theo quyết định điều hành.",
          required: true,
          dueDate: project.targetDate,
          owner: project.owner,
          completionCriteria: "Có biên bản hoàn thành được owner xác nhận.",
        });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu.");
    }
  };
  const title =
    mode === "approve"
      ? "Phê duyệt dự án"
      : mode === "reject"
        ? "Từ chối dự án"
        : mode === "budget"
          ? "Cập nhật chi phí"
          : mode === "verify"
            ? "Xác minh hoàn thành"
            : "Thêm milestone";
  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} />
      <div className="incident-form-dialog recovery-dialog">
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          {["approve", "budget"].includes(mode) && (
            <label className="field field-full">
              <span>
                {mode === "approve" ? "Ngân sách phê duyệt" : "Chi phí lũy kế"}
              </span>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </label>
          )}
          <label className="field field-full">
            <span>
              {mode === "milestone"
                ? "Tên milestone"
                : mode === "reject"
                  ? "Lý do"
                  : mode === "budget"
                    ? "Ghi chú override nếu vượt ngân sách"
                    : "Ghi chú / biên bản"}
            </span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && (
            <p className="team-form-error">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={
              (mode === "reject" ||
                mode === "verify" ||
                mode === "milestone") &&
              !note
            }
            onClick={run}
          >
            Xác nhận
          </Button>
        </footer>
      </div>
    </>
  );
}
