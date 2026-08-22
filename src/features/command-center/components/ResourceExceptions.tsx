import { ChevronRight } from "lucide-react";
import {
  getCommandCenterResourceExceptions,
  type CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { evacuationDetailPath } from "@/application/evacuations/evacuationQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Progress, SectionHeader } from "@/components/ui";

export function ResourceExceptions({
  onOpen,
  onNavigate,
}: {
  onOpen: (ref: CommandCenterEntityRef) => void;
  onQuickAction: (label: string) => void;
  onNavigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const items = getCommandCenterResourceExceptions(store);
  const navigateItem = (item: (typeof items)[number]) => {
    if (item.kind === "sos") onNavigate(`/sos/${item.id}`);
    else if (item.kind === "shelter") onNavigate(`/shelters/${item.id}`);
    else if (item.kind === "evacuation") {
      const operation = store.evacuationOperations.find(
        (entry) => entry.id === item.id,
      );
      if (operation) onNavigate(evacuationDetailPath(operation));
    } else if (item.kind === "team") onNavigate(`/teams/${item.id}`);
    else onOpen({ kind: "warehouse", id: item.id });
  };
  return (
    <section className="side-section cc-resources">
      <SectionHeader
        title="Nguồn lực cần chú ý"
        description="Chỉ hiển thị ngoại lệ cần can thiệp"
        action="Xem nguồn lực"
      />
      <div>
        {items.map((item) => (
          <article
            key={`${item.kind}-${item.id}-${item.name}`}
            className="cc-resource-item"
          >
            <button
              className="cc-resource-main"
              onClick={() => navigateItem(item)}
            >
              <span className="cc-resource-title">
                <span>
                  <small>{item.owner}</small>
                  <b>{item.name}</b>
                </span>
                <Badge tone={item.tone}>{item.state}</Badge>
              </span>
              <span className="cc-resource-value">
                <b>{item.display}</b>
              </span>
              <Progress
                value={item.value}
                tone={item.tone === "amber" ? "amber" : "blue"}
              />
            </button>
            <button
              className="cc-resource-action"
              onClick={() => navigateItem(item)}
            >
              {item.action}
              <ChevronRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
