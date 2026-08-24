import { lazy, Suspense, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronRight,
  MapPin,
  MapPinned,
  Navigation,
  Phone,
  Radio,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress, SectionHeader } from "@/components/ui";
import { operationalMapFocusPath } from "@/app/routes/router";
import {
  SosActionDialogs,
  type SosDialog,
} from "../components/SosActionDialogs";
const SosOperationalMap = lazy(() => import("../components/SosOperationalMap"));
const priorityTone = (priority: string) =>
  priority.startsWith("P1")
    ? "red"
    : priority.startsWith("P2")
      ? "amber"
      : priority.startsWith("P3")
        ? "blue"
        : "neutral";
const statusTone = (status: string) =>
  status === "Đã đóng" || status === "Đã xử lý"
    ? "green"
    : status === "Từ chối" || status === "Hủy"
      ? "neutral"
      : status === "Không liên lạc được"
        ? "red"
        : "blue";
export function SosDetailPage({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const {
    sosRequests,
    sosEvents,
    incidents,
    tasks,
    teams,
    shelters,
    evacuationOperations,
    can,
  } = useOperationalState();
  const sos = sosRequests.find((item) => item.id === id);
  const [dialog, setDialog] = useState<SosDialog>(null);
  if (!sos)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <Radio size={24} />
          <h2>Không tìm thấy yêu cầu SOS</h2>
          <p>Mã yêu cầu không tồn tại hoặc ngoài phạm vi truy cập.</p>
          <Button variant="secondary" onClick={() => navigate("/sos")}>
            Quay lại hàng đợi
          </Button>
        </div>
      </div>
    );
  const incident = incidents.find((item) => item.id === sos.linkedIncidentId);
  const task = tasks.find((item) => item.id === sos.linkedTaskId);
  const team = teams.find((item) => item.id === sos.assignedTeamId);
  const shelter = shelters.find((item) => item.id === sos.shelterDestinationId);
  const evacuation = evacuationOperations.find(
    (item) => item.id === sos.linkedEvacuationOperationId,
  );
  const events = sosEvents
    .filter((item) => item.sosId === id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const vulnerable = sos.childrenCount + sos.elderlyCount + sos.disabledCount;
  return (
    <div className="workspace-content sos-detail-page">
      <header className="sos-detail-header">
        <button className="back-link" onClick={() => navigate("/sos")}>
          <ArrowLeft size={15} />
          Hàng đợi SOS
        </button>
        <div className="incident-heading-row">
          <div>
            <div className="incident-code-line">
              <span>{sos.code}</span>
              <Badge tone={priorityTone(sos.priority)}>{sos.priority}</Badge>
              <Badge tone={statusTone(sos.status)}>{sos.status}</Badge>
            </div>
            <h1>{sos.location.name}</h1>
            <p>
              <MapPin size={13} />
              {sos.location.address}
              <i />
              Tiếp nhận {sos.receivedAt}
            </p>
          </div>
          <div className="incident-header-actions">
            <Button
              variant="secondary"
              onClick={() => navigate(operationalMapFocusPath(sos.id))}
            >
              <MapPinned size={15} />
              Xem trên bản đồ
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/ai-assistant?context=SOS&id=${sos.id}`)}
            >
              <ShieldCheck size={15} />
              Trợ lý AI
            </Button>
            {can("sos_verify") &&
              ["Mới tiếp nhận", "Đang xác minh"].includes(sos.status) && (
                <Button onClick={() => setDialog("verify")}>
                  <ShieldCheck size={15} />
                  Xác minh SOS
                </Button>
              )}
            {can("sos_create_task") &&
              sos.verificationStatus === "Đã xác minh" &&
              !sos.linkedTaskId && (
                <Button onClick={() => setDialog("task")}>
                  <Navigation size={15} />
                  Điều phối cứu hộ
                </Button>
              )}
            {can("sos_resolve") &&
              ["Đã điều phối", "Đang cứu hộ"].includes(sos.status) && (
                <Button onClick={() => setDialog("resolve")}>
                  Đánh dấu đã xử lý
                </Button>
              )}
            {can("sos_close") && sos.status === "Đã xử lý" && (
              <Button onClick={() => setDialog("close")}>Đóng SOS</Button>
            )}
            <Button variant="secondary" onClick={() => setDialog("update")}>
              Thêm diễn biến
            </Button>
          </div>
        </div>
      </header>
      <div className="sos-detail-layout">
        <main className="sos-detail-main">
          <section className="incident-detail-section sos-emergency">
            <div className="sos-emergency-heading">
              <span
                className={`priority-block ${sos.priority.slice(0, 2).toLowerCase()}`}
              >
                {sos.priority.slice(0, 2)}
              </span>
              <div>
                <small>Yêu cầu khẩn cấp</small>
                <h2>{sos.description}</h2>
                <p>
                  <b>{sos.peopleAtRisk} người gặp nguy hiểm</b> ·{" "}
                  {sos.injuredCount} bị thương · {sos.missingCount} mất tích ·{" "}
                  {vulnerable} người dễ bị tổn thương
                </p>
              </div>
            </div>
            <div className="sos-immediate-grid">
              <Info label="Tiếp cận" value={sos.location.accessCondition} />
              <Info label="Ngập" value={sos.location.floodDepth} />
              <Info label="Liên lạc" value={sos.communicationStatus} />
              <Info label="Liên hệ cuối" value={sos.lastContactAt} />
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Đánh giá mức độ và phân loại ưu tiên"
              description="Ưu tiên có giải thích từ các yếu tố nguy cơ minh bạch"
            />
            <div className="triage-panel">
              <div>
                <Badge tone={priorityTone(sos.priority)}>{sos.priority}</Badge>
                <span>{sos.severity}</span>
              </div>
              <ul>
                {sos.triageReasons.map((reason) => (
                  <li key={reason}>
                    <AlertTriangle size={13} />
                    {reason}
                  </li>
                ))}
              </ul>
              {can("sos_triage") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog("priority")}
                >
                  Cập nhật ưu tiên
                </Button>
              )}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Người yêu cầu và xác minh" />
            <div className="sos-reporter-grid">
              <Info label="Người báo" value={sos.reporter.name} />
              <Info label="Nguồn tin" value={sos.reporter.source} />
              <Info label="Liên hệ" value={sos.reporter.contact} />
              <Info label="Xác minh" value={sos.verificationStatus} />
              <Info
                label="Trạng thái liên lạc"
                value={sos.communicationStatus}
              />
              <Info label="Cập nhật cuối" value={sos.lastUpdatedAt} />
            </div>
            <div className="section-inline-actions">
              {can("sos_verify") &&
                [
                  "Mới tiếp nhận",
                  "Đang xác minh",
                  "Không liên lạc được",
                ].includes(sos.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDialog("reject")}
                  >
                    Từ chối SOS
                  </Button>
                )}
              {can("sos_update") &&
                [
                  "Mới tiếp nhận",
                  "Đang xác minh",
                  "Đã xác minh",
                  "Đã điều phối",
                  "Đang cứu hộ",
                ].includes(sos.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDialog("no-contact")}
                  >
                    Không liên lạc được
                  </Button>
                )}
              {can("sos_update_field") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog("location")}
                >
                  Cập nhật vị trí
                </Button>
              )}
              {can("sos_cancel") &&
                [
                  "Mới tiếp nhận",
                  "Đang xác minh",
                  "Đã xác minh",
                  "Đã điều phối",
                ].includes(sos.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDialog("cancel")}
                  >
                    Hủy yêu cầu
                  </Button>
                )}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Người bị ảnh hưởng" />
            <div className="affected-people-grid">
              <People label="Tổng số gặp nguy hiểm" value={sos.peopleAtRisk} />
              <People label="Bị thương" value={sos.injuredCount} />
              <People label="Mất tích" value={sos.missingCount} />
              <People label="Trẻ em" value={sos.childrenCount} />
              <People label="Người cao tuổi" value={sos.elderlyCount} />
              <People label="Người khuyết tật" value={sos.disabledCount} />
            </div>
            {sos.affectedPeople.length > 0 && (
              <div className="sos-affected-list">
                {sos.affectedPeople.map((person) => (
                  <div key={person.id}>
                    <span>
                      <b>{person.name}</b>
                      <small>
                        {person.id}
                        {person.vulnerableGroup
                          ? ` · ${person.vulnerableGroup}`
                          : ""}
                      </small>
                    </span>
                    <Badge
                      tone={
                        person.condition === "Đã an toàn"
                          ? "green"
                          : person.condition === "Bị thương"
                            ? "red"
                            : "amber"
                      }
                    >
                      {person.condition}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Liên kết tác nghiệp"
              description="Sự cố → Nhiệm vụ → Đội cứu hộ → Điểm sơ tán/Hoạt động sơ tán"
            />
            <div className="sos-link-grid">
              <Entity
                icon={<Siren size={17} />}
                label="Sự cố"
                id={incident?.id}
                title={incident?.title}
                action={
                  can("sos_assign_incident") && !incident
                    ? () => setDialog("incident")
                    : incident
                      ? () => navigate(`/incidents/${incident.id}`)
                      : undefined
                }
              />
              <Entity
                icon={<Navigation size={17} />}
                label="Nhiệm vụ cứu hộ"
                id={task?.id}
                title={task ? `${task.status} · ${task.progress}%` : undefined}
                action={task ? () => navigate(`/tasks/${task.id}`) : undefined}
              />
              <Entity
                icon={<ShieldCheck size={17} />}
                label="Đội cứu hộ"
                id={team?.id}
                title={team ? `${team.name} · ${team.status}` : undefined}
                action={team ? () => navigate(`/teams/${team.id}`) : undefined}
              />
              <Entity
                icon={<Building2 size={17} />}
                label="Điểm sơ tán"
                id={shelter?.id}
                title={shelter?.name}
                action={
                  shelter
                    ? () => navigate(`/shelters/${shelter.id}`)
                    : can("evacuation_create") && incident
                      ? () => setDialog("shelter")
                      : undefined
                }
              />
            </div>
            {evacuation && (
              <div className="sos-evacuation-strip">
                <span>
                  <b>{evacuation.id}</b>
                  {evacuation.status}
                </span>
                <span>
                  {evacuation.evacuatedPopulation}/
                  {evacuation.estimatedPopulation} người
                </span>
                <Progress value={evacuation.progress} tone="blue" />
                <small>
                  {evacuation.route.status} · {evacuation.route.name}
                </small>
              </div>
            )}
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Bản đồ tác nghiệp"
              description="SOS, sự cố, nhiệm vụ, đội cứu hộ, điểm sơ tán và tuyến liên quan"
            />
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <SosOperationalMap
                sos={sos}
                incident={incident}
                task={task}
                team={team}
                shelter={shelter}
                evacuation={evacuation}
                navigate={navigate}
              />
            </Suspense>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Diễn biến xử lý" />
            <div className="incident-timeline sos-timeline">
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
            </div>
          </section>
          {sos.resolutionSummary && (
            <section className="incident-detail-section">
              <SectionHeader title="Kết quả xử lý" />
              <div className="resolution-panel">
                <ShieldCheck size={19} />
                <div>
                  <b>{sos.resolutionSummary}</b>
                  <p>
                    Trạng thái: {sos.status}
                    {sos.closedAt ? ` · Đóng lúc ${sos.closedAt}` : ""}
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>
        <aside className="incident-context-panel sos-context">
          <div className="context-heading">
            <span>Thông tin SOS</span>
          </div>
          <dl>
            <Context label="Mã yêu cầu" value={sos.code} />
            <Context label="Ưu tiên">
              <Badge tone={priorityTone(sos.priority)}>{sos.priority}</Badge>
            </Context>
            <Context label="Trạng thái">
              <Badge tone={statusTone(sos.status)}>{sos.status}</Badge>
            </Context>
            <Context label="Khu vực" value={sos.location.administrativeArea} />
            <Context
              label="Sự cố"
              value={sos.linkedIncidentId ?? "Chưa liên kết"}
            />
            <Context label="Nhiệm vụ" value={sos.linkedTaskId ?? "Chưa tạo"} />
            <Context
              label="Đội cứu hộ"
              value={sos.assignedTeamId ?? "Chưa giao"}
            />
            <Context
              label="Điểm sơ tán"
              value={sos.shelterDestinationId ?? "Chưa chỉ định"}
            />
          </dl>
          <div className="sos-contact">
            <Phone size={15} />
            <div>
              <b>{sos.reporter.contact}</b>
              <span>
                {sos.reporter.name} · {sos.communicationStatus}
              </span>
            </div>
          </div>
          <div className="sos-location-note">
            <MapPin size={15} />
            <div>
              <b>{sos.location.address}</b>
              <span>
                {sos.location.coordinates[1].toFixed(5)},{" "}
                {sos.location.coordinates[0].toFixed(5)}
              </span>
            </div>
          </div>
        </aside>
      </div>
      <SosActionDialogs
        mode={dialog}
        sos={sos}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function People({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <Users size={15} />
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </div>
  );
}
function Entity({
  icon,
  label,
  id,
  title,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  id?: string;
  title?: string;
  action?: () => void;
}) {
  return (
    <button disabled={!action} onClick={action}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{id ?? "Chưa liên kết"}</b>
        <p>{title ?? (action ? "Thực hiện liên kết" : "Chưa có dữ liệu")}</p>
      </div>
      {action && <ChevronRight size={14} />}
    </button>
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
