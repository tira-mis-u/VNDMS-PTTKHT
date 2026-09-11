import { lazy, Suspense, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ClipboardPlus,
  FileText,
  MapPin,
  MapPinned,
  MoreHorizontal,
  Plus,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress, SectionHeader } from "@/components/ui";
import { operationalMapFocusPath } from "@/app/routes/router";
import {
  IncidentActionDialogs,
  type IncidentDialog,
} from "../components/IncidentActionDialogs";
const IncidentDetailMap = lazy(() => import("../components/IncidentDetailMap"));
const severityTone = (severity: string) =>
  severity === "Khẩn cấp" ? "red" : severity === "Cao" ? "amber" : "blue";
const statusTone = (status: string) =>
  status === "Đã đóng"
    ? "neutral"
    : status === "Đã kiểm soát"
      ? "green"
      : "blue";

export function IncidentDetailPage({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const {
    incidents,
    events,
    tasks,
    teams,
    sosRequests,
    can,
  } = useOperationalState();
  const incident = incidents.find((item) => item.id === id);
  const [dialog, setDialog] = useState<IncidentDialog>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const incidentEvents = useMemo(
    () =>
      events
        .filter((item) => item.incidentId === id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [events, id],
  );
  const incidentTasks = tasks.filter((item) => item.incidentId === id);
  const incidentSos = sosRequests.filter(
    (item) => item.linkedIncidentId === id,
  );
  const team = teams.find((item) => item.id === incident?.assignedTeamId);
  if (!incident)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <AlertTriangle size={24} />
          <h2>Không tìm thấy sự cố</h2>
          <p>Mã sự cố không tồn tại hoặc đã bị xóa.</p>
          <Button variant="secondary" onClick={() => navigate("/incidents")}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  const jump = (section: string) =>
    document
      .getElementById(section)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="workspace-content incident-detail-page">
      <header className="incident-detail-header">
        <button className="back-link" onClick={() => navigate("/incidents")}>
          <ArrowLeft size={15} />
          Sự cố
        </button>
        <div className="incident-heading-row">
          <div>
            <div className="incident-code-line">
              <span>{incident.code}</span>
              <Badge tone={severityTone(incident.severity)}>
                {incident.severity}
              </Badge>
              <Badge tone={statusTone(incident.status)}>
                {incident.status}
              </Badge>
            </div>
            <h1>{incident.title}</h1>
            <p>
              <MapPin size={13} />
              {incident.location.name}
              <i />
              Cập nhật {incident.updatedAt}
            </p>
          </div>
          <div className="incident-header-actions">
            <Button
              variant="secondary"
              onClick={() => navigate(operationalMapFocusPath(incident.id))}
            >
              <MapPinned size={15} />
              Xem trên bản đồ
            </Button>
            {can("dispatch") && (
              <Button variant="secondary" onClick={() => setDialog("dispatch")}>
                <ShieldCheck size={15} />
                Điều phối
              </Button>
            )}
            {can("task_create") && (
              <Button onClick={() => setDialog("task")}>
                <ClipboardPlus size={15} />
                Giao nhiệm vụ
              </Button>
            )}
            {can("update") && (
              <Button variant="secondary" onClick={() => setDialog("event")}>
                Cập nhật
              </Button>
            )}
            <div className="more-wrap">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mở thêm thao tác sự cố"
                onClick={() => setMoreOpen(!moreOpen)}
              >
                <MoreHorizontal size={18} />
              </Button>
              {moreOpen && (
                <div className="incident-more-menu">
                  {can("severity") && (
                    <button
                      onClick={() => {
                        setDialog("severity");
                        setMoreOpen(false);
                      }}
                    >
                      Cập nhật mức độ
                    </button>
                  )}
                  {can("update") && (
                    <button
                      onClick={() => {
                        setDialog("status");
                        setMoreOpen(false);
                      }}
                    >
                      Chuyển trạng thái
                    </button>
                  )}
                  {can("close") && incident.status !== "Đã đóng" && (
                    <button
                      className="danger"
                      onClick={() => {
                        setDialog("close");
                        setMoreOpen(false);
                      }}
                    >
                      Đóng sự cố
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="incident-detail-tabs">
          <button onClick={() => jump("tong-quan")} className="active">
            Tổng quan
          </button>
          <button onClick={() => jump("dien-bien")}>
            Diễn biến <span>{incidentEvents.length}</span>
          </button>
          <button onClick={() => jump("nhiem-vu")}>
            Nhiệm vụ <span>{incidentTasks.length}</span>
          </button>
          <button onClick={() => jump("sos")}>
            SOS <span>{incidentSos.length}</span>
          </button>
          <button onClick={() => jump("doi-cuu-ho")}>Đội xử lý</button>
          <button onClick={() => jump("ban-do")}>Khu vực ảnh hưởng</button>
          <button onClick={() => jump("bao-cao")}>Báo cáo hiện trường</button>
        </nav>
      </header>
      <div className="incident-detail-layout">
        <main className="incident-detail-main">
          <section
            id="tong-quan"
            className="incident-detail-section incident-overview-section"
          >
            <SectionHeader title="Tổng quan sự cố" />
            <div className="incident-summary-copy">
              <p>{incident.description}</p>
              <div className="incident-impact-grid">
                <Impact
                  label="Dân số có nguy cơ"
                  value={incident.affectedPopulation.toLocaleString("vi-VN")}
                />
                <Impact
                  label="Hộ dân"
                  value={incident.affectedHouseholds.toLocaleString("vi-VN")}
                />
                <Impact
                  label="Công trình"
                  value={String(incident.affectedBuildings)}
                />
                <Impact
                  label="Tuyến đường"
                  value={String(incident.affectedRoads)}
                />
                <Impact label="Mức độ ngập" value={incident.floodDepth} />
                <Impact
                  label="Diện tích ảnh hưởng"
                  value={`${incident.areaHectares} ha`}
                />
              </div>
            </div>
          </section>
          <section id="dien-bien" className="incident-detail-section">
            <SectionHeader
              title="Nhật ký diễn biến"
              description="Quyết định, báo cáo và cập nhật trong suốt vòng đời sự cố"
            />
            <div className="incident-timeline">
              {incidentEvents.map((event) => (
                <article key={event.id}>
                  <time>{event.timestamp}</time>
                  <span className={`event-marker event-${event.type}`}>
                    <i />
                  </span>
                  <div>
                    <p>{event.message}</p>
                    <span>
                      <b>{event.actor}</b>
                      {event.source && <> · {event.source}</>}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            {can("update") && (
              <button
                className="add-event-row"
                onClick={() => setDialog("event")}
              >
                <Plus size={14} />
                Thêm diễn biến thủ công
              </button>
            )}
          </section>
          <section id="nhiem-vu" className="incident-detail-section">
            <SectionHeader
              title="Nhiệm vụ liên quan"
              description={`${incidentTasks.filter((item) => item.status !== "Hoàn thành").length} nhiệm vụ đang mở`}
            />
            <div className="incident-task-list">
              {incidentTasks.map((task) => (
                <article key={task.id}>
                  <div className="task-main">
                    <span>
                      <Badge
                        tone={task.priority === "Khẩn cấp" ? "red" : "amber"}
                      >
                        {task.priority}
                      </Badge>
                      <small>{task.id}</small>
                    </span>
                    <b>{task.title}</b>
                    <p>
                      {task.location} · Hạn {task.dueAt}
                    </p>
                  </div>
                  <div className="task-assignee">
                    <small>Phụ trách</small>
                    <b>{task.teamId || "Chưa giao"}</b>
                    <span>{task.assignee || "Chưa chỉ định"}</span>
                  </div>
                  <Badge
                    tone={
                      task.status === "Hoàn thành"
                        ? "green"
                        : task.status === "Chờ giao"
                          ? "neutral"
                          : "blue"
                    }
                  >
                    {task.status}
                  </Badge>
                </article>
              ))}
              {incidentTasks.length === 0 && (
                <p className="section-empty">Chưa có nhiệm vụ liên quan.</p>
              )}
            </div>
            {can("task_create") && (
              <button className="add-event-row" onClick={() => setDialog("task")}>
                <Plus size={14} />
                Tạo nhiệm vụ
              </button>
            )}
          </section>
          <section id="sos" className="incident-detail-section">
            <SectionHeader
              title="Yêu cầu SOS liên quan"
              description={`${incidentSos.filter((item) => !["Đã đóng", "Từ chối", "Hủy"].includes(item.status)).length} yêu cầu đang mở`}
            />
            <div className="incident-task-list">
              {incidentSos.map((sos) => (
                <article key={sos.id}>
                  <div className="task-main">
                    <span>
                      <Badge
                        tone={
                          sos.priority.startsWith("P1")
                            ? "red"
                            : sos.priority.startsWith("P2")
                              ? "amber"
                              : "blue"
                        }
                      >
                        {sos.priority}
                      </Badge>
                      <small>{sos.id}</small>
                    </span>
                    <button
                      className="entity-link"
                      onClick={() => navigate(`/sos/${sos.id}`)}
                    >
                      {sos.location.name}
                      <ChevronRight size={13} />
                    </button>
                    <p>
                      {sos.peopleAtRisk} người nguy hiểm ·{" "}
                      {sos.verificationStatus}
                    </p>
                  </div>
                  <div className="task-assignee">
                    <small>Đội cứu hộ</small>
                    <b>{sos.assignedTeamId ?? "Chưa giao"}</b>
                    <span>{sos.linkedTaskId ?? "Chưa tạo nhiệm vụ"}</span>
                  </div>
                  <Badge
                    tone={
                      sos.status === "Đã đóng"
                        ? "green"
                        : sos.status === "Không liên lạc được"
                          ? "red"
                          : "blue"
                    }
                  >
                    {sos.status}
                  </Badge>
                </article>
              ))}
            </div>
          </section>
          <section id="doi-cuu-ho" className="incident-detail-section">
            <SectionHeader
              title="Đội đang xử lý"
              action={can("dispatch") ? "Điều phối đội khác" : undefined}
              onAction={() => setDialog("dispatch")}
            />
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
                  <Badge tone="blue">{team.status}</Badge>
                  <small>Cách hiện trường {team.distance}</small>
                </div>
                {can("dispatch") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDialog("dispatch")}
                  >
                    Thay đổi
                  </Button>
                )}
              </div>
            ) : (
              <div className="unassigned-team">
                <span>Chưa có đội phụ trách sự cố này.</span>
                {can("dispatch") && (
                  <Button size="sm" onClick={() => setDialog("dispatch")}>
                    Điều phối đội
                  </Button>
                )}
              </div>
            )}
          </section>
          <section
            id="ban-do"
            className="incident-detail-section incident-map-section"
          >
            <SectionHeader
              title="Khu vực ảnh hưởng"
              description="Vị trí sự cố, lực lượng, SOS, điểm sơ tán và tuyến tiếp cận"
            />
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <IncidentDetailMap incident={incident} team={team} />
            </Suspense>
          </section>
          <section id="bao-cao" className="incident-detail-section">
            <SectionHeader title="Báo cáo hiện trường" />
            <div className="field-report-list">
              <article>
                <FileText size={17} />
                <div>
                  <b>Báo cáo nhanh tình trạng ngập khu vực Tứ Liên</b>
                  <p>CH-01 · 10:26 · Báo cáo hiện trường</p>
                </div>
                <Badge tone="blue">Đã xác minh</Badge>
              </article>
              <article>
                <Route size={17} />
                <div>
                  <b>Cập nhật tuyến tiếp cận an toàn từ Nghi Tàm</b>
                  <p>CH-03 · 09:24 · Thông tin giao thông</p>
                </div>
                <Badge tone="green">Đang áp dụng</Badge>
              </article>
            </div>
          </section>
        </main>
        <aside className="incident-context-panel">
          <div className="context-heading">
            <span>Thông tin điều hành</span>
          </div>
          <dl>
            <Context label="Mức độ">
              <Badge tone={severityTone(incident.severity)}>
                {incident.severity}
              </Badge>
            </Context>
            <Context label="Trạng thái">
              <Badge tone={statusTone(incident.status)}>
                {incident.status}
              </Badge>
            </Context>
            <Context label="Khu vực" value={incident.location.name} />
            <Context label="Phạm vi ảnh hưởng" value={incident.affectedArea} />
            <Context label="Người phụ trách" value={incident.lead} />
            <Context
              label="Đội phụ trách"
              value={incident.assignedTeamId ?? "Chưa phân công"}
            />
            <Context
              label="Dân số ảnh hưởng"
              value={incident.affectedPopulation.toLocaleString("vi-VN")}
            />
            <Context label="Nguồn tiếp nhận" value={incident.source} />
            <Context label="Người tạo" value={incident.createdBy} />
            <Context label="Thời điểm tạo" value={incident.createdAt} />
            <Context label="Cập nhật gần nhất" value={incident.updatedAt} />
            {incident.closedAt && (
              <Context label="Thời điểm đóng" value={incident.closedAt} />
            )}
          </dl>
          <div className="context-progress">
            <span>
              <b>Tiến độ xử lý</b>
              <strong>{incident.progress}%</strong>
            </span>
            <Progress
              value={incident.progress}
              tone={incident.progress >= 80 ? "green" : "blue"}
            />
          </div>
          <div className="context-workflow">
            <span>Vòng đời xử lý</span>
            <div>
              <i className="done" />
              <b>Tiếp nhận</b>
            </div>
            <div>
              <i className="done" />
              <b>Đánh giá</b>
            </div>
            <div>
              <i className="current" />
              <b>{incident.status}</b>
            </div>
            <div>
              <i />
              <b>Đã đóng</b>
            </div>
          </div>
        </aside>
      </div>
      <IncidentActionDialogs
        mode={dialog}
        incident={incident}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
function Impact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
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
