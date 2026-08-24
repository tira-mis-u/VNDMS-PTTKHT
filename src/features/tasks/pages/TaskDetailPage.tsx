import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  MapPin,
  MapPinned,
  MoreHorizontal,
  Navigation,
  Plus,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getValidTransitions, isTaskOverdue } from "@/domain/tasks/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress, SectionHeader } from "@/components/ui";
import { operationalMapFocusPath } from "@/app/routes/router";
import {
  TaskActionDialogs,
  type TaskDialog,
} from "../components/TaskActionDialogs";
const TaskDetailMap = lazy(() => import("../components/TaskDetailMap"));
const priorityTone = (p: string) =>
  p === "Khẩn cấp"
    ? "red"
    : p === "Cao"
      ? "amber"
      : p === "Thấp"
        ? "neutral"
        : "blue";
const statusTone = (s: string) =>
  s === "Hoàn thành"
    ? "green"
    : s === "Đang thực hiện"
      ? "blue"
      : s === "Đã hủy"
        ? "neutral"
        : "amber";
export function TaskDetailPage({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const { tasks, incidents, teams, taskUpdates, events, transitionTask, can } =
    useOperationalState();
  const task = tasks.find((t) => t.id === id);
  const [dialog, setDialog] = useState<TaskDialog>(null);
  const [more, setMore] = useState(false);
  const updates = useMemo(
    () => taskUpdates.filter((u) => u.taskId === id),
    [taskUpdates, id],
  );
  if (!task)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <Clock3 size={24} />
          <h2>Không tìm thấy nhiệm vụ</h2>
          <p>Mã nhiệm vụ không tồn tại hoặc không thuộc phạm vi truy cập.</p>
          <Button variant="secondary" onClick={() => navigate("/tasks")}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  const incident = incidents.find((i) => i.id === task.incidentId);
  const team = teams.find((t) => t.id === task.teamId);
  const overdue = isTaskOverdue(task);
  const transitions = getValidTransitions(task.status);
  const primary = transitions.find((s) => s !== "Đã hủy");
  const incidentEvents = events
    .filter(
      (e) => e.incidentId === task.incidentId && e.message.includes(task.id),
    )
    .slice(0, 5);
  const doPrimary = () => {
    if (!primary) return;
    if (primary === "Đã giao") setDialog("assign");
    else transitionTask(task.id, primary);
  };
  return (
    <div className="workspace-content task-detail-page">
      <header className="task-detail-header">
        <button className="back-link" onClick={() => navigate("/tasks")}>
          <ArrowLeft size={15} />
          Nhiệm vụ
        </button>
        <div className="incident-heading-row">
          <div>
            <div className="incident-code-line">
              <span>{task.id}</span>
              <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
              <Badge tone={statusTone(task.status)}>{task.status}</Badge>
              {overdue && <Badge tone="red">Quá hạn</Badge>}
            </div>
            <h1>{task.title}</h1>
            <p>
              <MapPin size={13} />
              {task.location}
              <i />
              Cập nhật {task.updatedAt}
            </p>
          </div>
          <div className="incident-header-actions">
            <Button
              variant="secondary"
              onClick={() => navigate(operationalMapFocusPath(task.id))}
            >
              <MapPinned size={15} />
              Xem trên bản đồ
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(`/ai-assistant?context=Task&id=${task.id}`)
              }
            >
              <ShieldCheck size={15} />
              Trợ lý AI
            </Button>
            {primary &&
              can(
                primary === "Đã tiếp nhận"
                  ? "task_accept"
                  : primary === "Đang thực hiện"
                    ? "task_start"
                    : primary === "Hoàn thành"
                      ? "task_complete"
                      : "task_assign",
              ) && (
                <Button onClick={doPrimary}>
                  {primary === "Đã giao" ? "Điều phối đội" : primary}
                </Button>
              )}
            <Button variant="secondary" onClick={() => setDialog("progress")}>
              Cập nhật tiến độ
            </Button>
            <Button variant="secondary" onClick={() => setDialog("update")}>
              Thêm cập nhật
            </Button>
            <div className="more-wrap">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mở thêm thao tác nhiệm vụ"
                onClick={() => setMore(!more)}
              >
                <MoreHorizontal size={18} />
              </Button>
              {more && (
                <div className="incident-more-menu">
                  <button
                    onClick={() => {
                      setDialog("assign");
                      setMore(false);
                    }}
                  >
                    Điều phối đội khác
                  </button>
                  <button
                    onClick={() => {
                      setDialog("transition");
                      setMore(false);
                    }}
                  >
                    Xem transition hợp lệ
                  </button>
                  {transitions.includes("Đã hủy") && can("task_cancel") && (
                    <button
                      className="danger"
                      onClick={() => {
                        setDialog("cancel");
                        setMore(false);
                      }}
                    >
                      Hủy nhiệm vụ
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="incident-detail-tabs">
          <button className="active">Tổng quan</button>
          <button>Tiến độ</button>
          <button>
            Cập nhật hiện trường <span>{updates.length}</span>
          </button>
          <button>Bản đồ</button>
          <button>Kết quả</button>
        </nav>
      </header>
      <div className="task-detail-layout">
        <main className="task-detail-main">
          <section className="incident-detail-section">
            <SectionHeader title="Tổng quan nhiệm vụ" />
            <div className="task-overview">
              <p>{task.description}</p>
              <div className="task-operational-facts">
                <div>
                  <span>Sự cố liên quan</span>
                  <button
                    onClick={() => navigate(`/incidents/${task.incidentId}`)}
                  >
                    {task.incidentId}
                    <ChevronRight size={13} />
                  </button>
                  <small>{incident?.title}</small>
                </div>
                <div>
                  <span>Đội thực hiện</span>
                  <b>{task.teamId || "Chưa giao"}</b>
                  <small>{team?.name ?? "Cần điều phối đội"}</small>
                </div>
                <div>
                  <span>Địa điểm</span>
                  <b>{task.location}</b>
                  <small>{task.type}</small>
                </div>
              </div>
            </div>
          </section>
          <section className="incident-detail-section task-progress-section">
            <SectionHeader
              title="Tiến độ tác chiến"
              description="Tiến độ được dùng để tính lại tiến độ sự cố liên quan"
              action="Cập nhật"
            />
            <div className="task-progress-body">
              <div>
                <strong>{task.progress}%</strong>
                <span>{task.status}</span>
              </div>
              <Progress
                value={task.progress}
                tone={task.progress === 100 ? "green" : "blue"}
              />
              <div className="progress-milestones">
                {[0, 25, 50, 75, 100].map((v) => (
                  <span className={task.progress >= v ? "reached" : ""} key={v}>
                    <i />
                    {v}%
                  </span>
                ))}
              </div>
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Cập nhật hiện trường"
              description="Thông tin từ đội thực hiện và thiết bị hiện trường"
              action="Thêm cập nhật"
            />
            <div className="field-update-list">
              {updates.map((update) => (
                <article key={update.id}>
                  <time>{update.timestamp}</time>
                  <span className="field-update-icon">
                    <Radio size={14} />
                  </span>
                  <div>
                    <p>{update.message}</p>
                    <span>
                      <b>{update.actor}</b> · {update.teamId} · {update.source}
                    </span>
                    {update.location && (
                      <small>
                        <MapPin size={11} />
                        {update.location}
                      </small>
                    )}
                  </div>
                  <Badge
                    tone={
                      update.networkStatus === "Đã đồng bộ" ? "green" : "amber"
                    }
                  >
                    {update.networkStatus}
                  </Badge>
                </article>
              ))}
              {!updates.length && (
                <p className="section-empty">Chưa có cập nhật hiện trường.</p>
              )}
            </div>
            <button
              className="add-event-row"
              onClick={() => setDialog("update")}
            >
              <Plus size={14} />
              Thêm cập nhật hiện trường
            </button>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Nhật ký nhiệm vụ" />
            <div className="incident-timeline task-timeline">
              {incidentEvents.map((event) => (
                <article key={event.id}>
                  <time>{event.timestamp}</time>
                  <span className="event-marker">
                    <i />
                  </span>
                  <div>
                    <p>{event.message}</p>
                    <span>
                      <b>{event.actor}</b> · {event.source}
                    </span>
                  </div>
                </article>
              ))}
              <article>
                <time>{task.createdAt.split(" ")[1]}</time>
                <span className="event-marker">
                  <i />
                </span>
                <div>
                  <p>
                    Tạo nhiệm vụ {task.id} từ {task.incidentId}
                  </p>
                  <span>
                    <b>Trung tâm điều hành</b> · Hệ thống nghiệp vụ
                  </span>
                </div>
              </article>
            </div>
          </section>
          <section className="incident-detail-section task-team-section">
            <SectionHeader title="Đội thực hiện" action="Điều phối" />
            {team ? (
              <div className="assigned-team-row">
                <span className="team-emblem">
                  <Users size={18} />
                </span>
                <div>
                  <button
                    className="entity-link"
                    onClick={() => navigate(`/teams/${team.id}`)}
                  >
                    {team.id} · {team.name}
                    <ChevronRight size={13} />
                  </button>
                  <p>
                    {team.capability} · {team.members} thành viên
                  </p>
                </div>
                <div>
                  <Badge tone={team.status === "Sẵn sàng" ? "green" : "blue"}>
                    {team.status}
                  </Badge>
                  <small>Đội trưởng: {task.teamLeader || task.assignee}</small>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog("assign")}
                >
                  Thay đổi
                </Button>
              </div>
            ) : (
              <div className="unassigned-team">
                <span>Nhiệm vụ chưa được giao cho đội.</span>
                <Button size="sm" onClick={() => setDialog("assign")}>
                  Điều phối đội
                </Button>
              </div>
            )}
          </section>
          <section className="incident-detail-section task-map-section">
            <SectionHeader
              title="Bản đồ tác nghiệp"
              description="Nhiệm vụ, sự cố liên quan, đội thực hiện và tuyến tiếp cận"
            />
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <TaskDetailMap task={task} incident={incident} team={team} />
            </Suspense>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Kết quả nhiệm vụ" />
            {task.status === "Hoàn thành" ? (
              <div className="task-result">
                <ShieldCheck size={20} />
                <div>
                  <b>Nhiệm vụ đã hoàn thành</b>
                  <p>
                    Hoàn thành lúc {task.completedAt}. Kết quả đã được phản ánh
                    vào tiến độ sự cố {task.incidentId}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="task-result pending">
                <Navigation size={20} />
                <div>
                  <b>Đang chờ kết quả cuối cùng</b>
                  <p>Kết quả được ghi nhận khi đội hoàn tất nhiệm vụ.</p>
                </div>
              </div>
            )}
          </section>
        </main>
        <aside className="incident-context-panel task-context">
          <div className="context-heading">
            <span>Thông tin nhiệm vụ</span>
            <button>Chỉnh sửa</button>
          </div>
          <dl>
            <Context label="Mức ưu tiên">
              <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
            </Context>
            <Context label="Trạng thái">
              <Badge tone={statusTone(task.status)}>{task.status}</Badge>
            </Context>
            {overdue && (
              <Context label="Thời hạn">
                <Badge tone="red">Quá hạn</Badge>
              </Context>
            )}
            <Context label="Đội thực hiện" value={task.teamId || "Chưa giao"} />
            <Context
              label="Đội trưởng"
              value={task.teamLeader || "Chưa chỉ định"}
            />
            <Context
              label="Người phụ trách"
              value={task.assignee || "Chưa chỉ định"}
            />
            <Context label="Sự cố" value={task.incidentId} />
            <Context label="Khu vực" value={task.location} />
            <Context label="Hạn xử lý" value={task.dueAt} />
            <Context label="Thời gian tạo" value={task.createdAt} />
            <Context label="Cập nhật cuối" value={task.updatedAt} />
          </dl>
          <div className="context-progress">
            <span>
              <b>Tiến độ</b>
              <strong>{task.progress}%</strong>
            </span>
            <Progress
              value={task.progress}
              tone={task.progress === 100 ? "green" : "blue"}
            />
          </div>
          <div className="task-state-machine">
            <span>Vòng đời nhiệm vụ</span>
            {[
              "Chờ giao",
              "Đã giao",
              "Đã tiếp nhận",
              "Đang thực hiện",
              "Hoàn thành",
            ].map((state, index) => {
              const current = [
                "Chờ giao",
                "Đã giao",
                "Đã tiếp nhận",
                "Đang thực hiện",
                "Hoàn thành",
              ].indexOf(task.status);
              return (
                <div key={state}>
                  <i
                    className={
                      index < current
                        ? "done"
                        : index === current
                          ? "current"
                          : ""
                    }
                  />
                  <b>{state}</b>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      <TaskActionDialogs
        mode={dialog}
        task={task}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
function Context({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children ?? value}</dd>
    </div>
  );
}
