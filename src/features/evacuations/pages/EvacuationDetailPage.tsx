import { useMemo, useState } from "react";
import {
  BellRing,
  Building2,
  ChevronRight,
  Clock3,
  ExternalLink,
  LifeBuoy,
  MapPin,
  Route as RouteIcon,
  Siren,
  TriangleAlert,
  Truck,
  UserPlus,
} from "lucide-react";
import type { Permission } from "@/lib/permissions/permissions";
import type { EvacuationStatus } from "@/domain/evacuations/types";
import {
  alertSeverityLabels,
  alertSeverityTones,
} from "@/domain/alerts/types";
import { alertDetailPath } from "@/application/alerts/alertQueries";
import {
  getEvacuationPermissions,
  getEvacuationView,
  getLinkedEvacuationAlerts,
} from "@/application/evacuations/evacuationQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress } from "@/components/ui";
import {
  EvacuationActionDialogs,
  type EvacuationDialog,
} from "../components/EvacuationActionDialogs";

const transitionPermission = (
  status: EvacuationStatus,
): Extract<
  Permission,
  | "evacuation_approve"
  | "evacuation_complete"
  | "evacuation_cancel"
  | "evacuation_update"
> =>
  status === "Đã phê duyệt"
    ? "evacuation_approve"
    : status === "Hoàn thành"
      ? "evacuation_complete"
      : status === "Đã hủy"
        ? "evacuation_cancel"
        : "evacuation_update";

export function EvacuationDetailPage({
  id,
  navigate,
}: {
  id: string;
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const [dialog, setDialog] = useState<EvacuationDialog>(null);
  const [error, setError] = useState("");
  const run = (action: () => unknown) => {
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
  const view = useMemo(
    () =>
      getEvacuationView(store.evacuationOperations, id, {
        incidents: store.incidents,
        shelters: store.shelters,
        teams: store.teams,
      }),
    [store.evacuationOperations, store.incidents, store.shelters, store.teams, id],
  );
  if (!view)
    return (
      <div className="workspace-content">
        <div className="incident-not-found">
          <Truck size={24} />
          <h2>Không tìm thấy hoạt động sơ tán</h2>
          <p>
            Hoạt động không tồn tại hoặc nằm ngoài phạm vi truy cập của tài
            khoản hiện tại.
          </p>
          <Button variant="secondary" onClick={() => navigate("/evacuations")}>
            Quay lại danh sách sơ tán
          </Button>
        </div>
      </div>
    );
  const { operation, incident, shelter, team } = view;
  const perms = getEvacuationPermissions(operation, store.can);
  const linkedAlerts = getLinkedEvacuationAlerts(store.alerts, operation);
  const events = store.evacuationEvents.filter(
    (event) => event.operationId === operation.id,
  );
  const canTransition = (status: EvacuationStatus) => {
    const key = transitionPermission(status);
    if (key === "evacuation_approve") return perms.approve;
    if (key === "evacuation_complete") return perms.complete;
    if (key === "evacuation_cancel") return perms.cancel;
    return perms.update;
  };
  return (
    <div className="workspace-content evac-page evac-detail-page">
      <div className="page-header">
        <div>
          <div className="breadcrumbs">
            <span>Ứng phó</span>
            <ChevronRight size={13} />
            <button className="breadcrumb-link" onClick={() => navigate("/evacuations")}>
              Sơ tán
            </button>
            <ChevronRight size={13} />
            <b>{operation.id}</b>
          </div>
          <h1>
            Sơ tán {operation.id} · {operation.sourceArea}
          </h1>
          <p>
            Thuộc sự cố {operation.incidentId}
            {incident ? ` — ${incident.title}` : ""}; cập nhật{" "}
            {operation.updatedAt}
          </p>
        </div>
        <div className="evac-header-actions">
          <Badge
            tone={
              operation.status === "Tạm dừng"
                ? "amber"
                : operation.status === "Hoàn thành"
                  ? "green"
                  : operation.status === "Đang triển khai"
                    ? "blue"
                    : operation.status === "Đã hủy"
                      ? "red"
                      : "neutral"
            }
          >
            {operation.status}
          </Badge>
          <Badge
            tone={
              operation.priority === "Khẩn cấp"
                ? "red"
                : operation.priority === "Cao"
                  ? "amber"
                  : operation.priority === "Trung bình"
                    ? "blue"
                    : "neutral"
            }
          >
            {operation.priority}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      <section className="content-section evac-actions-bar" aria-label="Thao tác điều phối">
        <div className="evac-actions-group">
          {view.availableTransitions.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === "Đã hủy" ? "secondary" : "primary"}
              disabled={!canTransition(status)}
              title={
                canTransition(status)
                  ? `Chuyển sang ${status}`
                  : "Tài khoản hiện tại không có quyền cho thao tác này hoặc ngoài phạm vi địa bàn"
              }
              onClick={() =>
                run(() => store.transitionEvacuation(operation.id, status))
              }
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="evac-actions-group">
          <Button
            size="sm"
            variant="secondary"
            disabled={!perms.assign}
            title={
              perms.assign
                ? "Phân công đội phụ trách"
                : "Không có quyền phân công hoặc hoạt động đã kết thúc"
            }
            onClick={() => setDialog("assign")}
          >
            <UserPlus size={14} />
            <span>Phân công đội</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!perms.update}
            title={
              perms.update
                ? "Cập nhật số ngườii đã sơ tán"
                : "Không có quyền cập nhật hoặc hoạt động đã kết thúc"
            }
            onClick={() => setDialog("progress")}
          >
            <Clock3 size={14} />
            <span>Cập nhật tiến độ</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!perms.update}
            title={
              perms.update
                ? "Cập nhật tình trạng tuyến"
                : "Không có quyền cập nhật hoặc hoạt động đã kết thúc"
            }
            onClick={() => setDialog("route")}
          >
            <RouteIcon size={14} />
            <span>Cập nhật tuyến</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!perms.update}
            title={
              perms.update
                ? "Chuyển hướng điểm tiếp nhận"
                : "Không có quyền cập nhật hoặc hoạt động đã kết thúc"
            }
            onClick={() => setDialog("redirect")}
          >
            <ExternalLink size={14} />
            <span>Chuyển hướng</span>
          </Button>
        </div>
      </section>

      {!perms.update && !perms.approve && !perms.assign && (
        <div className="evac-readonly-note" role="note">
          Tài khoản hiện tại chỉ có quyền xem hoạt động này (thiếu quyền điều
          phối sơ tán hoặc ngoài phạm vi địa bàn phụ trách).
        </div>
      )}

      <section
        className={`evac-hero ${view.delayed || view.overdue ? "evac-hero-warning" : ""}`}
      >
        <div className="evac-hero-progress">
          <div className="evac-hero-count">
            <small>Đã sơ tán</small>
            <b>
              {operation.evacuatedPopulation.toLocaleString("vi-VN")}
              <span>/{operation.estimatedPopulation.toLocaleString("vi-VN")} ngườii</span>
            </b>
          </div>
          <Progress
            value={operation.progress}
            tone={
              operation.route.status === "Bị chặn"
                ? "amber"
                : operation.progress === 100
                  ? "green"
                  : "blue"
            }
          />
          <span className="evac-hero-percent">{operation.progress}%</span>
        </div>
        <div className="evac-hero-meta">
          <span>
            Còn lại: <b>{view.remainingPopulation.toLocaleString("vi-VN")} ngườii</b>
          </span>
          <span>
            Bắt đầu: <b>{operation.startTime ?? "Chưa triển khai"}</b>
          </span>
          <span>
            Hoàn thành dự kiến: <b>{operation.expectedCompletion}</b>
          </span>
          {operation.actualCompletion && (
            <span>
              Hoàn thành thực tế: <b>{operation.actualCompletion}</b>
            </span>
          )}
        </div>
        {(view.delayed || view.overdue || view.recommendations.length > 0) && (
          <div className="evac-hero-attention">
            <h2>
              <TriangleAlert size={15} />
              Điểm cần xử lý
            </h2>
            <ul>
              {view.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="evac-detail-grid">
        <section className="content-section evac-detail-facts">
          <h2>Thông tin hoạt động</h2>
          <dl>
            <div>
              <dt>Mã hoạt động</dt>
              <dd>{operation.id}</dd>
            </div>
            <div>
              <dt>Sự cố liên quan</dt>
              <dd>
                <button
                  className="evac-entity-link"
                  onClick={() => navigate(`/incidents/${operation.incidentId}`)}
                >
                  <Siren size={13} />
                  {operation.incidentId}
                  {incident ? ` · ${incident.title}` : ""}
                  <ChevronRight size={13} />
                </button>
              </dd>
            </div>
            <div>
              <dt>Khu vực nguồn</dt>
              <dd>
                <MapPin size={13} className="evac-inline-icon" />
                {operation.sourceArea}
              </dd>
            </div>
            <div>
              <dt>Điểm tiếp nhận</dt>
              <dd>
                <button
                  className="evac-entity-link"
                  onClick={() =>
                    navigate(`/shelters/${operation.destinationShelterId}`)
                  }
                >
                  <Building2 size={13} />
                  {shelter?.name ?? operation.destinationShelterId}
                  <ChevronRight size={13} />
                </button>
                {view.shelterCapacity && shelter && (
                  <small className="evac-entity-sub">
                    {shelter.status} · còn khả dụng{" "}
                    {view.shelterCapacity.availableCapacity.toLocaleString("vi-VN")}{" "}
                    chỗ
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>Đội phụ trách</dt>
              <dd>
                {team ? (
                  <button
                    className="evac-entity-link"
                    onClick={() => navigate(`/teams/${team.id}`)}
                  >
                    <LifeBuoy size={13} />
                    {team.id} · {team.name}
                    <ChevronRight size={13} />
                  </button>
                ) : operation.assignedTeamId ? (
                  <span>{operation.assignedTeamId} (ngoài phạm vi truy cập)</span>
                ) : (
                  <span>Chưa phân công</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Tọa độ nguồn</dt>
              <dd>
                [{operation.sourceCoordinates[0]},{" "}
                {operation.sourceCoordinates[1]}]
              </dd>
            </div>
            {operation.notes && (
              <div>
                <dt>Ghi chú điều hành</dt>
                <dd>{operation.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="content-section evac-detail-route">
          <h2>Tuyến di chuyển</h2>
          <div className="evac-route-head">
            <h3>{operation.route.name}</h3>
            <Badge
              tone={
                operation.route.status === "Bị chặn"
                  ? "red"
                  : operation.route.status === "Hạn chế"
                    ? "amber"
                    : operation.route.status === "Đang dùng tuyến thay thế"
                      ? "blue"
                      : "green"
              }
            >
              {operation.route.status}
            </Badge>
          </div>
          <dl>
            <div>
              <dt>Quãng đường</dt>
              <dd>{operation.route.distanceKm} km</dd>
            </div>
            <div>
              <dt>Thởi gian ước tính</dt>
              <dd>{operation.route.estimatedMinutes} phút</dd>
            </div>
            <div>
              <dt>Cập nhật tuyến</dt>
              <dd>{operation.route.updatedAt}</dd>
            </div>
            <div>
              <dt>Tuyến thay thế</dt>
              <dd>
                {operation.route.alternativeCoordinates.length
                  ? `Đã lập (${operation.route.alternativeCoordinates.length} điểm định tuyến)`
                  : "Chưa có phương án"}
              </dd>
            </div>
          </dl>
          {operation.route.blockedSegments.length > 0 && (
            <div className="evac-blocked-note">
              <TriangleAlert size={13} />
              <div>
                <b>Đoạn bị chặn</b>
                <p>{operation.route.blockedSegments.join("; ")}</p>
              </div>
            </div>
          )}
          {view.needsAlternativeRoute &&
            operation.route.alternativeCoordinates.length > 0 && (
              <p className="evac-route-hint">
                Tuyến chính đang bị chặn — có thể kích hoạt tuyến thay thế qua
                “Cập nhật tuyến”.
              </p>
            )}
        </section>

        <section className="content-section evac-detail-alerts">
          <h2>
            <BellRing size={15} />
            Cảnh báo liên quan
          </h2>
          {linkedAlerts.length === 0 ? (
            <p className="evac-timeline-empty">
              Không có cảnh báo tác nghiệp nào đang hiệu lực cho hoạt động này
              trong phạm vi phân quyền hiện tại.
            </p>
          ) : (
            <ul className="evac-alert-list">
              {linkedAlerts.map((alert) => (
                <li key={alert.key}>
                  <Badge tone={alertSeverityTones[alert.severity]}>
                    {alertSeverityLabels[alert.severity]}
                  </Badge>
                  <div className="evac-alert-body">
                    <button
                      className="evac-entity-link"
                      onClick={() => navigate(alertDetailPath(alert))}
                    >
                      {alert.title}
                      <ChevronRight size={13} />
                    </button>
                    <small>
                      {alert.status} · ghi nhận {alert.detectedAt}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="evac-route-hint">
            Cảnh báo được suy ra từ canonical state và tự hết hiệu lực khi điều
            kiện nghiệp vụ được xử lý.
          </p>
        </section>

        <section className="content-section evac-detail-timeline">
          <h2>Nhật ký hoạt động</h2>
          {events.length === 0 ? (
            <p className="evac-timeline-empty">
              Chưa có sự kiện nào được ghi nhận cho hoạt động này.
            </p>
          ) : (
            <ul className="evac-timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <span className="evac-timeline-dot" />
                  <div>
                    <p>{event.message}</p>
                    <small>
                      {event.timestamp} · {event.actor} · {event.source}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <EvacuationActionDialogs
        mode={dialog}
        operation={operation}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
