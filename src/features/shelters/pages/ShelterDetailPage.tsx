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
import type { EvacuationOperation } from "@/domain/evacuations/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress, SectionHeader } from "@/components/ui";
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
    evacuationOperations,
    evacuationEvents,
    incidents,
    teams,
    reliefRequests,
    reservations,
    can,
    setShelterOpen,
  } = useOperationalState();
  const shelter = shelters.find((item) => item.id === id);
  const [dialog, setDialog] = useState<ShelterDialog>(null);
  const [selectedOperation, setSelectedOperation] = useState<
    EvacuationOperation | undefined
  >();
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
  const shelterRelief = reliefRequests.filter(
    (item) =>
      item.shelterId === id &&
      !["Đã đóng", "Từ chối", "Hủy"].includes(item.status),
  );
  const capacity = calculateShelterCapacity(shelter);
  const operations = evacuationOperations.filter(
    (item) => item.destinationShelterId === id,
  );
  const active = operations.filter(
    (item) => !["Hoàn thành", "Đã hủy"].includes(item.status),
  );
  const linkedIncidents = incidents.filter((item) =>
    shelter.linkedIncidentIds.includes(item.id),
  );
  const linkedTeams = teams.filter((team) =>
    operations.some((operation) => operation.assignedTeamId === team.id),
  );
  const events = [
    ...shelterEvents
      .filter((event) => event.shelterId === id)
      .map((event) => ({ ...event, kind: "shelter" })),
    ...evacuationEvents
      .filter((event) =>
        operations.some((operation) => operation.id === event.operationId),
      )
      .map((event) => ({ ...event, shelterId: id, kind: "evacuation" })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const openDialog = (mode: ShelterDialog, operation?: EvacuationOperation) => {
    setSelectedOperation(operation);
    setDialog(mode);
  };
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
            <Button
              variant="secondary"
              onClick={() =>
                navigate(`/ai-assistant?context=Shelter&id=${shelter.id}`)
              }
            >
              <ShieldCheck size={15} />
              Trợ lý AI
            </Button>
            {can("evacuation_create") && (
              <Button onClick={() => openDialog("create-evacuation")}>
                <Navigation size={15} />
                Điều phối dân cư
              </Button>
            )}
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
                disabled={Boolean(active.length)}
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
                  Cập nhật nguồn lực
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
              title="Hoạt động sơ tán"
              description="Dân cư, tiến độ, đội phụ trách và tuyến tiếp cận"
            />
            <div className="evacuation-list">
              {operations.map((operation) => (
                <article
                  key={operation.id}
                  className={
                    operation.route.status === "Bị chặn" ? "route-blocked" : ""
                  }
                >
                  <div className="evacuation-heading">
                    <span>
                      <b>{operation.id}</b>
                      <Badge
                        tone={
                          operation.status === "Tạm dừng"
                            ? "amber"
                            : operation.status === "Hoàn thành"
                              ? "green"
                              : operation.status === "Đang triển khai"
                                ? "blue"
                                : "neutral"
                        }
                      >
                        {operation.status}
                      </Badge>
                      <Badge
                        tone={
                          operation.priority === "Khẩn cấp" ? "red" : "amber"
                        }
                      >
                        {operation.priority}
                      </Badge>
                    </span>
                    <div>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Mở chi tiết hoạt động sơ tán"
                        onClick={() => navigate(`/evacuations/${operation.id}`)}
                      >
                        Chi tiết
                      </Button>
                      {can("evacuation_update") && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openDialog("operation", operation)}
                        >
                          Cập nhật
                        </Button>
                      )}
                      {can("evacuation_update") && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openDialog("redirect", operation)}
                        >
                          Chuyển hướng
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="evacuation-body">
                    <div>
                      <span>Khu vực nguồn</span>
                      <b>{operation.sourceArea}</b>
                      <small>
                        {operation.evacuatedPopulation}/
                        {operation.estimatedPopulation} người đã sơ tán
                      </small>
                    </div>
                    <div>
                      <span>Đội phụ trách</span>
                      {operation.assignedTeamId ? (
                        <button
                          onClick={() =>
                            navigate(`/teams/${operation.assignedTeamId}`)
                          }
                        >
                          {operation.assignedTeamId}
                          <ChevronRight size={13} />
                        </button>
                      ) : (
                        <b>Chưa phân công</b>
                      )}
                      <small>
                        Hoàn thành dự kiến {operation.expectedCompletion}
                      </small>
                    </div>
                    <div>
                      <span>Tuyến đang sử dụng</span>
                      <b>{operation.route.name}</b>
                      <small>
                        {operation.route.distanceKm} km ·{" "}
                        {operation.route.estimatedMinutes} phút ·{" "}
                        {operation.route.status}
                      </small>
                    </div>
                  </div>
                  <div className="evacuation-progress">
                    <Progress
                      value={operation.progress}
                      tone={
                        operation.route.status === "Bị chặn" ? "amber" : "blue"
                      }
                    />
                    <span>{operation.progress}%</span>
                  </div>
                  {operation.route.blockedSegments.length > 0 && (
                    <p className="blocked-route-note">
                      <AlertTriangle size={13} />
                      {operation.route.blockedSegments.join("; ")}
                    </p>
                  )}
                </article>
              ))}
              {!operations.length && (
                <p className="section-empty">
                  Chưa có hoạt động sơ tán tới điểm này.
                </p>
              )}
            </div>
          </section>
          <section className="incident-detail-section">
            <SectionHeader
              title="Yêu cầu cứu trợ đang hoạt động"
              description={`${shelterRelief.length} yêu cầu phục vụ điểm này`}
            />
            <div className="warehouse-request-list">
              {shelterRelief.map((request) => {
                const allocated = reservations
                  .filter(
                    (item) =>
                      item.reliefRequestId === request.id &&
                      item.status !== "Đã giải phóng",
                  )
                  .flatMap((item) => item.items)
                  .reduce((sum, item) => sum + item.quantity, 0);
                const approved = request.items.reduce(
                  (sum, item) => sum + item.quantityApproved,
                  0,
                );
                return (
                  <button
                    key={request.id}
                    onClick={() => navigate(`/relief/requests/${request.id}`)}
                  >
                    <span>
                      <b>
                        {request.code} ·{" "}
                        {request.items.map((item) => item.name).join(", ")}
                      </b>
                      <small>
                        Đã phân bổ {allocated}/{approved} ·{" "}
                        {request.assignedWarehouseIds.join(", ") ||
                          "Chưa chọn kho"}
                      </small>
                    </span>
                    <Badge tone={allocated < approved ? "amber" : "blue"}>
                      {allocated < approved ? "Thiếu hàng" : request.status}
                    </Badge>
                  </button>
                );
              })}
              {!shelterRelief.length && (
                <p className="section-empty">
                  Chưa có yêu cầu cứu trợ đang mở.
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
              title="Bản đồ tác nghiệp và tuyến sơ tán"
              description="Tuyến đang dùng, tuyến bị chặn và phương án thay thế"
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
                operations={active}
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
        operation={selectedOperation}
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
