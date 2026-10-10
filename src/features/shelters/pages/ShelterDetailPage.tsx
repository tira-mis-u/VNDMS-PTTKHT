import { lazy, Suspense, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronRight,
  Droplets,
  HeartPulse,
  MapPin,
  MapPinned,
  Navigation,
  Phone,
  PlugZap,
  ShieldCheck,
  Users,
  Utensils,
  Waves,
} from "lucide-react";
import { calculateShelterCapacity } from "@/domain/shelters/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress, SectionHeader, DetailMapWeather } from "@/components/ui";
import { operationalMapFocusPath } from "@/app/routes/router";
import {
  ShelterActionDialogs,
  type ShelterDialog,
} from "../components/ShelterActionDialogs";
const ShelterOperationalMap = lazy(
  () => import("../components/ShelterOperationalMap"),
);
const tone = (status: string) =>
  status === "Quá tải" || status === "Không thể tiếp cận"
    ? "red"
    : status === "Gần đầy"
      ? "amber"
      : status === "Sẵn sàng"
        ? "green"
        : status === "Tạm đóng"
          ? "neutral"
          : "blue";
export function ShelterDetailPage({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const {
    shelters,
    shelterEvents,
    incidents,
    teams,
    sosRequests,
    can,
    setShelterOpen,
  } = useOperationalState();
  const shelter = shelters.find((item) => item.id === id);
  const [dialog, setDialog] = useState<ShelterDialog>(null);
  if (!shelter)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <Building2 size={24} />
          <h2>Không tìm thấy điểm sơ tán</h2>
          <p>Mã điểm không tồn tại hoặc không thuộc phạm vi truy cập.</p>
          <Button variant="secondary" onClick={() => navigate("/shelters")}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  const capacity = calculateShelterCapacity(shelter);
  // SOS đang được hướng tới điểm này (canonical: SosRequest.shelterDestinationId).
  const routedSos = sosRequests.filter(
    (item) =>
      item.shelterDestinationId === id &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(item.status),
  );
  const linkedIncidents = incidents.filter((item) =>
    shelter.linkedIncidentIds.includes(item.id),
  );
  const linkedTeams = teams.filter((team) =>
    routedSos.some((item) => item.assignedTeamId === team.id),
  );
  const events = shelterEvents
    .filter((event) => event.shelterId === id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const openDialog = (mode: ShelterDialog) => setDialog(mode);
  return (
    <div className="workspace-content shelter-detail-page">
      <header className="shelter-detail-header">
        <button className="back-link" onClick={() => navigate("/shelters")}>
          <ArrowLeft size={15} />
          Điểm sơ tán
        </button>
        <div className="incident-heading-row">
          <div>
            <div className="incident-code-line">
              <span>{shelter.code}</span>
              <Badge tone={tone(shelter.status)}>{shelter.status}</Badge>
              <Badge
                tone={
                  shelter.readiness === "Sẵn sàng"
                    ? "green"
                    : shelter.readiness === "Hạn chế"
                      ? "amber"
                      : "red"
                }
              >
                {shelter.readiness}
              </Badge>
            </div>
            <h1>{shelter.name}</h1>
            <p>
              <MapPin size={13} />
              {shelter.address}
              <i />
              {shelter.type}
            </p>
          </div>
          <div className="incident-header-actions">
            <Button
              variant="secondary"
              onClick={() => navigate(operationalMapFocusPath(shelter.id))}
            >
              <MapPinned size={15} />
              Xem trên bản đồ
            </Button>
            {can("shelter_update") && (
              <Button
                variant="secondary"
                onClick={() => openDialog("occupancy")}
              >
                Cập nhật tiếp nhận
              </Button>
            )}
            {can("shelter_open") && shelter.status === "Tạm đóng" && (
              <Button
                variant="secondary"
                onClick={() => setShelterOpen(shelter.id, true)}
              >
                Mở điểm
              </Button>
            )}
            {can("shelter_close") && shelter.status !== "Tạm đóng" && (
              <Button
                variant="secondary"
                disabled={Boolean(routedSos.length)}
                onClick={() => setShelterOpen(shelter.id, false)}
              >
                Tạm đóng
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="shelter-detail-layout">
        <main className="shelter-detail-main">
          <section className="incident-detail-section shelter-capacity-section">
            <SectionHeader title="Sức chứa và tình trạng tiếp nhận" />
            <div className="capacity-overview">
              <div>
                <span>Sức chứa</span>
                <b>{shelter.capacity}</b>
                <small>người</small>
              </div>
              <div>
                <span>Đang tiếp nhận</span>
                <b>{shelter.currentOccupancy}</b>
                <small>người</small>
              </div>
              <div>
                <span>Đang dự phòng</span>
                <b>{shelter.reservedCapacity}</b>
                <small>chỗ</small>
              </div>
              <div className={capacity.availableCapacity === 0 ? "danger" : ""}>
                <span>Khả dụng</span>
                <b>{capacity.availableCapacity}</b>
                <small>chỗ</small>
              </div>
              <div>
                <span>Tỷ lệ sử dụng</span>
                <b>{capacity.occupancyPercentage}%</b>
                <Progress
                  value={Math.min(100, capacity.occupancyPercentage)}
                  tone={
                    capacity.isOverloaded || capacity.isNearCapacity
                      ? "amber"
                      : "blue"
                  }
                />
              </div>
            </div>
            {capacity.isOverloaded && (
              <div className="shelter-alert">
                <AlertTriangle size={16} />
                <span>
                  <b>Điểm sơ tán đang quá tải</b>Cần chuyển hướng người sơ tán
                  tới điểm còn sức chứa.
                </span>
              </div>
            )}
            <div className="section-inline-actions">
              {can("shelter_manage_capacity") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openDialog("capacity")}
                >
                  Cập nhật sức chứa
                </Button>
              )}
              {can("shelter_update") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openDialog("resources")}
                >
                  Cập nhật điều kiện vận hành
                </Button>
              )}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Điều kiện vận hành"
              description="Mức sẵn sàng, khả năng tiếp cận và nguồn lực thiết yếu"
            />
            <div className="shelter-readiness-grid">
              <Condition
                icon={<ShieldCheck size={16} />}
                label="Mức sẵn sàng"
                value={shelter.readiness}
              />
              <Condition
                icon={<Navigation size={16} />}
                label="Tiếp cận"
                value={shelter.accessibility}
              />
              <Condition
                icon={<HeartPulse size={16} />}
                label="Y tế"
                value={shelter.medicalCapability}
              />
              <Condition
                icon={<Droplets size={16} />}
                label="Nước sạch"
                value={shelter.waterAvailability}
              />
              <Condition
                icon={<Utensils size={16} />}
                label="Lương thực"
                value={shelter.foodAvailability}
              />
              <Condition
                icon={<PlugZap size={16} />}
                label="Nguồn điện"
                value={shelter.powerAvailability}
              />
              <Condition
                icon={<Waves size={16} />}
                label="Vệ sinh"
                value={shelter.sanitationStatus}
              />
              <Condition
                icon={<Users size={16} />}
                label="Người yếu thế"
                value={
                  shelter.accessibleForVulnerablePeople
                    ? "Có hỗ trợ tiếp cận"
                    : "Chưa đáp ứng đầy đủ"
                }
              />
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="SOS đang hướng tới điểm"
              description={`${routedSos.length} yêu cầu SOS được điều phối tới điểm này`}
            />
            <div className="linked-request-list">
              {routedSos.map((request) => (
                <button
                  key={request.id}
                  onClick={() => navigate(`/sos/${request.id}`)}
                >
                  <span>
                    <b>
                      {request.code} · {request.location.name}
                    </b>
                    <small>
                      {request.peopleAtRisk} người · {request.priority} ·{" "}
                      {request.assignedTeamId
                        ? `Đội ${request.assignedTeamId}`
                        : "Chưa phân công đội"}
                    </small>
                  </span>
                  <Badge
                    tone={
                      request.status === "Đã xử lý"
                        ? "green"
                        : request.status === "Đang cứu hộ"
                          ? "blue"
                          : "amber"
                    }
                  >
                    {request.status}
                  </Badge>
                </button>
              ))}
              {!routedSos.length && (
                <p className="section-empty">
                  Chưa có SOS nào được điều phối tới điểm này.
                </p>
              )}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Nguồn lực tại điểm" />
            <div className="shelter-facility-table">
              <div>
                <span>Hạng mục</span>
                <span>Nhóm</span>
                <span>Số lượng</span>
                <span>Trạng thái</span>
              </div>
              {shelter.facilities.map((item) => (
                <div key={item.id}>
                  <span>
                    <b>{item.name}</b>
                    <small>{item.id}</small>
                  </span>
                  <span>{item.category}</span>
                  <span>{item.quantity}</span>
                  <span>
                    <Badge
                      tone={
                        item.status === "Sẵn sàng"
                          ? "green"
                          : item.status === "Hạn chế"
                            ? "amber"
                            : "red"
                      }
                    >
                      {item.status}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Bản đồ tác nghiệp"
              description={
                <>
                  Điểm sơ tán, sự cố liên quan và đội cứu hộ đang điều phối ·
                  Bản đồ số NDAMapVN
                  <DetailMapWeather center={shelter.coordinates} />
                </>
              }
            />
            <Suspense
              fallback={
                <div className="incident-map-fallback">
                  <span className="spinner" />
                  Đang khởi tạo bản đồ…
                </div>
              }
            >
              <ShelterOperationalMap
                shelter={shelter}
                shelters={shelters}
                incidents={linkedIncidents}
                teams={linkedTeams}
              />
            </Suspense>
          </section>
          <section className="incident-detail-section">
            <SectionHeader title="Nhật ký vận hành" />
            <div className="incident-timeline shelter-timeline">
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
        </main>
        <aside className="incident-context-panel shelter-context">
          <div className="context-heading">
            <span>Hồ sơ điểm sơ tán</span>
          </div>
          <dl>
            <Context label="Mã điểm" value={shelter.code} />
            <Context label="Loại cơ sở" value={shelter.type} />
            <Context label="Khu vực" value={shelter.administrativeArea} />
            <Context
              label="Phụ trách"
              value={shelter.responsibleOfficer.name}
            />
            <Context
              label="Đơn vị"
              value={shelter.responsibleOfficer.organization}
            />
            <Context label="Liên hệ" value={shelter.responsibleOfficer.phone} />
            <Context label="Mở lúc" value={shelter.openingTime ?? "Chưa mở"} />
            <Context label="Cập nhật cuối" value={shelter.updatedAt} />
          </dl>
          <div className="shelter-contact">
            <Phone size={15} />
            <div>
              <b>{shelter.contact}</b>
              <span>Đầu mối tiếp nhận tại điểm</span>
            </div>
          </div>
          <div className="shelter-linked">
            <h3>Sự cố liên quan</h3>
            {linkedIncidents.map((incident) => (
              <button
                key={incident.id}
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                <span>
                  <b>{incident.id}</b>
                  <small>{incident.title}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="team-notes">
            <b>Ghi chú vận hành</b>
            <p>{shelter.notes}</p>
          </div>
        </aside>
      </div>
      <ShelterActionDialogs
        mode={dialog}
        shelter={shelter}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
function Condition({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}
function Context({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
