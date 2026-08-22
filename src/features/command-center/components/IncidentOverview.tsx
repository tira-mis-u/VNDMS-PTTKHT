import { ChevronRight } from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Progress, SectionHeader } from "@/components/ui";
const tone = (status: string) =>
  status === "Đã kiểm soát"
    ? "green"
    : status === "Đang xử lý"
      ? "blue"
      : status === "Mới"
        ? "red"
        : "amber";
export function IncidentOverview({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const { incidents } = useOperationalState();
  const active = incidents
    .filter((item) => !["Đã đóng", "Đã kiểm soát"].includes(item.status))
    .slice(0, 3);
  return (
    <section
      className="content-section cc-incidents"
      aria-labelledby="incidents-title"
    >
      <SectionHeader
        title="Sự cố đang xử lý"
        description="Tiến độ, lực lượng và trạng thái điều phối hiện tại"
        action="Mở module Sự cố"
      />
      <div className="cc-incident-table">
        <div className="cc-incident-head">
          <span>Sự cố</span>
          <span>Trạng thái</span>
          <span>Đội phụ trách</span>
          <span>Tiến độ</span>
          <span />
        </div>
        {active.map((incident) => (
          <button
            className="cc-incident-row"
            key={incident.id}
            onClick={() => onNavigate(`/incidents/${incident.id}`)}
          >
            <span className="cc-incident-identity">
              <b>{incident.title}</b>
              <small>
                {incident.id} · {incident.location.name}
              </small>
            </span>
            <span>
              <Badge tone={tone(incident.status)}>{incident.status}</Badge>
            </span>
            <span className="cc-team-cell">
              {incident.assignedTeamId ?? "Chưa giao"}
            </span>
            <span className="cc-progress-cell">
              <span>{incident.progress}%</span>
              <Progress
                value={incident.progress}
                tone={incident.progress > 50 ? "green" : "blue"}
              />
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}
