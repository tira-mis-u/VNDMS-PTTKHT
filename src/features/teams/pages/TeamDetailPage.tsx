import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Settings2,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress, SectionHeader } from "@/components/ui";
import {
  TeamActionDialogs,
  type TeamDialog,
} from "../components/TeamActionDialogs";
const TeamOperationalMap = lazy(
  () => import("../components/TeamOperationalMap"),
);
const tone = (status: string) =>
  status === "Sẵn sàng"
    ? "green"
    : status === "Mất liên lạc" || status === "Không khả dụng"
      ? "red"
      : status === "Tạm nghỉ"
        ? "neutral"
        : status === "Đang điều động"
          ? "amber"
          : "blue";
export function TeamDetailPage({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const {
    teams,
    tasks,
    incidents,
    teamEvents,
    evacuationOperations,
    shelters,
    shipments,
    can,
  } = useOperationalState();
  const team = teams.find((item) => item.id === id);
  const [dialog, setDialog] = useState<TeamDialog>(null);
  const events = useMemo(
    () => teamEvents.filter((event) => event.teamId === id),
    [teamEvents, id],
  );
  if (!team)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <Users size={24} />
          <h2>Không tìm thấy đội cứu hộ</h2>
          <p>Mã đội không tồn tại hoặc không thuộc phạm vi truy cập.</p>
          <Button variant="secondary" onClick={() => navigate("/teams")}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  const task = tasks.find((item) => item.id === team.currentTask);
  const reliefShipment = shipments.find(
    (item) => item.id === team.currentReliefShipment,
  );
  const evacuation = evacuationOperations.find(
    (item) => item.id === team.currentEvacuationOperation,
  );
  const evacuationShelter = shelters.find(
    (item) => item.id === evacuation?.destinationShelterId,
  );
  const incident = incidents.find(
    (item) => item.id === (team.currentIncident ?? task?.incidentId),
  );
  const canDispatch =
    can("team_assign") &&
    !team.currentTask &&
    !team.currentEvacuationOperation &&
    !team.currentReliefShipment &&
    !["Mất liên lạc", "Không khả dụng", "Tạm nghỉ"].includes(team.status);
  return (
    <div className="workspace-content team-detail-page">
      <header className="team-detail-header">
        <button className="back-link" onClick={() => navigate("/teams")}>
          <ArrowLeft size={15} />
          Đội cứu hộ
        </button>
        <div className="incident-heading-row">
          <div>
            <div className="incident-code-line">
              <span>{team.code}</span>
              <Badge tone={tone(team.status)}>{team.status}</Badge>
              {team.communicationStatus === "Mất liên lạc" && (
                <Badge tone="red">Mất tín hiệu</Badge>
              )}
            </div>
            <h1>{team.name}</h1>
            <p>
              <MapPin size={13} />
              {team.region}
              <i />
              {team.type}
            </p>
          </div>
          <div className="incident-header-actions">
            <Button
              variant="secondary"
              onClick={() =>
                navigate(`/ai-assistant?context=Team&id=${team.id}`)
              }
            >
              <ShieldCheck size={15} />
              Trợ lý AI
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = `tel:${team.contact.replaceAll(" ", "")}`;
              }}
            >
              <Phone size={15} />
              Liên hệ
            </Button>
            {can("team_assign") && (
              <Button
                disabled={!canDispatch}
                onClick={() => setDialog("dispatch")}
              >
                <Navigation size={15} />
                Điều phối đội
              </Button>
            )}
            {can("team_update_status") && (
              <Button variant="secondary" onClick={() => setDialog("status")}>
                Cập nhật trạng thái
              </Button>
            )}
            {can("team_update_location") && (
              <Button variant="secondary" onClick={() => setDialog("location")}>
                Cập nhật vị trí
              </Button>
            )}
          </div>
        </div>
        <nav className="incident-detail-tabs">
          <button className="active">Tổng quan</button>
          <button>Nhiệm vụ hiện tại</button>
          <button>
            Nhân sự <span>{team.members}</span>
          </button>
          <button>Năng lực & phương tiện</button>
          <button>Vị trí</button>
          <button>
            Timeline <span>{events.length}</span>
          </button>
        </nav>
      </header>
      <div className="team-detail-layout">
        <main className="team-detail-main">
          <section className="incident-detail-section">
            <SectionHeader title="Trạng thái tác chiến" />
            <div className="team-readiness">
              <div
                className={`readiness-indicator status-${team.status.replaceAll(" ", "-").toLowerCase()}`}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <span>Trạng thái hiện tại</span>
                <h2>{team.status}</h2>
                <p>
                  {team.availability} · Liên lạc{" "}
                  {team.communicationStatus.toLowerCase()}
                </p>
              </div>
              <div className="team-readiness-meta">
                <span>
                  <b>{team.members}</b> thành viên
                </span>
                <span>
                  <b>
                    {
                      team.vehicles.filter((v) => v.status === "Sẵn sàng")
                        .length
                    }
                  </b>{" "}
                  phương tiện sẵn sàng
                </span>
              </div>
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Nhiệm vụ hiện tại"
              description="Quan hệ hai chiều giữa đội, nhiệm vụ và sự cố"
            />
            {task ? (
              <div className="team-current-operation">
                <div className="operation-main">
                  <span>
                    <Badge
                      tone={task.priority === "Khẩn cấp" ? "red" : "amber"}
                    >
                      {task.priority}
                    </Badge>
                    <small>{task.id}</small>
                  </span>
                  <button onClick={() => navigate(`/tasks/${task.id}`)}>
                    {task.title}
                    <ChevronRight size={14} />
                  </button>
                  <p>
                    <MapPin size={12} />
                    {task.location}
                  </p>
                </div>
                <div className="operation-progress">
                  <span>
                    <b>{task.progress}%</b>
                    {task.status}
                  </span>
                  <Progress
                    value={task.progress}
                    tone={task.progress === 100 ? "green" : "blue"}
                  />
                  <small>Hạn {task.dueAt}</small>
                </div>
                {incident && (
                  <button
                    className="linked-incident"
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                  >
                    <span>Sự cố liên quan</span>
                    <b>{incident.id}</b>
                    <small>{incident.title}</small>
                    <ChevronRight size={14} />
                  </button>
                )}
                {can("team_assign") &&
                  ["Chờ giao", "Đã giao"].includes(task.status) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDialog("release")}
                    >
                      Gỡ phân công
                    </Button>
                  )}
              </div>
            ) : evacuation ? (
              <div className="team-current-operation">
                <div className="operation-main">
                  <span>
                    <Badge
                      tone={
                        evacuation.priority === "Khẩn cấp" ? "red" : "amber"
                      }
                    >
                      {evacuation.priority}
                    </Badge>
                    <small>{evacuation.id}</small>
                  </span>
                  <button
                    onClick={() =>
                      navigate(`/shelters/${evacuation.destinationShelterId}`)
                    }
                  >
                    Sơ tán {evacuation.sourceArea}
                    <ChevronRight size={14} />
                  </button>
                  <p>
                    <MapPin size={12} />
                    {evacuationShelter?.name}
                  </p>
                </div>
                <div className="operation-progress">
                  <span>
                    <b>{evacuation.progress}%</b>
                    {evacuation.status}
                  </span>
                  <Progress value={evacuation.progress} tone="blue" />
                  <small>
                    {evacuation.evacuatedPopulation}/
                    {evacuation.estimatedPopulation} người
                  </small>
                </div>
              </div>
            ) : reliefShipment ? (
              <div className="team-current-operation">
                <div className="operation-main">
                  <span>
                    <Badge
                      tone={
                        reliefShipment.status === "Có sự cố" ? "red" : "blue"
                      }
                    >
                      {reliefShipment.status}
                    </Badge>
                    <small>{reliefShipment.id}</small>
                  </span>
                  <button
                    onClick={() =>
                      navigate(
                        `/relief/requests/${reliefShipment.reliefRequestId}`,
                      )
                    }
                  >
                    Vận chuyển cứu trợ tới {reliefShipment.destination}
                    <ChevronRight size={14} />
                  </button>
                  <p>
                    <MapPin size={12} />
                    {reliefShipment.items
                      .map(
                        (item) => `${item.quantity} ${item.unit} ${item.name}`,
                      )
                      .join(" · ")}
                  </p>
                </div>
                <div className="operation-progress">
                  <span>
                    <b>Hậu cần</b>
                    {reliefShipment.transportMethod}
                  </span>
                  <small>Dự kiến đến {reliefShipment.estimatedArrival}</small>
                </div>
              </div>
            ) : (
              <div className="team-no-assignment">
                <ShieldCheck size={19} />
                <div>
                  <b>Đội chưa có nhiệm vụ đang mở</b>
                  <p>Có thể điều phối đội tới nhiệm vụ phù hợp với năng lực.</p>
                </div>
                {canDispatch && (
                  <Button size="sm" onClick={() => setDialog("dispatch")}>
                    Điều phối đội
                  </Button>
                )}
              </div>
            )}
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Nhân sự đội"
              description="Thông tin tối thiểu phục vụ điều phối lực lượng"
            />
            <div className="team-member-table">
              <div className="team-member-head">
                <span>Thành viên</span>
                <span>Vai trò</span>
                <span>Chuyên môn</span>
                <span>Trạng thái</span>
                <span>Liên lạc</span>
              </div>
              {team.personnel.map((person) => (
                <div className="team-member-row" key={person.id}>
                  <span>
                    <span className="member-avatar">
                      <UserRound size={14} />
                    </span>
                    <b>{person.name}</b>
                  </span>
                  <span>{person.role}</span>
                  <span>
                    {person.responsibility ?? person.specialty}
                    <small>{person.responsibility && person.specialty}</small>
                  </span>
                  <span>
                    <Badge
                      tone={
                        person.status === "Sẵn sàng"
                          ? "green"
                          : person.status === "Tạm nghỉ"
                            ? "neutral"
                            : "blue"
                      }
                    >
                      {person.status}
                    </Badge>
                  </span>
                  <span>
                    <Phone size={12} />
                    {person.contact}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Năng lực và phương tiện" />
            <div className="team-assets">
              <div className="team-capabilities">
                <h3>
                  Năng lực nghiệp vụ
                  {can("team_edit") && (
                    <button onClick={() => setDialog("capabilities")}>
                      Cập nhật
                    </button>
                  )}
                </h3>
                <div>
                  {team.capabilities.map((item) => (
                    <span key={item}>
                      <ShieldCheck size={13} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="team-vehicles">
                <h3>Phương tiện, thiết bị</h3>
                {team.vehicles.map((vehicle) => (
                  <article key={vehicle.id}>
                    <span className="vehicle-icon">
                      <Truck size={15} />
                    </span>
                    <div>
                      <b>{vehicle.name}</b>
                      <small>
                        {vehicle.id} · {vehicle.type}
                      </small>
                    </div>
                    <Badge
                      tone={
                        vehicle.status === "Sẵn sàng"
                          ? "green"
                          : vehicle.status === "Không khả dụng"
                            ? "red"
                            : vehicle.status === "Bảo dưỡng"
                              ? "amber"
                              : "blue"
                      }
                    >
                      {vehicle.status}
                    </Badge>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Vị trí tác nghiệp"
              description="Bản ghi GPS gần nhất và các đối tượng liên quan"
              action="Cập nhật vị trí"
            />
            <div className="gps-status-bar">
              <div>
                <Radio size={15} />
                <span>
                  <small>Vị trí cập nhật</small>
                  <b>{team.lastLocationUpdate}</b>
                </span>
              </div>
              <div>
                <span>
                  <small>Độ chính xác</small>
                  <b>±{team.location.accuracy} m</b>
                </span>
              </div>
              <div>
                <span>
                  <small>Nguồn</small>
                  <b>{team.location.source}</b>
                </span>
              </div>
              <Badge
                tone={team.communicationStatus === "Kết nối" ? "green" : "red"}
              >
                {team.communicationStatus}
              </Badge>
            </div>
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <TeamOperationalMap
                team={team}
                allTeams={teams}
                task={task}
                incident={incident}
              />
            </Suspense>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Timeline hoạt động"
              description="Điều phối, trạng thái, vị trí và cập nhật hiện trường"
            />
            <div className="incident-timeline team-timeline">
              {events.map((event) => (
                <article key={event.id}>
                  <time>{event.timestamp}</time>
                  <span className={`event-marker event-${event.type}`}>
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
              {!events.length && (
                <p className="section-empty">
                  Chưa có hoạt động được ghi nhận.
                </p>
              )}
            </div>
          </section>
        </main>
        <aside className="incident-context-panel team-context">
          <div className="context-heading">
            <span>Hồ sơ lực lượng</span>
            {can("team_edit") && (
              <button onClick={() => setDialog("edit")}>
                <Settings2 size={13} />
                Chỉnh sửa
              </button>
            )}
          </div>
          <dl>
            <Context label="Mã đội" value={team.code} />
            <Context label="Loại đội" value={team.type} />
            <Context label="Trạng thái">
              <Badge tone={tone(team.status)}>{team.status}</Badge>
            </Context>
            <Context label="Khả dụng" value={team.availability} />
            <Context label="Đội trưởng" value={team.leader} />
            <Context label="Khu vực" value={team.region} />
            <Context label="Phạm vi" value={team.operatingScope} />
            <Context label="Liên lạc" value={team.contact} />
            <Context label="Năng lực chính" value={team.capability} />
            <Context label="Nhiệm vụ" value={team.currentTask ?? "Chưa có"} />
            <Context
              label="Hoạt động sơ tán"
              value={team.currentEvacuationOperation ?? "Chưa có"}
            />
            <Context label="Sự cố" value={team.currentIncident ?? "Chưa có"} />
            <Context
              label="Cập nhật tác chiến"
              value={team.lastOperationalUpdate}
            />
            <Context label="Cập nhật vị trí" value={team.lastLocationUpdate} />
            <Context label="Nguồn vị trí" value={team.location.source} />
            <Context
              label="Độ chính xác"
              value={`±${team.location.accuracy} m`}
            />
          </dl>
          <div className="team-notes">
            <b>Ghi chú vận hành</b>
            <p>{team.notes}</p>
          </div>
          <div className="team-communication-panel">
            <Clock3 size={15} />
            <div>
              <b>{team.communicationStatus}</b>
              <span>Cập nhật cuối {team.location.timestamp}</span>
            </div>
          </div>
        </aside>
      </div>
      <TeamActionDialogs
        mode={dialog}
        team={team}
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
