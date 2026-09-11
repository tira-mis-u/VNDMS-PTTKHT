import { Clock3, MapPin } from "lucide-react";
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
  const all = getCommandCenterActionQueue(store, (permission) =>
    store.can(permission as never),
  );
  const VISIBLE = 6;
  const items = all.slice(0, VISIBLE);
  // Việc bị đẩy khỏi 6 dòng đầu không được phép biến mất: tóm tắt theo loại và
  // cho bấm thẳng sang phân hệ tương ứng.
  const restByType = all.slice(VISIBLE).reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});
  const restLabel: Record<string, string> = {
    "SOS khẩn cấp": "SOS khẩn cấp",
    "Đội cứu hộ": "đội cứu hộ",
    "Nhiệm vụ": "nhiệm vụ quá hạn",
    "Sự cố": "sự cố",
  };
  const modulePath: Record<string, string> = {
    "SOS khẩn cấp": "/sos",
    "Đội cứu hộ": "/teams",
    "Nhiệm vụ": "/tasks",
    "Sự cố": "/incidents",
  };
  const open = (item: (typeof items)[number]) =>
    item.path ? onNavigate(item.path) : onOpen(item.ref);
  return (
    <section
      className="content-section cc-action-queue"
      aria-labelledby="action-queue-title"
    >
      {/*
        Bỏ nhãn "Xem toàn bộ hàng đợi": không có trang nào tên như vậy nên nút
        đó không dẫn đi đâu. Hàng đợi gộp từ các phân hệ còn lại (SOS, nhiệm vụ,
        đội, sự cố) — mỗi dòng đã mở thẳng hồ sơ gốc của nó.
      */}
      <SectionHeader
        title="Cần xử lý"
        description={
          all.length
            ? `${all.length} việc đang chờ trong phạm vi được phép đọc · xếp theo mức độ khẩn và thời gian chờ`
            : "Xếp theo mức độ ưu tiên và thời gian chờ"
        }
      />
      {items.length === 0 && (
        <p className="cc-action-empty">
          Không có việc nào đang chờ xử lý trong phạm vi được phép đọc của tài khoản{" "}
          <b>{store.currentUser?.displayName ?? "hiện tại"}</b>
          {store.currentUser?.geographicScope?.name
            ? ` (${store.currentUser.geographicScope.name})`
            : ""}
          . Hàng đợi lấy từ SOS, nhiệm vụ quá hạn, đội mất liên lạc, sự cố chưa gán,
          yêu cầu cứu trợ trễ hạn, chuyến hàng gặp sự cố và hồ sơ thiệt hại chờ thẩm định.
        </p>
      )}
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
            </div>
          </article>
        ))}
      </div>
      {Object.keys(restByType).length > 0 && (
        <div className="cc-action-rest">
          <span>Còn {all.length - items.length} việc khác:</span>
          {Object.entries(restByType).map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => onNavigate(modulePath[type] ?? "/")}
            >
              {count} {restLabel[type] ?? type.toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
