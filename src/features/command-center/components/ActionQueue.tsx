import { ChevronRight, Clock3, MapPin } from "lucide-react";
import {
  getCommandCenterActionQueue,
  type CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, SectionHeader } from "@/components/ui";

export function ActionQueue({
  onOpen,
  onNavigate,
}: {
  onOpen: (ref: CommandCenterEntityRef) => void;
  onQuickAction: (label: string) => void;
  onNavigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const items = getCommandCenterActionQueue(store);
  const open = (item: (typeof items)[number]) =>
    item.path ? onNavigate(item.path) : onOpen(item.ref);
  return (
    <section
      className="content-section cc-action-queue"
      aria-labelledby="action-queue-title"
    >
      <SectionHeader
        title="Cần xử lý"
        description="Xếp theo mức độ ưu tiên và thời gian chờ"
        action="Xem toàn bộ hàng đợi"
      />
      <div className="cc-action-list">
        {items.map((item, index) => (
          <article className="cc-action-item" key={`${item.type}-${item.id}`}>
            <span className={`cc-severity-line cc-severity-${item.tone}`} />
            <div className="cc-action-rank">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div
              className="cc-action-body"
              onClick={() => open(item)}
              role="button"
              tabIndex={0}
            >
              <div className="cc-action-titleline">
                <Badge tone={item.tone}>{item.priority}</Badge>
                <span>{item.type}</span>
                <b>{item.id}</b>
              </div>
              <h3>{item.title}</h3>
              <div className="cc-action-meta">
                <span>
                  <MapPin size={12} />
                  {item.area}
                </span>
                <span>
                  <Clock3 size={12} />
                  {item.time}
                </span>
                <span>
                  Trạng thái: <b>{item.status}</b>
                </span>
              </div>
            </div>
            <div className="cc-action-buttons">
              <Button size="sm" onClick={() => open(item)}>
                {item.action}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Xem chi tiết"
                onClick={() => open(item)}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
