import { getCommandCenterTimeline } from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { SectionHeader } from "@/components/ui";
export function CoordinationTimeline() {
  const store = useOperationalState();
  const items = getCommandCenterTimeline(store);
  return (
    <section className="side-section cc-timeline-section">
      <SectionHeader
        title="Điều phối đang diễn ra"
        action="Xem nhật ký nghiệp vụ"
      />
      <div className="cc-timeline">
        {items.map((event) => (
          <div className="cc-timeline-event" key={event.id}>
            <time>{event.time}</time>
            <div className="cc-timeline-track">
              <i className={`timeline-dot ${event.tone}`} />
            </div>
            <div>
              <p>{event.title}</p>
              <span>{event.meta}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
