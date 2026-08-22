import {
  Activity,
  MapPin,
  UserRound,
  Users,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import type { Incident } from "@/domain/incidents/types";
import type { SosRequest } from "@/domain/sos/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { Warehouse } from "@/domain/relief/types";
import {
  findCommandCenterEntity,
  type CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Progress } from "@/components/ui";

export function DetailDrawer({
  selected,
  onClose,
  onAction,
}: {
  selected: CommandCenterEntityRef | null;
  onClose: () => void;
  onAction: (label: string) => void;
}) {
  const store = useOperationalState();
  if (!selected) return null;
  const value = findCommandCenterEntity(store, selected);
  if (!value) return null;
  const incident =
    selected.kind === "incident" ? (value as Incident) : undefined;
  const sos = selected.kind === "sos" ? (value as SosRequest) : undefined;
  const team = selected.kind === "team" ? (value as RescueTeam) : undefined;
  const shelter = selected.kind === "shelter" ? (value as Shelter) : undefined;
  const warehouse =
    selected.kind === "warehouse" ? (value as Warehouse) : undefined;
  const title =
    incident?.title ??
    (sos ? `Yêu cầu hỗ trợ ${sos.id}` : undefined) ??
    team?.name ??
    shelter?.name ??
    warehouse?.name ??
    selected.id;
  const eyebrow = incident
    ? "Chi tiết sự cố"
    : sos
      ? "Yêu cầu SOS"
      : team
        ? "Đội cứu hộ"
        : shelter
          ? "Điểm sơ tán"
          : "Kho cứu trợ";
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Đóng chi tiết"
      />
      <aside className="detail-drawer" aria-label={eyebrow}>
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <small>{selected.id}</small>
          </div>
          <button onClick={onClose} aria-label="Đóng">
            <X size={19} />
          </button>
        </header>
        <div className="drawer-body">
          {incident && (
            <>
              <div className="drawer-status">
                <Badge
                  tone={
                    incident.status === "Mới"
                      ? "red"
                      : incident.status === "Đã kiểm soát"
                        ? "green"
                        : "blue"
                  }
                >
                  {incident.status}
                </Badge>
                <span>
                  Mức độ: <b>{incident.severity}</b>
                </span>
              </div>
              <p className="drawer-description">{incident.description}</p>
              <dl className="drawer-facts">
                <div>
                  <dt>
                    <MapPin size={14} />
                    Khu vực
                  </dt>
                  <dd>{incident.location.name}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={14} />
                    Người phụ trách
                  </dt>
                  <dd>{incident.lead}</dd>
                </div>
                <div>
                  <dt>
                    <Users size={14} />
                    Đội điều phối
                  </dt>
                  <dd>{incident.assignedTeamId ?? "Chưa phân công"}</dd>
                </div>
                <div>
                  <dt>
                    <Activity size={14} />
                    Nhiệm vụ liên quan
                  </dt>
                  <dd>
                    {
                      store.tasks.filter(
                        (task) => task.incidentId === incident.id,
                      ).length
                    }{" "}
                    nhiệm vụ
                  </dd>
                </div>
              </dl>
              <div className="drawer-progress">
                <span>
                  <b>Tiến độ xử lý</b>
                  <strong>{incident.progress}%</strong>
                </span>
                <Progress value={incident.progress} tone="green" />
              </div>
              <DrawerTimeline
                items={store.events
                  .filter((event) => event.incidentId === incident.id)
                  .slice(0, 3)
                  .map((event) => `${event.timestamp} · ${event.message}`)}
              />
            </>
          )}
          {sos && (
            <>
              <div className="drawer-status">
                <Badge tone={sos.priority.startsWith("P1") ? "red" : "blue"}>
                  {sos.status}
                </Badge>
                <span>
                  <b>{sos.peopleAtRisk} người</b> cần hỗ trợ
                </span>
              </div>
              <p className="drawer-description">{sos.description}</p>
              <dl className="drawer-facts">
                <div>
                  <dt>
                    <MapPin size={14} />
                    Khu vực
                  </dt>
                  <dd>{sos.location.name}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={14} />
                    Liên hệ
                  </dt>
                  <dd>{sos.reporter.contact}</dd>
                </div>
              </dl>
              <DrawerTimeline
                items={store.sosEvents
                  .filter((event) => event.sosId === sos.id)
                  .slice(0, 3)
                  .map((event) => `${event.timestamp} · ${event.message}`)}
              />
            </>
          )}
          {team && (
            <>
              <div className="drawer-status">
                <Badge tone={team.status === "Mất liên lạc" ? "red" : "blue"}>
                  {team.status}
                </Badge>
                <span>{team.members} thành viên</span>
              </div>
              <dl className="drawer-facts">
                <div>
                  <dt>
                    <Activity size={14} />
                    Phân công hiện tại
                  </dt>
                  <dd>
                    {team.currentTask ??
                      team.currentEvacuationOperation ??
                      team.currentReliefShipment ??
                      "Chưa có"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Users size={14} />
                    Phạm vi
                  </dt>
                  <dd>{team.operatingScope}</dd>
                </div>
              </dl>
            </>
          )}
          {shelter && (
            <>
              <div className="drawer-status">
                <Badge
                  tone={
                    shelter.status === "Quá tải"
                      ? "red"
                      : shelter.status === "Gần đầy"
                        ? "amber"
                        : "green"
                  }
                >
                  {shelter.status}
                </Badge>
                <span>{shelter.administrativeArea}</span>
              </div>
              <div className="drawer-progress">
                <span>
                  <b>Sức chứa hiện tại</b>
                  <strong>
                    {Math.round(
                      (shelter.currentOccupancy /
                        Math.max(1, shelter.capacity)) *
                        100,
                    )}
                    %
                  </strong>
                </span>
                <Progress
                  value={Math.round(
                    (shelter.currentOccupancy / Math.max(1, shelter.capacity)) *
                      100,
                  )}
                  tone="green"
                />
              </div>
              <p className="drawer-description">
                Đang tiếp nhận {shelter.currentOccupancy}/{shelter.capacity}{" "}
                người.
              </p>
            </>
          )}
          {warehouse && (
            <>
              <div className="drawer-status">
                <Badge tone={warehouse.status === "Tạm đóng" ? "red" : "green"}>
                  {warehouse.status}
                </Badge>
                <span>{warehouse.administrativeArea}</span>
              </div>
              <dl className="drawer-facts">
                <div>
                  <dt>
                    <WarehouseIcon size={14} />
                    Mức sử dụng
                  </dt>
                  <dd>{warehouse.currentUtilization}%</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={14} />
                    Phụ trách
                  </dt>
                  <dd>{warehouse.responsibleOfficer.name}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() =>
              onAction(
                incident
                  ? "Quản lý sự cố"
                  : sos
                    ? "Xử lý SOS"
                    : "Mở phương án điều phối",
              )
            }
          >
            {incident
              ? "Quản lý sự cố"
              : sos
                ? "Xử lý SOS"
                : "Mở phương án điều phối"}
          </Button>
        </footer>
      </aside>
    </>
  );
}
function DrawerTimeline({ items }: { items: string[] }) {
  return (
    <div className="drawer-timeline">
      <h3>Diễn biến gần đây</h3>
      {items.map((item, index) => (
        <p key={`${index}-${item}`}>
          <i />
          {item}
        </p>
      ))}
    </div>
  );
}
